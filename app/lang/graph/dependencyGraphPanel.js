'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { generateDependencyModel, exportToMermaid } = require('@/lang/graph/dependencyGraphAnalyzer');

let currentPanel = null;

function getHtml(context, webview, initialModel = null) {
    const { getWebPanelHtml } = require('@/lang/web-panel/webPanelManager');
    return getWebPanelHtml(context, webview, { page: 'graph', graphModel: initialModel });
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

    const { openWebPanel } = require('@/lang/web-panel/webPanelManager');
    const panel = openWebPanel(context, {
        page: 'graph',
        payload: { model: initialModel, targetName: baseName, targetFilePath },
        column
    });
    currentPanel = panel;
    updatePanelModel(panel, targetFilePath).catch(() => {});
    return panel;
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
