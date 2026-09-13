'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateDependencyModel, exportToMermaid } = require('@/lang/graph/dependencyGraphAnalyzer');

let currentPanel = null;

function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

function getHtml(context, webview, initialModel = null) {
    const extensionRoot = context.extensionUri || vscode.Uri.file(context.extensionPath);
    const webviewRoot = vscode.Uri.joinPath
        ? vscode.Uri.joinPath(extensionRoot, 'app', 'lang', 'web-panel', 'graph')
        : vscode.Uri.file(path.join(context.extensionPath, 'app', 'lang', 'web-panel', 'graph'));

    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath
            ? vscode.Uri.joinPath(webviewRoot, 'dist', 'main.js')
            : vscode.Uri.file(path.join(webviewRoot.fsPath, 'dist', 'main.js'))
    );
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath
            ? vscode.Uri.joinPath(webviewRoot, 'css', 'graph.css')
            : vscode.Uri.file(path.join(webviewRoot.fsPath, 'css', 'graph.css'))
    );

    const templatePath = path.join(context.extensionPath, 'app', 'lang', 'web-panel', 'graph', 'index.html');
    const template = fs.readFileSync(templatePath, 'utf8');

    const nonce = getNonce();
    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}'`
    ].join('; ');

    let initialModelJson = 'null';
    if (initialModel) {
        try {
            initialModelJson = JSON.stringify(initialModel).replace(/</g, '\\u003c');
        } catch {
            initialModelJson = 'null';
        }
    }

    return template
        .replace(/\{\{csp\}\}/g, csp)
        .replace(/\{\{nonce\}\}/g, nonce)
        .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
        .replace(/\{\{styleUri\}\}/g, styleUri.toString())
        .replace(/\{\{initialModel\}\}/g, initialModelJson);
}

/**
 * Loads all workspace BML files for graph analysis.
 * @returns {Promise<Array<{filePath: string, content: string}>>}
 */
async function loadWorkspaceBmlFiles() {
    const uris = await vscode.workspace.findFiles(
        '**/*.bml',
        '{**/node_modules/**,**/.vscode-test/**,**/dist/**,**/.git/**,**/scratch/**}'
    );
    const files = [];
    for (const uri of uris) {
        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            files.push({ filePath: uri.fsPath, content });
        } catch {
            // Ignore unreadable files
        }
    }
    return files;
}

/**
 * Shows or updates the Dependency & Blast Radius Graph panel.
 * @param {vscode.ExtensionContext} context 
 * @param {vscode.Uri} [targetUri] 
 */
async function showDependencyGraph(context, targetUri) {
    let uri = targetUri;
    if (!uri && vscode.window.activeTextEditor) {
        uri = vscode.window.activeTextEditor.document.uri;
    }

    if (!uri || !uri.fsPath || !uri.fsPath.endsWith('.bml')) {
        vscode.window.showWarningMessage('Please open a BML file to view its Architecture Dependency & Blast Radius graph.');
        return;
    }

    const targetFilePath = uri.fsPath;
    const baseName = path.basename(targetFilePath, '.bml');

    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn || vscode.ViewColumn.One
        : vscode.ViewColumn.One;

    // Fast read of target file content
    let currentContent = '';
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath === targetFilePath) {
        currentContent = vscode.window.activeTextEditor.document.getText();
    } else {
        try {
            currentContent = fs.readFileSync(targetFilePath, 'utf8');
        } catch {
            currentContent = '';
        }
    }

    // Fast initial model computed synchronously so webview renders instantaneously without loading delay
    const initialModel = generateDependencyModel(
        targetFilePath,
        [{ filePath: targetFilePath, content: currentContent }],
        currentContent
    );

    try {
        const { openWebPanel } = require('@/lang/web-panel/webPanelManager');
        const panel = openWebPanel(context, {
            page: 'graph',
            payload: { model: initialModel, targetName: baseName, targetFilePath },
            column
        });
        if (panel) {
            currentPanel = panel;
            updatePanelModel(panel, targetFilePath).catch(() => {});
            return panel;
        }
    } catch (_) {}

    const extensionRoot = context.extensionUri || vscode.Uri.file(context.extensionPath);
    const localResourceRoots = [
        extensionRoot,
        vscode.Uri.file(context.extensionPath)
    ];

    const panel = vscode.window.createWebviewPanel(
        'cpqBmlDependencyGraph',
        `Blast Radius: ${baseName}`,
        column,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots
        }
    );

    currentPanel = panel;
    panel.activeTarget = targetFilePath;

    const iconPath = vscode.Uri.joinPath
        ? vscode.Uri.joinPath(extensionRoot, 'app', 'icons', 'logo.svg')
        : vscode.Uri.file(path.join(context.extensionPath, 'app', 'icons', 'logo.svg'));
    if (fs.existsSync(iconPath.fsPath)) {
        panel.iconPath = iconPath;
    }

    panel.onDidDispose(() => {
        if (currentPanel === panel) {
            currentPanel = null;
        }
    }, null, context.subscriptions);

    // Register message handler BEFORE setting HTML so 'ready' is never lost
    panel.webview.onDidReceiveMessage(async (message) => {
        if (!message) return;

        const activeTarget = panel.activeTarget || targetFilePath;
        switch (message.command) {
            case 'ready':
                await updatePanelModel(panel, activeTarget);
                break;

            case 'refresh':
                await updatePanelModel(panel, activeTarget);
                vscode.window.showInformationMessage(`Refreshed dependency graph for ${path.basename(activeTarget)}`);
                break;

            case 'openFile':
                if (message.filePath && fs.existsSync(message.filePath)) {
                    const doc = await vscode.workspace.openTextDocument(message.filePath);
                    const line = Math.max(0, message.line || 0);
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.Beside,
                        selection: new vscode.Range(line, 0, line, 0)
                    });
                }
                break;

            case 'exportMermaid':
                try {
                    const files = await loadWorkspaceBmlFiles();
                    const model = generateDependencyModel(activeTarget, files);
                    const mermaidCode = exportToMermaid(model);
                    await vscode.env.clipboard.writeText(mermaidCode);
                    vscode.window.showInformationMessage('Mermaid diagram markdown copied to clipboard!');
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to export Mermaid diagram: ${err.message}`);
                }
                break;
        }
    }, null, context.subscriptions);

    panel.webview.html = getHtml(context, panel.webview, initialModel);

    // Asynchronously scan workspace in background to populate upstream callers (Blast Radius)
    updatePanelModel(panel, targetFilePath).catch(() => {});
}

/**
 * Re-analyzes dependencies and sends updated model to the Webview.
 * @param {vscode.WebviewPanel} panel 
 * @param {string} targetFilePath 
 */
async function updatePanelModel(panel, targetFilePath) {
    if (!panel || !targetFilePath) return;
    try {
        const files = await loadWorkspaceBmlFiles();
        let currentContent;
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath === targetFilePath) {
            currentContent = vscode.window.activeTextEditor.document.getText();
        } else {
            try {
                currentContent = fs.readFileSync(targetFilePath, 'utf8');
            } catch {
                currentContent = '';
            }
        }
        const model = generateDependencyModel(targetFilePath, files, currentContent);
        panel.webview.postMessage({ type: 'updateGraph', model });
    } catch (err) {
        vscode.window.showErrorMessage(`Error generating dependency graph: ${err.message}`);
    }
}

/**
 * Registers the dependency graph command.
 * @param {vscode.ExtensionContext} context 
 */
function registerDependencyGraph(context) {
    const cmd = vscode.commands.registerCommand('cpqBml.showDependencyGraph', async (uri) => {
        await showDependencyGraph(context, uri);
    });
    context.subscriptions.push(cmd);
}

module.exports = {
    showDependencyGraph,
    registerDependencyGraph,
    loadWorkspaceBmlFiles,
    getHtml
};
