const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
    if (helpFileRel && context) {
        const helpFileAbs = path.join(context.extensionPath, helpFileRel);
        // .md.br ships in the packaged .vsix (raw .md is dev/test-only, excluded by .vscodeignore).
        if (fs.existsSync(helpFileAbs) || fs.existsSync(`${helpFileAbs}.br`)) {
            const uri = vscode.Uri.file(helpFileAbs).with({ fragment: info.name.toLowerCase() });
            const encodedArgs = encodeURIComponent(JSON.stringify([uri.toString()]));
            md.appendMarkdown(`📖 [Read Offline Help](command:cpqBml.openHelpTopic?${encodedArgs})\n\n---\n\n`);
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
