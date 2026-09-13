const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
    getWorkspaceIndex,
    registerWorkspaceIndexWatcher,
    resolveCallAtPosition,
} = require('@/lang/intellisense/workspaceIndex');
const { formatAsJsDoc, formatWorkspaceFunctionHover, KEYWORD_HOVERS } = require('@/lang/intellisense/docFormatting');
const { getActiveFunctionCall, parseParameters } = require('@/lang/intellisense/signatureHelp');
const { resolveParameterCompletions } = require('@/lang/intellisense/paramCompletions');
const { registerInlayHintsProvider } = require('@/lang/intellisense/inlayHints');
const { getBmqlVariableCompletions, getLocalVariableCompletions } = require('@/lang/intellisense/bmqlVariableCompletions');
const { getBmqlIntelligentCompletions } = require('@/lang/bmql/bmqlIntellisense');
const { createDefinitionProvider } = require('@/lang/intellisense/definitionProvider');
const { createReferenceProvider } = require('@/lang/intellisense/referenceProvider');
const { createCallHierarchyProvider } = require('@/lang/intellisense/callHierarchyProvider');
const { adaptCompletionsForLineContext } = require('@/lang/intellisense/completionContext');
const commerceAttributes = require('@/lang/rest/commerceAttributes');

const {
    loadApiData,
    invalidateApiData,
    lookupApiInfo,
    getBmlApiData,
    CATEGORY_KIND
} = require('@/lang/intellisense/apiData');

const {
    buildCategorizedItems,
    getCategorizedItems,
    invalidateCategorizedItems,
} = require('@/lang/intellisense/categorizedItems');

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

    // Watch workspace cpq cache files to immediately reflect synced metadata
    const cpqCacheWatcher = vscode.workspace.createFileSystemWatcher('**/cpq/**');
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

                // Check for intelligent BMQL query autocomplete (tables, columns, operators, record fields)
                const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
                    ? vscode.workspace.workspaceFolders[0].uri.fsPath
                    : null;
                const bmqlIntelligentItems = getBmqlIntelligentCompletions(document, position, wsRoot, vscode);
                if (bmqlIntelligentItems && bmqlIntelligentItems.length > 0) {
                    return bmqlIntelligentItems;
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
                        return adaptCompletionsForLineContext(cat.cpqjsItems, document, position);
                    } else if (lineVars.has(objName)) {
                        return adaptCompletionsForLineContext(cat.lineItems, document, position);
                    } else if (objName === 'transaction' || objName === 'trans' || objName === 't') {
                        return adaptCompletionsForLineContext(cat.transactionItems, document, position);
                    } else if (objName === 'arrayset' || objName === 'arraysets' || objName === 'arr' || objName === 'a') {
                        return adaptCompletionsForLineContext(cat.arraySetItems, document, position);
                    } else if (objName === 'config' || objName === 'cfg' || objName === 'model') {
                        return adaptCompletionsForLineContext(cat.configItems, document, position);
                    } else {
                        return new vscode.CompletionList([], false);
                    }
                }

                if (token && token.isCancellationRequested) return null;

                // General completion: merge local script variables with global API items
                const localVars = getLocalVariableCompletions(document, position);
                if (localVars && localVars.length > 0) {
                    return adaptCompletionsForLineContext([...localVars, ...cat.globalItems], document, position);
                }

                return adaptCompletionsForLineContext(cat.globalItems, document, position);
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
        '.', '(', '_', '$', '"', "'", ','
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

            // Check CPQ Commerce & Configuration Attributes
            try {
                const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                    ? vscode.workspace.workspaceFolders[0].uri.fsPath
                    : null;
                let attr = null;
                if (commerceAttributes && typeof commerceAttributes.loadWorkspaceAttributes === 'function') {
                    const wsIndex = commerceAttributes.loadWorkspaceAttributes(wsRoot);
                    if (wsIndex && wsIndex.varNameToMeta && wsIndex.varNameToMeta.has(word)) {
                        attr = wsIndex.varNameToMeta.get(word);
                    }
                }
                if (!attr && commerceAttributes && typeof commerceAttributes.loadBundledAttributes === 'function') {
                    const bundled = commerceAttributes.loadBundledAttributes();
                    if (bundled && bundled.varNameToMeta && bundled.varNameToMeta.has(word)) {
                        attr = bundled.varNameToMeta.get(word);
                    }
                }
                if (attr) {
                    const md = new vscode.MarkdownString();
                    md.appendMarkdown(`### CPQ Attribute: \`${attr.name || attr.variableName || word}\`\n\n`);
                    if (attr.label) md.appendMarkdown(`**Label**: ${attr.label}  \n`);
                    if (attr.dataType || attr.type) md.appendMarkdown(`**Data Type**: \`${attr.dataType || attr.type}\`  \n`);
                    if (attr.document || attr.scope) md.appendMarkdown(`**Scope**: \`${attr.document || attr.scope}\`  \n`);
                    if (attr.description || attr.notes) md.appendMarkdown(`**Description**: ${attr.description || attr.notes}  \n`);
                    if (attr.defaultValue) md.appendMarkdown(`**Default Value**: \`${attr.defaultValue}\`  \n`);
                    return new vscode.Hover(md);
                }

                // Check Data Table context in BMQL
                const lineText = document.lineAt(position.line).text;
                const prefix = lineText.substring(0, wordRange.end.character);
                if (/\b(?:FROM|INTO|UPDATE)\s+[\w.]*$/i.test(prefix)) {
                    const md = new vscode.MarkdownString();
                    md.appendMarkdown(`### CPQ Data Table: \`${word}\`\n\n`);
                    md.appendMarkdown(`*Click or execute BMQL to query live rows from this table.*\n\n`);
                    md.appendMarkdown(`[▶ Run BMQL Live](command:cpqBml.bmql.runAtCursor) | [Lookup Schema](command:cpqBml.rest.lookupAttributeAtCursor)\n`);
                    md.isTrusted = true;
                    return new vscode.Hover(md);
                }
            } catch (_) {}

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

    // ── Call Hierarchy ────────────────────────────────────────────────────────
    const callHierarchyProvider = vscode.languages.registerCallHierarchyProvider('bml', createCallHierarchyProvider());
    context.subscriptions.push(callHierarchyProvider);

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
