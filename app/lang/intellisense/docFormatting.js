const vscode = require('vscode');
const path = require('path');
const { existsCompressed, readCompressedText } = require('./compressedFile');

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

function getHelpFilePath(info) {
    if (!info) return null;
    const category = info.functionCategory;
    if (!category) return null;

    const categoryMap = {
        'string': 'string/string.md',
        'math': 'math/math.md',
        'date': 'date/date.md',
        'json': 'json/json.md',
        'xml': 'xml/xml.md',
        'dictionary': 'dictionary/dictionary.md',
        'array': 'array/arrays.md',
        'arrays': 'array/arrays.md',
        'bmql': 'bmql/bmql.md',
        'url': 'url-access/urlAccess.md',
        'others': 'others/others.md',
        'direct_db_access': 'direct-db-access/directDbAccess.md'
    };

    const fileName = categoryMap[category.toLowerCase()];
    if (fileName) {
        return path.join('app', 'knowledge', 'BML', fileName);
    }
    return null;
}

// Mirrors helpViewer.js's ADMONITIONS labels/icons - kept as a small local
// copy rather than a shared import since this only needs the icon/label,
// not the full container-rendering machinery.
const ADMONITION_ICON = { note: '📝', tip: '💡', info: 'ℹ️', warning: '⚠️', danger: '🚫' };

// Finds the "## <name>" section (case-insensitive) in a per-function
// reference doc like string.md/math.md/others.md and returns everything up
// to the next "## " heading. Docs that aren't structured this way (e.g.
// bmql.md, a prose guide with no per-function headings) simply won't match -
// callers should treat null as "no inline excerpt available".
function extractFunctionSection(mdBody, name) {
    const headingRe = new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im');
    const match = headingRe.exec(mdBody);
    if (!match) return null;

    const rest = mdBody.slice(match.index + match[0].length);
    const nextHeading = /^##\s+/m.exec(rest);
    const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    return section.trim() || null;
}

// Converts a raw per-function doc section into hover-safe markdown: strips
// the redundant "**Syntax:**" line (already shown via the code block above),
// drops images (local file:// images aren't reliably renderable in hover
// tooltips - the "Read Offline Help" link is how screenshots get seen),
// and turns ":::type ... :::" admonition containers (not standard markdown,
// markdown-it-container syntax) into a plain blockquote so they render as
// *something* instead of literal "::: " text.
function sanitizeSectionForHover(section) {
    return section
        .replace(/^\*\*Syntax:\*\*.*$/im, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/:::(\w+)\r?\n([\s\S]*?):::/g, (_, type, body) => {
            const icon = ADMONITION_ICON[type.toLowerCase()] || 'ℹ️';
            const label = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            return `> ${icon} **${label}:** ${body.trim()}`;
        })
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Build a Markdown tooltip with syntax, scope/type, notes, and examples.
 */
function formatAsJsDoc(info, context) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    const label = CATEGORY_LABEL[info.category] || 'symbol';
    const signature = info.fullSignature || info.syntax;
    if (signature) {
        md.appendCodeblock(`(${label}) ${decodeHtmlEntities(signature)}`, 'bml');
    }

    // Help link right after signature — always visible without scrolling
    const helpFileRel = getHelpFilePath(info);
    let inlineSection = null;
    if (helpFileRel && context) {
        const helpFileAbs = path.join(context.extensionPath, helpFileRel);
        if (existsCompressed(helpFileAbs)) {
            const uri = vscode.Uri.file(helpFileAbs).with({ fragment: info.name.toLowerCase() });
            const encodedArgs = encodeURIComponent(JSON.stringify([uri.toString()]));
            md.appendMarkdown(`📖 [Open Full Page (with images)](command:cpqBml.openHelpTopic?${encodedArgs})\n\n---\n\n`);

            // Inline the relevant excerpt right here - instant, no separate webview
            // panel/tab needed for the common case of just wanting to read the docs.
            const mdBody = readCompressedText(helpFileAbs);
            if (mdBody) {
                const section = extractFunctionSection(mdBody, info.name);
                if (section) inlineSection = sanitizeSectionForHover(section);
            }
        }
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

    // Richer reference content (param tables, return type, admonitions) pulled
    // straight from the offline doc - instant, no separate webview tab needed
    // for the common case of just wanting to read the docs.
    if (inlineSection) {
        md.appendMarkdown(`\n---\n\n${inlineSection}\n`);
    }

    return md;
}

module.exports = {
    decodeHtmlEntities,
    buildMetadataLine,
    highlightInlineCode,
    isProseExample,
    getHelpFilePath,
    formatAsJsDoc,
};
