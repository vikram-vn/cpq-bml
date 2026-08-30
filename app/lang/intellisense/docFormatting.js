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

function isPlaceholderParamDesc(desc, paramName, paramType) {
    if (!desc) return true;
    const clean = desc.replace(/[`']/g, '').trim().toLowerCase();
    const pName = (paramName || '').trim().toLowerCase();
    const pType = (paramType || '').trim().toLowerCase();
    if (clean === `input parameter ${pName} of type ${pType}.` ||
        clean === `input parameter ${pName} of type ${pType}` ||
        clean === `input parameter ${pName}.`) {
        return true;
    }
    return false;
}

function parseExampleItem(rawEx) {
    if (!rawEx || typeof rawEx !== 'string') return null;
    const text = decodeHtmlEntities(rawEx).trim();
    if (!text) return null;

    // Pattern 1: Combined description + Example: <code block>
    const combinedMatch = text.match(/^\s*(?:(\d+\.\s*)?([^\n]+?))\s*(?:\r?\n+\s*(?:Example|Sample|Usage):\s*|\r?\n\r?\n)([\s\S]+)$/i);
    if (combinedMatch) {
        const titleCandidate = combinedMatch[2].trim();
        const codeCandidate = combinedMatch[3].trim();
        const isProseExplanation = /\b(will return|is used to|can be|should be|returns the)\b/i.test(codeCandidate) && !codeCandidate.includes('\n');
        if (!isProseExplanation && codeCandidate && (
            codeCandidate.includes(';\n') ||
            codeCandidate.includes('{\n') ||
            codeCandidate.includes(';\r\n') ||
            codeCandidate.includes('{\r\n') ||
            codeCandidate.includes(' = ') ||
            codeCandidate.includes('bmql(') ||
            codeCandidate.startsWith('return ') ||
            (codeCandidate.includes('(') && codeCandidate.includes(')'))
        )) {
            return {
                title: titleCandidate.replace(/^Example:\s*/i, '').trim(),
                code: codeCandidate
            };
        }
    }

    // Pattern 2: Single-line or pure prose usage note
    if (/^\s*\d+\.\s/.test(text) && !text.includes(';\n') && !text.includes('{\n') && !text.includes(';\r\n') && !text.includes('{\r\n')) {
        return {
            title: text.replace(/^\s*\d+\.\s*/, '').trim(),
            code: null
        };
    }

    // Pattern 3: Pure code snippet
    return {
        title: null,
        code: text
    };
}

function normalizeCodeForComparison(code) {
    if (!code) return '';
    return code.replace(/\s+/g, '').replace(/;+/g, ';').trim().toLowerCase();
}

function isProseExample(example) {
    if (!example || typeof example !== 'string') return false;
    return /^\s*\d+\.\s/.test(example) && !example.includes(';\n') && !example.includes('{\n');
}

function processExamples(examples) {
    if (!examples || !examples.length) return [];
    const parsedList = [];
    const seenCode = new Map();

    for (const ex of examples) {
        const item = parseExampleItem(ex);
        if (!item) continue;

        if (item.code) {
            const norm = normalizeCodeForComparison(item.code);
            if (seenCode.has(norm)) {
                const existingIdx = seenCode.get(norm);
                if (item.title && !parsedList[existingIdx].title) {
                    parsedList[existingIdx].title = item.title;
                }
            } else {
                seenCode.set(norm, parsedList.length);
                parsedList.push(item);
            }
        } else if (item.title) {
            const isDupTitle = parsedList.some(p => p.title && p.title.toLowerCase() === item.title.toLowerCase());
            if (!isDupTitle) {
                parsedList.push(item);
            }
        }
    }
    return parsedList;
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
        md.appendMarkdown(`${highlightInlineCode(decodeHtmlEntities(info.notes))}\n\n`);
    }

    if (info.parameters && info.parameters.length) {
        md.appendMarkdown(`**Parameters:**\n`);
        info.parameters.forEach(p => {
            const req = p.required === false ? ' *(optional)*' : '';
            const hasCustomDesc = p.description && !isPlaceholderParamDesc(p.description, p.name, p.type || p.dataType);
            const desc = hasCustomDesc ? ` — ${decodeHtmlEntities(p.description)}` : '';
            md.appendMarkdown(`- \`${p.name}\` \`[${p.type || p.dataType || 'Any'}]\`${req}${desc}\n`);
        });
        md.appendMarkdown('\n');
    }

    if (info.returnType && info.category === 'function') {
        md.appendMarkdown(`**Returns:** \`${info.returnType}\`\n\n`);
    }

    if (info.values?.length) {
        md.appendMarkdown(`**Values:** ${info.values.map(v => `\`${v}\``).join(', ')}\n\n`);
    }

    if (info.examples?.length) {
        const parsedExamples = processExamples(info.examples);
        if (parsedExamples.length > 0) {
            const heading = parsedExamples.every(e => !e.code) ? 'Usage Note' : 'Example';
            md.appendMarkdown(`**${heading}${parsedExamples.length > 1 ? 's' : ''}:**\n`);

            if (parsedExamples.length === 1) {
                const ex = parsedExamples[0];
                if (ex.title) {
                    md.appendMarkdown(`\n${highlightInlineCode(ex.title)}:\n`);
                }
                if (ex.code) {
                    md.appendCodeblock(ex.code, 'bml');
                } else if (!ex.code && !ex.title) {
                    // fallback
                }
            } else {
                parsedExamples.forEach((ex, idx) => {
                    if (ex.title && ex.code) {
                        md.appendMarkdown(`\n${idx + 1}. ${highlightInlineCode(ex.title)}:\n`);
                        md.appendCodeblock(ex.code, 'bml');
                    } else if (ex.code) {
                        md.appendCodeblock(ex.code, 'bml');
                    } else if (ex.title) {
                        md.appendMarkdown(`\n${idx + 1}. ${highlightInlineCode(ex.title)}\n`);
                    }
                });
            }
        }
    }

    if (info.docs) {
        // Clean out image placeholders from rendered hover doc
        let cleanDocs = info.docs
            .replace(/\*🖼️[^*]*\*/g, '')
            .replace(/Example of [^:]*:\s*/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (cleanDocs) {
            const normDocs = cleanDocs.replace(/[\s\r\n\t]+/g, ' ').trim().toLowerCase();
            const normNotes = (info.notes || '').replace(/[\s\r\n\t]+/g, ' ').trim().toLowerCase();

            if (normDocs && normDocs !== normNotes) {
                let docBody = cleanDocs;
                if (normNotes && normDocs.startsWith(normNotes)) {
                    const stripped = cleanDocs.substring(info.notes.trim().length).replace(/^[\s.:\r\n-]+/, '').trim();
                    if (stripped) {
                        docBody = stripped;
                    } else {
                        docBody = '';
                    }
                }
                if (docBody) {
                    md.appendMarkdown(`\n---\n\n**📚 From the Docs**\n\n${docBody}\n`);
                }
            }
        }
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
    isPlaceholderParamDesc,
    parseExampleItem,
    processExamples,
    isProseExample,
    formatAsJsDoc,
    formatWorkspaceFunctionHover,
    KEYWORD_HOVERS
};
