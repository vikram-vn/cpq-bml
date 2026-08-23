const vscode = require('vscode');
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

function loadApiData(context) {
    if (apiDataLoaded) {
        return bmlApiData;
    }

    bmlApiData = {};
    API_FILES.forEach(({ baseName, category }) => {
        try {
            const fileData = loadJson(baseName, context.extensionPath);
            Object.entries(fileData).forEach(([key, val]) => {
                bmlApiData[key.toLowerCase()] = { ...val, category, name: key };
            });
        } catch (err) {
            console.error(`Failed to load ${baseName}.json:`, err.message);
        }
    });

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
    const lower = word.toLowerCase();
    if (bmlApiData[lower]) return bmlApiData[lower];

    const lastDot = lower.lastIndexOf('.');
    if (lastDot !== -1) {
        return bmlApiData[lower.slice(lastDot + 1)];
    }
    return undefined;
}

const CATEGORY_KIND = {
    function: vscode.CompletionItemKind.Function,
    attribute: vscode.CompletionItemKind.Property,
    variable: vscode.CompletionItemKind.Variable,
    constant: vscode.CompletionItemKind.Constant,
    snippet: vscode.CompletionItemKind.Snippet,
    keyword: vscode.CompletionItemKind.Keyword
};

function getBmlApiData() {
    return bmlApiData;
}

module.exports = {
    loadApiData,
    invalidateApiData,
    lookupApiInfo,
    getBmlApiData,
    CATEGORY_KIND
};
