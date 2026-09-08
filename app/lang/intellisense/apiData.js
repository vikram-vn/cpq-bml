let vscode;
try {
    vscode = require('vscode');
} catch (_) {}
const { loadJson, invalidateCache: invalidateJsonCache } = require('./apiDataLoader');

const API_FILES = [
    { baseName: 'bml-attributes-api-usage', category: 'attribute' },
    { baseName: 'bml-util-attributes-api-usage', category: 'attribute' },
    { baseName: 'bml-variables-api-usage', category: 'variable' },
    { baseName: 'bml-functions-api-usage', category: 'function' },
    { baseName: 'bml-cpq-js-api-usage', category: 'function' },
    { baseName: 'custom-snippets', category: 'snippet' }
];

let bmlApiData = {};
let apiDataLoaded = false;
let cachedGlobalItems = null;
let cachedTransactionItems = null;
let cachedLineItems = null;
let cachedSystemItems = null;
let cachedCpqjsItems = null;
let cachedAllAttributes = null;

let savedContext = null;

function loadApiData(context) {
    if (context && context.extensionPath) {
        savedContext = context;
    }
    if (apiDataLoaded && Object.keys(bmlApiData).length > 0) {
        return bmlApiData;
    }

    bmlApiData = {};
    const extPath = (context && context.extensionPath) || (savedContext && savedContext.extensionPath) || undefined;

    // 1. Load extension bundled baseline/fallback JSON files
    API_FILES.forEach(({ baseName, category }) => {
        try {
            const fileData = loadJson(baseName, extPath);
            Object.entries(fileData).forEach(([key, val]) => {
                bmlApiData[key.toLowerCase()] = { ...val, category, name: key };
            });
        } catch (err) {
            console.error(`Failed to load ${baseName}.json:`, err.message);
        }
    });

    // 2. Prefer user workspace .cpq/cache first if present
    try {
        const { loadWorkspaceAttributes } = require('../rest/commerceAttributes');
        const roots = [];
        if (context && context.workspaceRoot) {
            roots.push(context.workspaceRoot);
        }
        if (context && Array.isArray(context.workspaceFolders)) {
            for (const f of context.workspaceFolders) {
                const p = f.uri ? f.uri.fsPath : (typeof f === 'string' ? f : null);
                if (p) roots.push(p);
            }
        }
        if (vscode && vscode.workspace && Array.isArray(vscode.workspace.workspaceFolders)) {
            for (const f of vscode.workspace.workspaceFolders) {
                const p = f.uri ? f.uri.fsPath : (typeof f === 'string' ? f : null);
                if (p) roots.push(p);
            }
        }

        for (const wsRoot of roots) {
            const wsIndex = loadWorkspaceAttributes(wsRoot);
            if (wsIndex && wsIndex.varNameToMeta) {
                for (const [varName, meta] of wsIndex.varNameToMeta.entries()) {
                    const key = varName.toLowerCase();
                    const isArraySet = meta.scope === 'Array Set' || meta.dataType === 'Array Set';
                    const isSystem = meta.scope === 'System';
                    const category = isArraySet ? 'attribute' : isSystem ? 'variable' : 'attribute';

                    const menuVals = Array.isArray(meta.menuOptions)
                        ? meta.menuOptions.map((m) => m.value || m.id)
                        : Array.isArray(meta.menuItems)
                          ? meta.menuItems.map((m) => m.value || m.id)
                          : null;

                    // Overwrite bundled entry with instance-specific workspace entry
                    bmlApiData[key] = {
                        name: varName,
                        label: meta.label || meta.name || varName,
                        syntax: varName,
                        category,
                        scope: meta.scope || (isArraySet ? 'Array Set' : 'Transaction'),
                        dataType: meta.dataType || meta.type || (isArraySet ? 'Array Set' : 'String'),
                        description: meta.description || meta.notes || '',
                        notes: meta.description || meta.notes || '',
                        menuOptions: meta.menuOptions || null,
                        values: menuVals || meta.values || null,
                        source: 'workspace-cache',
                        required: meta.required,
                        userDefault: meta.userDefault,
                        additional: meta.additional,
                        defaultDataType: meta.defaultDataType,
                        productFamily: meta.productFamily,
                        productLine: meta.productLine,
                    };
                }
            }
        }
    } catch (err) {
        // Fallback gracefully if workspace loading fails
    }

    apiDataLoaded = true;
    cachedGlobalItems = null;
    cachedTransactionItems = null;
    cachedLineItems = null;
    cachedSystemItems = null;
    cachedCpqjsItems = null;
    cachedAllAttributes = null;
    return bmlApiData;
}

function invalidateApiData() {
    apiDataLoaded = false;
    invalidateJsonCache();
}

function lookupApiInfo(word) {
    if (!apiDataLoaded || Object.keys(bmlApiData).length === 0) {
        loadApiData({ extensionPath: undefined });
    }
    const lower = word.toLowerCase();
    if (bmlApiData[lower]) return bmlApiData[lower];

    const lastDot = lower.lastIndexOf('.');
    if (lastDot !== -1) {
        return bmlApiData[lower.slice(lastDot + 1)];
    }
    return undefined;
}

const CATEGORY_KIND = {
    function: (vscode && vscode.CompletionItemKind && vscode.CompletionItemKind.Function) || 2,
    attribute: (vscode && vscode.CompletionItemKind && vscode.CompletionItemKind.Property) || 9,
    variable: (vscode && vscode.CompletionItemKind && vscode.CompletionItemKind.Variable) || 5,
    constant: (vscode && vscode.CompletionItemKind && vscode.CompletionItemKind.Constant) || 20,
    snippet: (vscode && vscode.CompletionItemKind && vscode.CompletionItemKind.Snippet) || 14,
    keyword: (vscode && vscode.CompletionItemKind && vscode.CompletionItemKind.Keyword) || 13,
};

function getBmlApiData(context) {
    if (!apiDataLoaded || Object.keys(bmlApiData).length === 0) {
        loadApiData(context || { extensionPath: undefined });
    }
    return bmlApiData;
}

module.exports = {
    loadApiData,
    invalidateApiData,
    lookupApiInfo,
    getBmlApiData,
    CATEGORY_KIND
};
