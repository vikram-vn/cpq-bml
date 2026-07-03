const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
    getWorkspaceIndex,
    registerWorkspaceIndexWatcher,
    resolveCallAtPosition,
    extractDocHeader,
} = require('./workspaceIndex');
const { openHelpTopic } = require('./helpViewer');
const { formatAsJsDoc } = require('./docFormatting');
const { getActiveFunctionCall, parseParameters } = require('./signatureHelp');
const { loadJson, invalidateCache: invalidateJsonCache } = require('./apiDataLoader');

// Each source file holds a different kind of entry. Tracking that here gives
// accurate completion icons/hover labels - "does this syntax contain '(' "
// is not reliable: custom_snippets.json bodies contain calls like print(...)
// even though the entry itself is a snippet, not a function.
const API_FILES = [
    { baseName: 'bml_attributes_api_usage', category: 'attribute' },
    { baseName: 'bml_util_attributes_api_usage', category: 'attribute' },
    { baseName: 'bml_variables_api_usage', category: 'variable' },
    { baseName: 'bml_functions_api_usage', category: 'function' },
    { baseName: 'bml_cpq_js_api_usage', category: 'function' },
    { baseName: 'custom_snippets', category: 'snippet' }
];

let bmlApiData = {};
let apiDataLoaded = false;
let cachedGlobalItems = null;
let cachedTransactionItems = null;
let cachedLineItems = null;
let cachedSystemItems = null;
let cachedCpqjsItems = null;
let cachedAllAttributes = null;

/**
 * Load and merge the BML API JSON files, tagging each entry with which file
 * it came from. These are static bundled resources, so this only ever reads
 * from disk once per extension-host session; registerBmlIntelliSense() wires
 * up a file watcher to invalidate the cache if they're regenerated on disk
 * (e.g. via `yarn generate:intellisense` while VS Code is open).
 */
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

/**
 * Drop the cached API data so the next loadApiData() call reloads it from disk.
 */
function invalidateApiData() {
    apiDataLoaded = false;
    invalidateJsonCache();
}

/**
 * Look up API info for a word under the cursor. Tries the word as-is first
 * (covers dotted keys like "CPQJS.actionExists"), then falls back to the
 * segment after the last "." (covers attribute access like "line.quantity_c",
 * where the data is keyed as "quantity_c" with no object prefix).
 */
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
    attribute: vscode.CompletionItemKind.Field,
    variable: vscode.CompletionItemKind.Variable,
    snippet: vscode.CompletionItemKind.Snippet
};

/**
 * Builds the categorized completion item lists once per data generation.
 */
function buildCategorizedItems() {
    cachedGlobalItems = [];
    cachedTransactionItems = [];
    cachedLineItems = [];
    cachedSystemItems = [];
    cachedCpqjsItems = [];
    cachedAllAttributes = [];

    const cpqjsItem = new vscode.CompletionItem('CPQJS', vscode.CompletionItemKind.Class);
    cpqjsItem.detail = 'CPQJS API Object';
    cpqjsItem.insertText = 'CPQJS';
    cachedGlobalItems.push(cpqjsItem);

    Object.entries(bmlApiData).forEach(([key, info]) => {
        const syntax = info.syntax || info.name;

        if (key.startsWith('cpqjs.')) {
            const strippedName = info.name.replace(/^CPQJS\./i, '');
            const strippedSyntax = syntax.replace(/^CPQJS\./i, '');
            const strippedKey = key.replace(/^cpqjs\./i, '');

            const item = new vscode.CompletionItem(strippedName, vscode.CompletionItemKind.Method);
            item.detail = syntax;
            item.insertText = new vscode.SnippetString(strippedSyntax);
            item.filterText = strippedKey;
            cachedCpqjsItems.push(item);
            return;
        }

        if (info.category === 'attribute') {
            const item = new vscode.CompletionItem(info.name, vscode.CompletionItemKind.Field);
            item.detail = syntax;
            item.insertText = new vscode.SnippetString(syntax);
            item.filterText = key;

            cachedAllAttributes.push(item);

            if (info.scope === 'Transaction') {
                cachedTransactionItems.push(item);
            } else if (info.scope === 'Line Item') {
                cachedLineItems.push(item);
            } else if (info.scope === 'System') {
                cachedSystemItems.push(item);
            } else {
                cachedGlobalItems.push(item);
            }
            return;
        }

        const kind = CATEGORY_KIND[info.category] || vscode.CompletionItemKind.Text;
        const item = new vscode.CompletionItem(info.name, kind);
        item.detail = syntax;
        item.insertText = new vscode.SnippetString(syntax);
        item.filterText = key;
        cachedGlobalItems.push(item);
    });
}

/**
 * Register Hover, Completion, and Signature Help providers for BML.
 */
function registerBmlIntelliSense(context) {
    loadApiData(context);

    // The API JSON files are static bundled resources; only reload them if
    // they actually change on disk (e.g. a maintainer re-running the
    // generator scripts, or `npm run compile` regenerating the .json.br
    // files loadJson() prefers), instead of re-reading/re-parsing on every
    // request.
    const apiFilesWatcher = vscode.workspace.createFileSystemWatcher(
        path.join(context.extensionPath, 'app', 'lang', 'intellisense', '*.json*')
    );
    apiFilesWatcher.onDidChange(invalidateApiData);
    apiFilesWatcher.onDidCreate(invalidateApiData);
    apiFilesWatcher.onDidDelete(invalidateApiData);
    context.subscriptions.push(apiFilesWatcher);

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'bml',
        {
            provideCompletionItems(document, position) {
                if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                    return null;
                }
                loadApiData(context); // no-op unless the watcher invalidated the cache
                if (!cachedGlobalItems) {
                    buildCategorizedItems();
                }

                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                const objMatch = linePrefix.match(/(\b\w+)\s*\.\s*[\w_]*$/i);

                if (objMatch) {
                    const objName = objMatch[1].toLowerCase();
                    if (objName === 'cpqjs') {
                        return cachedCpqjsItems;
                    } else if (objName === 'transaction' || objName === 'trans' || objName === 't') {
                        return cachedTransactionItems;
                    } else if (objName === 'line' || objName === 'each' || objName === 'item' || objName === 'l') {
                        return cachedLineItems;
                    } else {
                        return cachedAllAttributes;
                    }
                }

                return cachedGlobalItems;
            },
            resolveCompletionItem(item) {
                let key = item.filterText;
                if (item.kind === vscode.CompletionItemKind.Method) {
                    if (bmlApiData['cpqjs.' + key]) {
                        key = 'cpqjs.' + key;
                    }
                }
                const info = bmlApiData[key];
                if (info) {
                    item.documentation = formatAsJsDoc(info, context);
                }
                return item;
            }
        },
        '.', '(', '_'
    );

    const hoverProvider = vscode.languages.registerHoverProvider('bml', {
        provideHover(document, position) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }
            const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
            if (!wordRange) return null;

            const info = lookupApiInfo(document.getText(wordRange));
            return info ? new vscode.Hover(formatAsJsDoc(info, context)) : null;
        }
    });

    const signatureProvider = vscode.languages.registerSignatureHelpProvider(
        'bml',
        {
            provideSignatureHelp(document, position) {
                if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                    return null;
                }
                loadApiData(context);

                const activeCall = getActiveFunctionCall(document, position);
                if (!activeCall) return null;

                const { funcName, paramIndex } = activeCall;
                const info = bmlApiData[funcName.toLowerCase()];
                if (!info || info.category !== 'function') return null;

                const signatureHelp = new vscode.SignatureHelp();
                const signatureInfo = new vscode.SignatureInformation(info.fullSignature || info.syntax, formatAsJsDoc(info, context));
                
                signatureInfo.parameters = parseParameters(info.fullSignature || info.syntax);
                signatureHelp.signatures = [signatureInfo];
                signatureHelp.activeSignature = 0;
                signatureHelp.activeParameter = Math.min(paramIndex, signatureInfo.parameters.length ? signatureInfo.parameters.length - 1 : 0);

                return signatureHelp;
            }
        },
        '(', ','
    );

    context.subscriptions.push(completionProvider, hoverProvider, signatureProvider);

    // Register command to open help topics in the fast, admonition-aware
    // offline help viewer (see helpViewer.js).
    const openCommand = vscode.commands.registerCommand('cpqBml.openHelpTopic', (uriString) => {
        try {
            const uri = vscode.Uri.parse(uriString);
            openHelpTopic(context, uri.fsPath, uri.fragment);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to open help topic: ${err.message}`);
        }
    });
    context.subscriptions.push(openCommand);

    // ── Go to Definition ─────────────────────────────────────────────────────
    const definitionProvider = vscode.languages.registerDefinitionProvider('bml', {
        provideDefinition(document, position) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }
            const call = resolveCallAtPosition(document, position);
            if (!call) return null;
            const entry = getWorkspaceIndex().get(call.qualifiedName);
            if (!entry) return null;
            const uri = vscode.Uri.file(entry.filePath);
            const loc = new vscode.Location(uri, new vscode.Position(entry.line, 0));
            return loc;
        }
    });
    context.subscriptions.push(definitionProvider);

    // ── Find All References ───────────────────────────────────────────────────
    const referenceProvider = vscode.languages.registerReferenceProvider('bml', {
        async provideReferences(document, position) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return [];
            }
            const call = resolveCallAtPosition(document, position);
            if (!call) return [];
            const pattern = new RegExp(`\\b${call.prefix}\.${call.name}\\b`, 'g');
            const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
            const locations = [];
            for (const uri of uris) {
                let text;
                try { text = fs.readFileSync(uri.fsPath, 'utf8'); } catch { continue; }
                const lines = text.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    let m;
                    pattern.lastIndex = 0;
                    while ((m = pattern.exec(lines[i])) !== null) {
                        locations.push(new vscode.Location(
                            uri,
                            new vscode.Range(i, m.index, i, m.index + m[0].length)
                        ));
                    }
                }
            }
            return locations;
        }
    });
    context.subscriptions.push(referenceProvider);

    // ── Rename Symbol ─────────────────────────────────────────────────────────
    const renameProvider = vscode.languages.registerRenameProvider('bml', {
        async provideRenameEdits(document, position, newName) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }
            const call = resolveCallAtPosition(document, position);
            if (!call) return null;
            const pattern = new RegExp(`\\b(${call.prefix})\.${call.name}\\b`, 'g');
            const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
            const edit = new vscode.WorkspaceEdit();
            for (const uri of uris) {
                let text;
                try { text = fs.readFileSync(uri.fsPath, 'utf8'); } catch { continue; }
                const lines = text.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    let m;
                    pattern.lastIndex = 0;
                    while ((m = pattern.exec(lines[i])) !== null) {
                        edit.replace(
                            uri,
                            new vscode.Range(i, m.index, i, m.index + m[0].length),
                            `${m[1]}.${newName}`
                        );
                    }
                }
            }
            return edit;
        },
        prepareRename(document, position) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                throw new Error('Rename is only supported when IntelliSense is enabled.');
            }
            const call = resolveCallAtPosition(document, position);
            if (!call) throw new Error('Rename is only supported on util.* or commerce.* function calls.');
            const lineText = document.lineAt(position).text;
            const nameStart = lineText.indexOf(call.name, lineText.indexOf(call.prefix + '.'));
            return new vscode.Range(position.line, nameStart, position.line, nameStart + call.name.length);
        }
    });
    context.subscriptions.push(renameProvider);

    // ── Document Symbols (breadcrumb / outline) ───────────────────────────────
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider('bml', {
        provideDocumentSymbols(document) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return [];
            }
            const symbols = [];
            const text = document.getText();
            const lines = text.split(/\r?\n/);
            const blockStack = []; // stack of { symbol, depth }
            let braceDepth = 0;

            const controlRe = /^\s*(if|elif|else|for)\b(.*)?\{\s*$/i;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const cm = controlRe.exec(line);
                if (cm) {
                    const keyword = cm[1];
                    const condition = (cm[2] || '').replace(/\{\s*$/, '').trim();
                    const label = condition ? `${keyword} (${condition.slice(0, 40)})` : keyword;
                    const sym = new vscode.DocumentSymbol(
                        label,
                        '',
                        vscode.SymbolKind.Module,
                        new vscode.Range(i, 0, i, line.length),
                        new vscode.Range(i, 0, i, line.length)
                    );
                    if (blockStack.length > 0) {
                        blockStack[blockStack.length - 1].symbol.children.push(sym);
                    } else {
                        symbols.push(sym);
                    }
                    blockStack.push({ symbol: sym, depth: braceDepth + 1 });
                }
                // Track braces to know when a block closes
                for (const ch of line) {
                    if (ch === '{') braceDepth++;
                    else if (ch === '}') {
                        braceDepth--;
                        if (blockStack.length > 0 && braceDepth < blockStack[blockStack.length - 1].depth) {
                            const closed = blockStack.pop();
                            closed.symbol.range = new vscode.Range(
                                closed.symbol.range.start, new vscode.Position(i, line.length)
                            );
                        }
                    }
                }
            }
            return symbols;
        }
    });
    context.subscriptions.push(symbolProvider);

    // ── Extended hover: workspace functions ──────────────────────────────────
    // The existing hoverProvider covers built-ins; add a second provider for
    // workspace util.* / commerce.* functions.
    const workspaceHoverProvider = vscode.languages.registerHoverProvider('bml', {
        provideHover(document, position) {
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }
            const call = resolveCallAtPosition(document, position);
            if (!call) return null;
            const entry = getWorkspaceIndex().get(call.qualifiedName);
            if (!entry) return null;

            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            const paramStr = entry.parameters.map(p => `${p.dataType} ${p.name}`).join(', ');
            md.appendCodeblock(`(workspace function) ${call.qualifiedName}(${paramStr})`, 'bml');
            if (entry.returnType) md.appendMarkdown(`*Returns: ${entry.returnType}*\n\n`);
            if (entry.docHeader) md.appendMarkdown(entry.docHeader + '\n\n');
            md.appendMarkdown(`[Go to source](${vscode.Uri.file(entry.filePath).toString()})`);
            return new vscode.Hover(md);
        }
    });
    context.subscriptions.push(workspaceHoverProvider);

    // Register workspace index file-system watchers
    registerWorkspaceIndexWatcher(context);
}

module.exports = { registerBmlIntelliSense };
