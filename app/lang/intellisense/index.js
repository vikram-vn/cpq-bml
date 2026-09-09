const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
    getWorkspaceIndex,
    registerWorkspaceIndexWatcher,
    resolveCallAtPosition,
} = require('./workspaceIndex');
const { formatAsJsDoc, formatWorkspaceFunctionHover, KEYWORD_HOVERS } = require('./docFormatting');
const { getActiveFunctionCall, parseParameters } = require('./signatureHelp');
const { resolveParameterCompletions } = require('./paramCompletions');
const { registerInlayHintsProvider } = require('./inlayHints');
const { getBmqlVariableCompletions, getLocalVariableCompletions } = require('./bmqlVariableCompletions');
const { createDefinitionProvider } = require('./definitionProvider');
const { createReferenceProvider } = require('./referenceProvider');

const {
    loadApiData,
    invalidateApiData,
    lookupApiInfo,
    getBmlApiData,
    CATEGORY_KIND
} = require('./apiData');

const {
    buildCategorizedItems,
    getCategorizedItems,
    invalidateCategorizedItems,
} = require('./categorizedItems');

/**
 * Detects variables used in a for loop iterating over transaction lines in the document.
 * Matches patterns like:
 *   for line in transactionLine
 *   for item in transactionLine
 *   for row in transaction_line
 *   for each in transactionLines
 *   for curLine in transactonLine
 */
function getTransactionLineLoopVariables(document) {
    const lineVars = new Set(['line', 'item', 'lineitem', 'eachline', 'curline', 'l']);
    if (!document) return lineVars;

    let fullText = '';
    if (typeof document.getText === 'function') {
        fullText = document.getText();
    } else if (typeof document.lineAt === 'function' && typeof document.lineCount === 'number') {
        const lines = [];
        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
        fullText = lines.join('\n');
    }

    if (!fullText) return lineVars;

    // Strip comments and string literals to avoid false positives
    const cleanCode = fullText
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/.*/g, ' ')
        .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, ' ');

    // Match: for <var> in <collection>
    const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_][\w.]*)/gi;
    let match;
    while ((match = loopRegex.exec(cleanCode)) !== null) {
        const varName = match[1].toLowerCase();
        const collection = match[2].toLowerCase().replace(/^(?:doc\.|commerce\.|transaction\.)+/, '');
        if (
            /^(?:transact?i?on_?lines?|line_?items?|lines)$/i.test(collection) ||
            collection.includes('transactionline') ||
            collection.includes('transactonline') ||
            collection.includes('lineitem')
        ) {
            lineVars.add(varName);
        }
    }

    return lineVars;
}

/**
 * Register Hover, Completion, and Signature Help providers for BML.
 */
function registerBmlIntelliSense(context) {
    loadApiData(context);

    // The API JSON files are static bundled resources; only reload them if
    // they actually change on disk (e.g. a maintainer re-running the
    // generator scripts, or `npm run compile` regenerating the .min.json
    // files loadJson() prefers), instead of re-reading/re-parsing on every
    // request.
    const apiFilesWatcher = vscode.workspace.createFileSystemWatcher(
        path.join(context.extensionPath, 'app', 'lang', 'intellisense', '*.json*')
    );
    const onCacheInvalidated = () => {
        invalidateApiData();
        invalidateCategorizedItems();
    };
    apiFilesWatcher.onDidChange(onCacheInvalidated);
    apiFilesWatcher.onDidCreate(onCacheInvalidated);
    apiFilesWatcher.onDidDelete(onCacheInvalidated);
    context.subscriptions.push(apiFilesWatcher);

    // Watch workspace .cpq cache files to immediately reflect synced metadata
    const cpqCacheWatcher = vscode.workspace.createFileSystemWatcher('**/.cpq/**');
    cpqCacheWatcher.onDidChange(onCacheInvalidated);
    cpqCacheWatcher.onDidCreate(onCacheInvalidated);
    cpqCacheWatcher.onDidDelete(onCacheInvalidated);
    context.subscriptions.push(cpqCacheWatcher);

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'bml',
        {
            provideCompletionItems(document, position, token) {
                if (token && token.isCancellationRequested) return null;
                if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                    return null;
                }
                loadApiData(context); // no-op unless the watcher invalidated the cache
                const cat = getCategorizedItems();

                // Check if typing $ for BMQL variable substitution
                const bmqlVarItems = getBmqlVariableCompletions(document, position);
                if (bmqlVarItems && bmqlVarItems.length > 0) {
                    return bmqlVarItems;
                }

                if (token && token.isCancellationRequested) return null;

                // Check if inside a function call expecting parameter completions
                const activeCall = getActiveFunctionCall(document, position);
                if (activeCall && activeCall.funcName) {
                    const paramCompletions = resolveParameterCompletions(activeCall, document, position);
                    if (paramCompletions) {
                        return paramCompletions;
                    }
                }

                const linePrefix = document.lineAt(position).text.substring(0, position.character);
                const objMatch = linePrefix.match(/(\b\w+)\s*\.\s*[\w_]*$/i);

                if (objMatch) {
                    const objName = objMatch[1].toLowerCase();
                    const lineVars = getTransactionLineLoopVariables(document);

                    if (objName === 'cpqjs') {
                        return cat.cpqjsItems;
                    } else if (lineVars.has(objName)) {
                        return cat.lineItems;
                    } else if (objName === 'transaction' || objName === 'trans' || objName === 't') {
                        return cat.transactionItems;
                    } else if (objName === 'arrayset' || objName === 'arraysets' || objName === 'arr' || objName === 'a') {
                        return cat.arraySetItems;
                    } else if (objName === 'config' || objName === 'cfg' || objName === 'model') {
                        return cat.configItems;
                    } else {
                        return [];
                    }
                }

                if (token && token.isCancellationRequested) return null;

                // General completion: merge local script variables with global API items
                const localVars = getLocalVariableCompletions(document, position);
                if (localVars && localVars.length > 0) {
                    return [...localVars, ...cat.globalItems];
                }

                return cat.globalItems;
            },
            resolveCompletionItem(item, token) {
                if (token && token.isCancellationRequested) return item;
                loadApiData(context);
                const apiData = getBmlApiData(context);
                let key = (typeof item.label === 'string' ? item.label : (item.label && item.label.label) || item.filterText || '').toLowerCase();
                if (item.kind === vscode.CompletionItemKind.Method) {
                    if (apiData['cpqjs.' + key]) {
                        key = 'cpqjs.' + key;
                    }
                }
                const info = apiData[key] || lookupApiInfo(key);
                if (info) {
                    item.documentation = formatAsJsDoc(info);
                }
                return item;
            }
        },
        '.', '(', '_', '$', '"', "'"
    );

    const hoverProvider = vscode.languages.registerHoverProvider('bml', {
        provideHover(document, position, token) {
            if (token && token.isCancellationRequested) return null;
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }
            loadApiData(context);

            const wsCall = resolveCallAtPosition(document, position);
            if (wsCall) {
                const wsIndex = getWorkspaceIndex();
                const wsInfo = wsIndex.get(wsCall.qualifiedName.toLowerCase());
                if (wsInfo) {
                    return new vscode.Hover(formatWorkspaceFunctionHover(wsInfo));
                }
            }

            const wordRange = document.getWordRangeAtPosition(position, /[\w._]+/);
            if (!wordRange) return null;

            const word = document.getText(wordRange);
            const lowerWord = word.toLowerCase();

            const info = lookupApiInfo(word);
            if (info) {
                return new vscode.Hover(formatAsJsDoc(info));
            }

            if (KEYWORD_HOVERS[lowerWord]) {
                return new vscode.Hover(formatAsJsDoc(KEYWORD_HOVERS[lowerWord]));
            }

            if (lowerWord.includes('.')) {
                const wsIndex = getWorkspaceIndex();
                if (wsIndex.has(lowerWord)) {
                    return new vscode.Hover(formatWorkspaceFunctionHover(wsIndex.get(lowerWord)));
                }
            }

            return null;
        }
    });

    const signatureProvider = vscode.languages.registerSignatureHelpProvider(
        'bml',
        {
            provideSignatureHelp(document, position, token) {
                if (token && token.isCancellationRequested) return null;
                if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                    return null;
                }
                loadApiData(context);

                const activeCall = getActiveFunctionCall(document, position);
                if (!activeCall || !activeCall.funcName) return null;

                const apiData = getBmlApiData(context);
                const info = apiData[activeCall.funcName.toLowerCase()] || lookupApiInfo(activeCall.funcName);
                if (!info) return null;

                const signatureHelp = new vscode.SignatureHelp();
                const signatureInfo = new vscode.SignatureInformation(info.fullSignature || info.syntax, formatAsJsDoc(info));
                
                signatureInfo.parameters = parseParameters(info.fullSignature || info.syntax, info);
                signatureHelp.signatures = [signatureInfo];
                signatureHelp.activeSignature = 0;
                signatureHelp.activeParameter = activeCall.paramIndex || 0;

                return signatureHelp;
            }
        },
        '(', ','
    );

    context.subscriptions.push(completionProvider, hoverProvider, signatureProvider);

    // ── Go to Definition ─────────────────────────────────────────────────────
    const definitionProvider = vscode.languages.registerDefinitionProvider('bml', createDefinitionProvider());
    context.subscriptions.push(definitionProvider);

    // ── Find All References ───────────────────────────────────────────────────
    const referenceProvider = vscode.languages.registerReferenceProvider('bml', createReferenceProvider());
    context.subscriptions.push(referenceProvider);

    // ── Rename Symbol ─────────────────────────────────────────────────────────
    const renameProvider = vscode.languages.registerRenameProvider('bml', {
        async provideRenameEdits(document, position, newName, token) {
            if (token && token.isCancellationRequested) return null;
            if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                return null;
            }
            const call = resolveCallAtPosition(document, position);
            if (!call) return null;
            const pattern = new RegExp(`\\b(${call.prefix})\.${call.name}\\b`, 'g');
            const uris = await vscode.workspace.findFiles('**/*.bml', '**/node_modules/**');
            const edit = new vscode.WorkspaceEdit();
            for (const uri of uris) {
                if (token && token.isCancellationRequested) return null;
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
        provideDocumentSymbols(document, token) {
            if (token && token.isCancellationRequested) return [];
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
                if (token && token.isCancellationRequested) return [];
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

    // Register workspace index file-system watchers
    registerWorkspaceIndexWatcher(context);

    // Register Inlay Hints Provider for parameter names inline
    const inlayHintsProvider = registerInlayHintsProvider(context);
    context.subscriptions.push(inlayHintsProvider);
}

module.exports = { registerBmlIntelliSense, getTransactionLineLoopVariables };
