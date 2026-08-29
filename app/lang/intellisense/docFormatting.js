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
    snippet: 'snippet',
    keyword: 'keyword',
    constant: 'constant'
};

const FUNCTION_CATEGORY_LABEL = {
    direct_db_access: 'database',
    arrays: 'array',
    string: 'string',
    date: 'date',
    dictionary: 'dictionary',
    json: 'json',
    math: 'math',
    url_access: 'url',
    xml: 'xml',
    others: 'misc'
};

const KEYWORD_HOVERS = {
    'if': { syntax: 'if (condition) { ... }', category: 'keyword', notes: 'Executes block if condition evaluates to true.' },
    'elif': { syntax: 'elif (condition) { ... }', category: 'keyword', notes: 'Executes block if previous if/elif condition was false and this condition is true.' },
    'else': { syntax: 'else { ... }', category: 'keyword', notes: 'Executes block if all preceding if/elif conditions were false.' },
    'for': { syntax: 'for var in array { ... }', category: 'keyword', notes: 'Loops through each element in an array or collection.' },
    'return': { syntax: 'return value;', category: 'keyword', notes: 'Returns value from the function and terminates execution.' },
    'bmql': { syntax: 'recordset bmql("SELECT column1, column2 FROM dataTable WHERE condition = $var");', category: 'function', functionCategory: 'direct_db_access', notes: 'BigMachines Query Language (BMQL) - executes direct database SQL queries on CPQ Data Tables.' },
    'throwerror': { syntax: 'throwerror(errorMessage [, isSystemError]);', category: 'function', functionCategory: 'others', notes: 'Stops script execution and raises a user-facing error message on CPQ UI.' },
    'print': { syntax: 'print(value);', category: 'function', functionCategory: 'others', notes: 'Prints value to the CPQ BML Function Editor execution log / console.' },
    'true': { syntax: 'true', category: 'constant', notes: 'Boolean true constant.' },
    'false': { syntax: 'false', category: 'constant', notes: 'Boolean false constant.' },
    'null': { syntax: 'null', category: 'constant', notes: 'Null reference or empty object.' }
};

/**
 * Builds the "*scope · type*" (or "*category function*") metadata line shown
 * under the syntax block. Returns '' when there's nothing to show.
 */
function buildMetadataLine(info) {
    if (info.category === 'function') {
        if (!info.functionCategory) return '*function*';
        const label = FUNCTION_CATEGORY_LABEL[info.functionCategory] || info.functionCategory;
        return `*${label} function*`;
    }
    const parts = [info.scope, info.dataType].filter(Boolean);
    return parts.length ? `*${parts.join(' · ')}*` : '';
}

const INLINE_CALL_RE = /\b[a-zA-Z_][\w.]*\([^()]*(?:\([^()]*\)[^()]*)*\)/g;

function highlightInlineCode(text) {
    return text.replace(INLINE_CALL_RE, match => `\`${match}\``);
}

function isProseExample(example) {
    return /^\s*\d+\.\s/.test(example);
}

/**
 * Format a Markdown hover tooltip for built-in functions, attributes, and variables.
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

/**
 * Format a Markdown hover tooltip for custom workspace functions (util.* or commerce.*).
 */
function formatWorkspaceFunctionHover(wsInfo) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    const returnType = wsInfo.returnType ? `${wsInfo.returnType} ` : '';
    const paramsList = wsInfo.parameters && wsInfo.parameters.length
        ? wsInfo.parameters.map(p => `${p.dataType ? p.dataType + ' ' : ''}${p.name}`).join(', ')
        : '';

    const signatureStr = `(util function) ${returnType}${wsInfo.qualifiedName}(${paramsList})`;
    md.appendCodeblock(signatureStr, 'bml');

    md.appendMarkdown(`*Workspace BML Function*\n\n`);

    if (wsInfo.docHeader) {
        md.appendMarkdown(`${decodeHtmlEntities(wsInfo.docHeader)}\n\n`);
    }

    if (wsInfo.parameters && wsInfo.parameters.length) {
        md.appendMarkdown(`**Parameters:**\n`);
        wsInfo.parameters.forEach(p => {
            md.appendMarkdown(`- \`${p.name}\` \`[${p.dataType || 'any'}]\`\n`);
        });
        md.appendMarkdown('\n');
    }

    if (wsInfo.returnType) {
        md.appendMarkdown(`**Returns:** \`${wsInfo.returnType}\`\n\n`);
    }

    if (wsInfo.filePath) {
        try {
            const fileUri = vscode.Uri.file(wsInfo.filePath);
            const lineNum = (wsInfo.line || 0) + 1;
            md.appendMarkdown(`---\n[📍 Source: \`${wsInfo.qualifiedName}\`](${fileUri.toString()}#L${lineNum})\n`);
        } catch (_) {}
    }

    return md;
}

module.exports = {
    decodeHtmlEntities,
    buildMetadataLine,
    highlightInlineCode,
    isProseExample,
    formatAsJsDoc,
    formatWorkspaceFunctionHover,
    KEYWORD_HOVERS
};
