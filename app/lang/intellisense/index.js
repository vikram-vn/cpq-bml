const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
    getWorkspaceIndex,
    registerWorkspaceIndexWatcher,
    resolveCallAtPosition,
    extractDocHeader,
} = require('./workspaceIndex');
const { formatAsJsDoc, formatWorkspaceFunctionHover, KEYWORD_HOVERS } = require('./docFormatting');
const { getActiveFunctionCall, parseParameters } = require('./signatureHelp');
const { loadJson, invalidateCache: invalidateJsonCache } = require('./apiDataLoader');
const { resolveParameterCompletions } = require('./paramCompletions');
const { registerInlayHintsProvider } = require('./inlayHints');
const { getBmqlVariableCompletions, getLocalVariableCompletions } = require('./bmqlVariableCompletions');

const {
    loadApiData,
    invalidateApiData,
    lookupApiInfo,
    getBmlApiData,
    CATEGORY_KIND
} = require('./apiData');

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
            item.sortText = `1_${strippedKey}`;
            cachedCpqjsItems.push(item);
            return;
        }

        if (info.category === 'attribute') {
            const item = new vscode.CompletionItem(info.name, vscode.CompletionItemKind.Property);
            item.detail = syntax;
            item.insertText = new vscode.SnippetString(syntax);
            item.filterText = key;
            item.sortText = `4_${key}`;

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

        let kind = CATEGORY_KIND[info.category] || vscode.CompletionItemKind.Text;
        let sortGroup = '2_';
        if (info.scope === 'CPQ Constant') {
            kind = vscode.CompletionItemKind.Constant;
            sortGroup = '3_';
        } else if (info.category === 'variable') {
            sortGroup = '1_';
        }

        const item = new vscode.CompletionItem(info.name, kind);
        item.detail = syntax;
        item.insertText = new vscode.SnippetString(syntax);
        item.filterText = key;
        item.sortText = `${sortGroup}${key}`;

        if (info.category === 'function') {
            item.commitCharacters = ['('];
            item.command = {
                command: 'editor.action.triggerParameterHints',
                title: 'Trigger Parameter Hints'
            };
        }

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
    // generator scripts, or `npm run compile` regenerating the .min.json
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

                // Check if typing $ for BMQL variable substitution
                const bmqlVarItems = getBmqlVariableCompletions(document, position);
                if (bmqlVarItems && bmqlVarItems.length > 0) {
                    return bmqlVarItems;
                }

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

                // General completion: merge local script variables with global API items
                const localVars = getLocalVariableCompletions(document, position);
                if (localVars && localVars.length > 0) {
                    return [...localVars, ...cachedGlobalItems];
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
                    item.documentation = formatAsJsDoc(info);
                }
                return item;
            }
        },
        '.', '(', '_', '"', '\'', ',', '+', '-', '/', ':', '$'
    );

    const hoverProvider = vscode.languages.registerHoverProvider('bml', {
        provideHover(document, position) {
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

            const wsIndex = getWorkspaceIndex();
            if (wsIndex.has(lowerWord)) {
                return new vscode.Hover(formatWorkspaceFunctionHover(wsIndex.get(lowerWord)));
            }

            const info = lookupApiInfo(word);
            if (info) {
                return new vscode.Hover(formatAsJsDoc(info));
            }

            if (KEYWORD_HOVERS[lowerWord]) {
                return new vscode.Hover(formatAsJsDoc(KEYWORD_HOVERS[lowerWord]));
            }

            return null;
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
                const signatureInfo = new vscode.SignatureInformation(info.fullSignature || info.syntax, formatAsJsDoc(info));
                
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

    // Register Inlay Hints Provider for parameter names inline
    const inlayHintsProvider = registerInlayHintsProvider(context);
    context.subscriptions.push(inlayHintsProvider);
}

module.exports = { registerBmlIntelliSense };
