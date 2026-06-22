const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
                // Normalize all keys to lowercase for case-insensitive lookups
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

// The source JSON is plain text - the only non-literal markup actually present
// is a handful of HTML character entities (&#32;, &#160;, &lt;, &gt;) left over
// from how Oracle's docs were exported. There are no real tags (<b>, <code>,
// <br>, etc.) anywhere in the data, so this only needs to decode entities.
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

// app/lookups/bml/common.json's "category" field (STRING, MATH, DIRECT_DB_ACCESS, ...) -
// renamed to match the grammar's entity.name.function.* sub-scopes (database/misc).
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

// Wraps function-call-looking substrings (e.g. decodebase64("YWJj"), getdate())
// in backticks so they read as code within a markdown paragraph. Allows one
// level of nested parens, which covers real cases like "datetostr(getdate())".
// Requires no space before "(" - real calls in this data are written that way,
// and it's what keeps English asides like "by default (see the next section)"
// from getting misread as a call.
const INLINE_CALL_RE = /\b[a-zA-Z_][\w.]*\([^()]*(?:\([^()]*\)[^()]*)*\)/g;

function highlightInlineCode(text) {
    return text.replace(INLINE_CALL_RE, match => `\`${match}\``);
}

// app/lang/intellisense's "examples" field is a grab bag: for functions it's
// almost always a numbered list of usage notes/caveats in prose (sometimes with
// one literal call embedded in a sentence), not a runnable snippet - dumping
// that into a fenced code block renders a paragraph of English in monospace
// with no syntax highlighting. Genuine multi-line code (custom_snippets.json,
// the CPQJS examples) never starts with a leading "1.", so that's a reliable
// way to tell the two apart.
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
    // fullSignature (e.g. "Float atof(String str)") is richer than the snippet
    // form when available - show that, falling back to the plain syntax/name.
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

    // Suggest the CPQJS namespace object itself as a global item
    const cpqjsItem = new vscode.CompletionItem('CPQJS', vscode.CompletionItemKind.Class);
    cpqjsItem.detail = 'CPQJS API Object';
    cpqjsItem.insertText = 'CPQJS';
    cachedGlobalItems.push(cpqjsItem);

    Object.entries(bmlApiData).forEach(([key, info]) => {
        const syntax = info.syntax || info.name;

        // CPQJS methods
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

        // Attributes
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
                // If it is any other scope attribute (e.g. "Product Family" config attributes),
                // it acts as a global variable in its context, so suggest it globally.
                cachedGlobalItems.push(item);
            }
            return;
        }

        // General functions, variables, and snippets are global
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
        
        // Skip line comments
        if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
                i++;
            }
            continue;
        }
        
        // Skip block comments
        if (char === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                i++;
            }
            i += 2;
            continue;
        }
        
        // Skip double-quoted string literals
        if (char === '"') {
            i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++;
            continue;
        }
        
        // Skip single-quoted string literals
        if (char === "'") {
            i++;
            while (i < text.length && text[i] !== "'") {
                if (text[i] === '\\') i++; // skip escaped char
                i++;
            }
            i++;
            continue;
        }
        
        // Track function calls
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
}

module.exports = { registerBmlIntelliSense };
