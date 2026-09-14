'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { generateDependencyModel, exportToMermaid } = require('@/lang/graph/dependencyGraphAnalyzer');
const {
    buildWorkspaceEntityIndex,
    searchWorkspaceEntities,
    generateBottomUpModel
} = require('@/lang/graph/bottomUpTracer');

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
        vscode.window.showWarningMessage('Please open a BML file to view its Architecture Dependency & References graph.');
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
 * Fetches server-side cloud references for an attribute or action from Oracle CPQ REST APIs.
 */
async function fetchEntityCloudReferences(context, vscodeInstance, entityType, entityName, metadata = {}) {
    const apiCommerce = require('@/lang/rest/apiCommerce');
    const { isConfigured } = require('@/lang/rest/config');
    if (!isConfigured(vscodeInstance)) return [];

    const effectiveProc = metadata.process || metadata.commerceProcess;
    const effectiveDoc = metadata.document || metadata.docName || metadata.commerceDocument;
    const cloudRefs = [];

    try {
        if (entityType === 'action' && typeof apiCommerce.getCommerceAction === 'function') {
            const res = await apiCommerce.getCommerceAction(context, vscodeInstance, entityName, {
                process: effectiveProc,
                document: effectiveDoc
            });
            const actionData = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
            const deps = actionData?.dependencies || {};
            if (Array.isArray(deps.attributes)) {
                for (const a of deps.attributes) {
                    cloudRefs.push({ name: a, type: 'Dependent Attribute', description: 'Attribute modified or referenced by action' });
                }
            }
            if (Array.isArray(deps.actions)) {
                for (const act of deps.actions) {
                    cloudRefs.push({ name: act, type: 'Associated Action', description: 'Chained action in process flow' });
                }
            }
            if (Array.isArray(deps.groups)) {
                for (const g of deps.groups) {
                    cloudRefs.push({ name: g, type: 'Layout Group', description: 'Layout group or tab affected by action' });
                }
            }
            if (Array.isArray(deps.resources)) {
                for (const r of deps.resources) {
                    cloudRefs.push({ name: r, type: 'Resource', description: 'Subdocument or resource affected by action' });
                }
            }
        } else if (entityType === 'attribute') {
            const apiAttributes = require('@/lang/rest/apiCommerceAttributes');
            const fetchFn = typeof apiAttributes.listCommerceAttributeReferences === 'function'
                ? apiAttributes.listCommerceAttributeReferences
                : apiCommerce.listCommerceAttributeReferences;

            if (typeof fetchFn === 'function') {
                const res = await fetchFn(context, vscodeInstance, entityName, {
                    process: effectiveProc,
                    document: effectiveDoc
                });
                const raw = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
                if (raw && typeof raw === 'object') {
                    if (Array.isArray(raw.ruleAssocs)) {
                        for (const r of raw.ruleAssocs) {
                            cloudRefs.push({ name: r.label || r.name, type: r.type || 'Rule Association', description: r.href || 'Commerce rule referencing attribute' });
                        }
                    }
                    if (Array.isArray(raw.libFuncAssocs)) {
                        for (const f of raw.libFuncAssocs) {
                            cloudRefs.push({ name: f.label || f.name, type: 'Library Function', description: f.id ? `Function ID: ${f.id}` : 'Library function referencing attribute' });
                        }
                    }
                    if (Array.isArray(raw.integrationAssocs)) {
                        for (const i of raw.integrationAssocs) {
                            cloudRefs.push({ name: i.label || i.name, type: 'Integration', description: i.id ? `Integration ID: ${i.id}` : 'Integration mapping referencing attribute' });
                        }
                    }
                    if (Array.isArray(raw.layoutReferences)) {
                        for (const l of raw.layoutReferences) {
                            cloudRefs.push({ name: l.path || 'Layout Panel', type: `Layout (${l.layoutType || 'UI'})`, description: l.path || 'UI layout panel' });
                        }
                    }
                }
                if (cloudRefs.length === 0) {
                    const fallback = Array.isArray(raw) ? raw : (raw?.items || raw?.references || raw?.usages || []);
                    cloudRefs.push(...fallback);
                }
            }
        } else if (entityType === 'library' || entityType === 'function') {
            const apiRest = require('@/lang/rest/api');
            if (typeof apiRest.searchBmlScripts === 'function') {
                const res = await apiRest.searchBmlScripts(context, vscodeInstance, { query: entityName, limit: 50 });
                const body = typeof res?.body === 'string' ? JSON.parse(res.body) : res?.body;
                const items = Array.isArray(body?.items) ? body.items : [];
                for (const it of items) {
                    cloudRefs.push({
                        name: it.path || 'BML Script',
                        type: 'Caller Script (CPQ Cloud)',
                        description: it.dateModified ? `Last modified: ${it.dateModified}` : `Remote script referencing ${entityName}`,
                        category: 'Library'
                    });
                }
            }
        }
    } catch (_) {}

    return cloudRefs;
}

/**
 * Traces a specific entity (attribute, table, action, library) bottom-up and sends model to webview.
 * @param {vscode.WebviewPanel} panel
 * @param {'attribute'|'table'|'action'|'library'} entityType
 * @param {string} entityName
 * @param {object} [metadata]
 * @param {typeof vscode} [vscodeInstance]
 */
async function updatePanelEntityModel(panel, entityType, entityName, metadata = {}, vscodeInstance = vscode) {
    if (!panel || !entityType || !entityName) return;
    try {
        const files = await loadWorkspaceBmlFiles();
        let model = generateBottomUpModel(entityType, entityName, files);
        if (model) {
            panel.webview.postMessage({ type: 'updateGraph', model });
        }

        // If attribute, action, or library function, query cloud references/dependencies live from Oracle CPQ
        if (entityType === 'attribute' || entityType === 'action' || entityType === 'library' || entityType === 'function') {
            try {
                const cloudRefs = await fetchEntityCloudReferences(null, vscodeInstance, entityType, entityName, metadata);
                if (cloudRefs.length > 0) {
                    model = generateBottomUpModel(entityType, entityName, files, cloudRefs);
                    panel.webview.postMessage({ type: 'updateGraph', model });
                }
            } catch (_) {}
        }
    } catch (err) {
        vscodeInstance.window.showErrorMessage(`Error generating bottom-up dependency graph for ${entityName}: ${err.message}`);
    }
}

/**
 * Opens or focuses the Visual Dependency & References graph focused on a specific entity.
 * For Attributes, Actions, and BML Libraries, queries CPQ server endpoints live to incorporate server-side references & dependencies!
 */
async function showEntityDependencyGraph(context, entityType, entityName, metadata = {}, vscodeInstance = vscode) {
    if (!entityType || !entityName) return;

    const column = vscodeInstance.window?.activeTextEditor
        ? vscodeInstance.window.activeTextEditor.viewColumn || vscodeInstance.ViewColumn?.Beside || 2
        : vscodeInstance.ViewColumn?.One || 1;

    let files = [];
    try {
        files = await loadWorkspaceBmlFiles();
    } catch (_) {}

    // Fast initial bottom-up model from workspace files
    let model = generateBottomUpModel(entityType, entityName, files);

    const { openWebPanel } = require('@/lang/web-panel/webPanelManager');
    const panel = openWebPanel(context, {
        page: 'graph',
        payload: { model, targetName: entityName, targetEntityType: entityType, entityMetadata: metadata },
        column,
        vscodeInstance
    });
    currentPanel = panel;

    // Asynchronously fetch live Cloud References / Dependencies from Oracle CPQ
    if (entityType === 'attribute' || entityType === 'action' || entityType === 'library' || entityType === 'function') {
        try {
            const cloudRefs = await fetchEntityCloudReferences(context, vscodeInstance, entityType, entityName, metadata);
            if (cloudRefs.length > 0) {
                model = generateBottomUpModel(entityType, entityName, files, cloudRefs);
                if (panel && panel.webview) {
                    panel.webview.postMessage({ type: 'updateGraph', model });
                }
            }
        } catch (_) {}
    }

    return panel;
}

/**
 * Searches across workspace entities and sends categorized results to webview.
 * @param {vscode.WebviewPanel} panel
 * @param {string} query
 */
async function handleSearchEntities(panel, query) {
    if (!panel || !query) return;
    try {
        const files = await loadWorkspaceBmlFiles();
        const index = buildWorkspaceEntityIndex(files);
        const results = searchWorkspaceEntities(index, query, 15);
        panel.webview.postMessage({ type: 'entitySearchResults', results, query });
    } catch (_) {}
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
    showEntityDependencyGraph,
    registerDependencyGraph,
    loadWorkspaceBmlFiles,
    updatePanelModel,
    updatePanelEntityModel,
    handleSearchEntities,
    getHtml
};
