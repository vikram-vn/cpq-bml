const vscode = require('vscode');

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
 * info.docs (when present) is a pre-generated, already hover-safe markdown
 * excerpt from the knowledge base - see scripts/bml_intellisense/knowledge_docs.py,
 * which extracts and sanitizes it once at build time (no runtime file
 * reading, no separate webview tab needed to read the docs).
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

    if (info.docs) {
        md.appendMarkdown(`\n---\n\n**📚 From the Docs**\n\n${info.docs}\n`);
    }

    return md;
}

module.exports = {
    decodeHtmlEntities,
    buildMetadataLine,
    highlightInlineCode,
    isProseExample,
    formatAsJsDoc,
};
