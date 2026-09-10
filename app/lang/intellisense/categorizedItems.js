let vscode;
try {
    vscode = require('vscode');
} catch {
    vscode = {
        CompletionItem: function (label, kind) { this.label = label; this.kind = kind; },
        CompletionItemKind: { Class: 7, Method: 2, Property: 10, Field: 5 },
        SnippetString: function (s) { this.value = s; }
    };
}
const { getBmlApiData, CATEGORY_KIND } = require('./apiData');
const { formatAsJsDoc } = require('./docFormatting');

let cachedGlobalItems = null;
let cachedTransactionItems = null;
let cachedLineItems = null;
let cachedSystemItems = null;
let cachedArraySetItems = null;
let cachedConfigItems = null;
let cachedCpqjsItems = null;
let cachedAllAttributes = null;

function invalidateCategorizedItems() {
    cachedGlobalItems = null;
    cachedTransactionItems = null;
    cachedLineItems = null;
    cachedSystemItems = null;
    cachedArraySetItems = null;
    cachedConfigItems = null;
    cachedCpqjsItems = null;
    cachedAllAttributes = null;
}

function buildCategorizedItems() {
    cachedGlobalItems = [];
    cachedTransactionItems = [];
    cachedLineItems = [];
    cachedSystemItems = [];
    cachedArraySetItems = [];
    cachedConfigItems = [];
    cachedCpqjsItems = [];
    cachedAllAttributes = [];

    const cpqjsItem = new vscode.CompletionItem('CPQJS', vscode.CompletionItemKind.Class);
    cpqjsItem.detail = 'CPQJS API Object';
    cpqjsItem.insertText = 'CPQJS';
    cachedGlobalItems.push(cpqjsItem);

    Object.entries(getBmlApiData()).forEach(([key, info]) => {
        const syntax = info.syntax || info.name;

        if (key.startsWith('cpqjs.')) {
            const strippedName = info.name.replace(/^CPQJS\./i, '');
            const strippedSyntax = syntax.replace(/^CPQJS\./i, '');
            const strippedKey = key.replace(/^cpqjs\./i, '');

            const item = new vscode.CompletionItem(strippedName, vscode.CompletionItemKind.Method);
            item.detail = syntax;
            item.insertText = new vscode.SnippetString(strippedSyntax);
            item.filterText = strippedKey;
            item.sortText = `1_${strippedKey}`;
            cachedCpqjsItems.push(item);
            return;
        }

        if (info.category === 'attribute') {
            const attrName = (info.name || key).replace(/^util\./i, '');
            const cleanSyntax = (syntax || attrName).replace(/^util\./i, '');
            const cleanKey = key.replace(/^util\./i, '');
            const cleanScope = (info.scope || '').replace(/^util\./i, '').trim();

            const isSynced = (info.source === 'workspace-cache');

            const item = new vscode.CompletionItem(attrName, vscode.CompletionItemKind.Property);
            item.detail = isSynced ? `${cleanSyntax} (Synced)` : cleanSyntax;
            item.insertText = new vscode.SnippetString(cleanSyntax);
            item.filterText = cleanKey;
            item.sortText = isSynced ? `0_${cleanKey}` : `4_${cleanKey}`;
            item.documentation = formatAsJsDoc(info);

            cachedAllAttributes.push(item);

            if (cleanScope === 'Transaction') {
                cachedTransactionItems.push(item);
                cachedGlobalItems.push(item);
            } else if (cleanScope === 'Line Item') {
                cachedLineItems.push(item);
            } else if (cleanScope === 'System') {
                cachedSystemItems.push(item);
                cachedGlobalItems.push(item);
            } else if (cleanScope === 'Array Set' || info.dataType === 'Array Set') {
                cachedArraySetItems.push(item);
            } else if (cleanScope === 'Configuration' || cleanScope === 'Model' || cleanScope === 'Product Family') {
                cachedConfigItems.push(item);
                cachedGlobalItems.push(item);
            } else {
                cachedGlobalItems.push(item);
            }
            return;
        }

        let kind = CATEGORY_KIND[info.category] || vscode.CompletionItemKind.Text;
        let sortGroup = '2_';
        if (info.scope === 'CPQ Constant') {
            kind = vscode.CompletionItemKind.Constant;
            sortGroup = '3_';
        } else if (info.category === 'variable') {
            sortGroup = '1_';
        }

        const isControlFlow = key.startsWith('if') || key.startsWith('for') || key === 'break' || key === 'continue' || key === 'return' || (info.functionCategory && info.functionCategory.toLowerCase() === 'logical');
        if (isControlFlow) {
            kind = vscode.CompletionItemKind.Snippet;
        }

        const item = new vscode.CompletionItem(info.name, kind);
        item.detail = syntax;
        item.insertText = new vscode.SnippetString(syntax);
        item.filterText = key;
        item.sortText = `${sortGroup}${key}`;
        item.documentation = formatAsJsDoc(info);

        if (info.category === 'function' && !isControlFlow) {
            item.command = {
                command: 'editor.action.triggerParameterHints',
                title: 'Trigger Parameter Hints'
            };
        }

        cachedGlobalItems.push(item);
    });
}

function getCategorizedItems() {
    if (!cachedGlobalItems) {
        buildCategorizedItems();
    }
    return {
        globalItems: cachedGlobalItems,
        transactionItems: cachedTransactionItems,
        lineItems: cachedLineItems,
        systemItems: cachedSystemItems,
        arraySetItems: cachedArraySetItems,
        configItems: cachedConfigItems,
        cpqjsItems: cachedCpqjsItems,
        allAttributes: cachedAllAttributes,
    };
}

module.exports = {
    buildCategorizedItems,
    getCategorizedItems,
    invalidateCategorizedItems,
};
