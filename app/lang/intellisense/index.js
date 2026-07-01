const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
    getWorkspaceIndex,
    registerWorkspaceIndexWatcher,
    resolveCallAtPosition,
    extractDocHeader,
} = require('./workspaceIndex');

// Each source file holds a different kind of entry. Tracking that here gives
// accurate completion icons/hover labels - "does this syntax contain '(' "
// is not reliable: custom_snippets.json bodies contain calls like print(...)
// even though the entry itself is a snippet, not a function.
const API_FILES = [
    { fileName: 'bml_attributes_api_usage.json', category: 'attribute' },
    { fileName: 'bml_util_attributes_api_usage.json', category: 'attribute' },
    { fileName: 'bml_variables_api_usage.json', category: 'variable' },
    { fileName: 'bml_functions_api_usage.json', category: 'function' },
    { fileName: 'bml_cpq_js_api_usage.json', category: 'function' },
    { fileName: 'custom_snippets.json', category: 'snippet' }
];

const CACHE_TTL_MS = 30000;

let bmlApiData = {};
let apiLoadTime = 0;
let cachedGlobalItems = null;
let cachedTransactionItems = null;
let cachedLineItems = null;
let cachedSystemItems = null;
let cachedCpqjsItems = null;
let cachedAllAttributes = null;

/**
 * Load and merge the BML API JSON files, tagging each entry with which file
 * it came from. Cached to avoid reparsing on every completion/hover request.
 */
function loadApiData(context) {
    if (Object.keys(bmlApiData).length && Date.now() - apiLoadTime < CACHE_TTL_MS) {
        return bmlApiData;
    }

    bmlApiData = {};
    API_FILES.forEach(({ fileName, category }) => {
        const apiFilePath = path.join(context.extensionPath, 'app', 'lang', 'intellisense', fileName);
        try {
            const fileData = JSON.parse(fs.readFileSync(apiFilePath, 'utf8'));
            Object.entries(fileData).forEach(([key, val]) => {
                bmlApiData[key.toLowerCase()] = { ...val, category, name: key };
            });
        } catch (err) {
            console.error(`Failed to load ${fileName}:`, err.message);
        }
    });

    apiLoadTime = Date.now();
    cachedGlobalItems = null;
    cachedTransactionItems = null;
    cachedLineItems = null;
    cachedSystemItems = null;
    cachedCpqjsItems = null;
    cachedAllAttributes = null;
    return bmlApiData;
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

function decodeHtmlEntities(str) {
    if (!str) return '';
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

const CATEGORY_LABEL = {
    function: 'function',
    attribute: 'attribute',
    variable: 'variable',
    snippet: 'snippet'
};

// Maps common.json's "category" field to the grammar's entity.name.function.* sub-scopes.
const FUNCTION_CATEGORY_LABEL = {
    direct_db_access: 'database',
    others: 'misc'
};

/**
 * Builds the "*scope · type*" (or "*category function*") metadata line shown
 * under the syntax block. Returns '' when there's nothing to show.
 */
function buildMetadataLine(info) {
    if (info.category === 'function') {
        if (!info.functionCategory) return '';
        const label = FUNCTION_CATEGORY_LABEL[info.functionCategory] || info.functionCategory;
        return `*${label} function*`;
    }
    const parts = [info.scope, info.dataType].filter(Boolean);
    return parts.length ? `*${parts.join(' · ')}*` : '';
}

// Requires no space before "(" so English asides like "by default (see below)" aren't misread as calls.
const INLINE_CALL_RE = /\b[a-zA-Z_][\w.]*\([^()]*(?:\([^()]*\)[^()]*)*\)/g;

function highlightInlineCode(text) {
    return text.replace(INLINE_CALL_RE, match => `\`${match}\``);
}

// A leading "1." marks a numbered prose usage note rather than runnable code (which never starts that way).
function isProseExample(example) {
    return /^\s*\d+\.\s/.test(example);
}

/**
 * Build a Markdown tooltip with syntax, scope/type, notes, and examples.
 */
function formatAsJsDoc(info) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    const label = CATEGORY_LABEL[info.category] || 'symbol';
    const signature = info.fullSignature || info.syntax;
    if (signature) {
        md.appendCodeblock(`(${label}) ${decodeHtmlEntities(signature)}`, 'bml');
    }

    const metadataLine = buildMetadataLine(info);
    if (metadataLine) {
        md.appendMarkdown(`${metadataLine}\n\n`);
    }

    if (info.notes) {
        md.appendMarkdown(`${highlightInlineCode(decodeHtmlEntities(info.notes))}\n`);
    }

    if (info.values?.length) {
        md.appendMarkdown(`\n**Values:** ${info.values.map(v => `\`${v}\``).join(', ')}\n`);
    }

    if (info.examples?.length) {
        const heading = info.examples.every(isProseExample) ? 'Usage Notes' : 'Example';
        md.appendMarkdown(`\n**${heading}${info.examples.length > 1 ? 's' : ''}:**\n`);
        info.examples.forEach(ex => {
            const decoded = decodeHtmlEntities(ex);
            if (isProseExample(decoded)) {
                md.appendMarkdown(`\n${highlightInlineCode(decoded)}\n`);
            } else {
                md.appendCodeblock(decoded, 'bml');
            }
        });
    }

    return md;
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
 * Walks forward from start of document to cursor to parse active function call and parameter index.
 * Ignores brackets/commas inside strings and comments.
 */
function getActiveFunctionCall(document, position) {
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const stack = [];
    const KEYWORDS = new Set(['if', 'elif', 'else', 'for', 'while', 'return']);
    let i = 0;
    
    while (i < text.length) {
        const char = text[i];

        if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
                i++;
            }
            continue;
        }

        if (char === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                i++;
            }
            i += 2;
            continue;
        }

        if (char === '"') {
            i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++;
            continue;
        }

        if (char === "'") {
            i++;
            while (i < text.length && text[i] !== "'") {
                if (text[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++;
            continue;
        }

        if (char === '(') {
            let endIdx = i;
            let startIdx = i - 1;
            while (startIdx >= 0 && /\s/.test(text[startIdx])) {
                startIdx--;
            }
            let idEnd = startIdx + 1;
            while (startIdx >= 0 && /[\w.]/.test(text[startIdx])) {
                startIdx--;
            }
            const funcName = text.substring(startIdx + 1, idEnd).trim();
            if (/^[a-zA-Z_]/.test(funcName) && !KEYWORDS.has(funcName.toLowerCase())) {
                stack.push({ funcName, paramIndex: 0 });
            } else {
                stack.push({ funcName: '', paramIndex: 0 });
            }
        } else if (char === ')') {
            if (stack.length > 0) {
                stack.pop();
            }
        } else if (char === ',') {
            if (stack.length > 0) {
                stack[stack.length - 1].paramIndex++;
            }
        }
        
        i++;
    }
    
    for (let j = stack.length - 1; j >= 0; j--) {
        if (stack[j].funcName) {
            return stack[j];
        }
    }
    
    return null;
}

/**
 * Helper to parse ParameterInformation objects from signature string.
 */
function parseParameters(signature) {
    const match = signature.match(/\((.*)\)/);
    if (!match) return [];
    const paramStr = match[1].trim();
    if (!paramStr) return [];
    return paramStr.split(',').map(p => {
        const label = p.replace(/[\[\]]/g, '').trim();
        return new vscode.ParameterInformation(label);
    });
}

/**
 * Register Hover, Completion, and Signature Help providers for BML.
 */
function registerBmlIntelliSense(context) {
    loadApiData(context);

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'bml',
        {
            provideCompletionItems(document, position) {
                if (!vscode.workspace.getConfiguration('cpqBml').get('features.intellisense', true)) {
                    return null;
                }
                loadApiData(context); // reload if updated externally
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
                    item.documentation = formatAsJsDoc(info);
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
            return info ? new vscode.Hover(formatAsJsDoc(info)) : null;
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
}

module.exports = { registerBmlIntelliSense };
