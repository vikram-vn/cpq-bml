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
let cachedCompletionItems = null;

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
    cachedCompletionItems = null; // data changed - rebuild the completion list lazily
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
 * Builds the completion item list once per data generation. Documentation
 * (which involves Markdown formatting per item) is deliberately left unset
 * here and filled in lazily by resolveCompletionItem, since VS Code only
 * resolves the item(s) actually visible/highlighted in the list - building
 * it eagerly for every entry on every keystroke is wasted work.
 */
function buildCompletionItems() {
    return Object.entries(bmlApiData).map(([key, info]) => {
        const syntax = info.syntax || info.name;

        const item = new vscode.CompletionItem(info.name, CATEGORY_KIND[info.category]);
        item.detail = syntax;
        item.insertText = new vscode.SnippetString(syntax);
        item.filterText = key;
        return item;
    });
}

/**
 * Register both Hover & Completion providers for BML.
 */
function registerBmlIntelliSense(context) {
    loadApiData(context);

    const completionProvider = vscode.languages.registerCompletionItemProvider(
        'bml',
        {
            provideCompletionItems() {
                loadApiData(context); // reload if updated externally
                if (!cachedCompletionItems) {
                    cachedCompletionItems = buildCompletionItems();
                }
                return cachedCompletionItems;
            },
            resolveCompletionItem(item) {
                const info = bmlApiData[item.filterText];
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

    context.subscriptions.push(completionProvider, hoverProvider);
}

module.exports = { registerBmlIntelliSense };
