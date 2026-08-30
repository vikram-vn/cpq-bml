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

const {
    loadBestPracticeAdvisoriesJson,
    loadKeywordHoversJson,
    loadCategoryLabelsJson
} = require('./apiDataLoader');

const categoryData = loadCategoryLabelsJson();
const CATEGORY_LABEL = (categoryData && categoryData.categories) || {
    function: 'function',
    attribute: 'attribute',
    variable: 'variable',
    snippet: 'snippet',
    keyword: 'keyword',
    constant: 'constant'
};

const FUNCTION_CATEGORY_LABEL = (categoryData && categoryData.functionCategories) || {
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

const KEYWORD_HOVERS = loadKeywordHoversJson();
const BEST_PRACTICE_ADVISORIES = loadBestPracticeAdvisoriesJson();

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

function cleanParamDescription(desc) {
    if (!desc) return '';
    let text = decodeHtmlEntities(desc).trim();
    // Strip redundant leading "**Optional:**", "*Optional:*", "(Optional)", "Optional -", etc.
    text = text.replace(/^\s*(?:\*{1,2}|_)?\(?optional(?:\)?:\s*|\)?\s*[-–—:]\s*|\)?\s+)(?:\*{1,2}|_)?\s*/i, '');
    return text.trim();
}

function isParamOptional(p, info) {
    if (p.required === false) return true;
    if (p.description && /^\s*(?:\*{1,2}|_)?\(?optional\b/i.test(p.description)) return true;
    if (p.description && /\b(optional parameter|is optional)\b/i.test(p.description)) return true;

    // Check fullSignature first (which has full bracketed params), then syntax
    const sigs = typeof info === 'string'
        ? [info]
        : [info?.fullSignature, info?.syntax].filter(Boolean);

    for (const sig of sigs) {
        if (p.name) {
            const idx = sig.toLowerCase().indexOf(p.name.toLowerCase());
            if (idx !== -1) {
                const before = sig.substring(0, idx);
                const openBrackets = (before.match(/\[/g) || []).length;
                const closeBrackets = (before.match(/\]/g) || []).length;
                if (openBrackets > closeBrackets) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isProseExample(example) {
    if (!example || typeof example !== 'string') return false;
    const clean = example.trim();
    if (/\b(will return|is used to|can be|should be|returns the)\b/i.test(clean) && !clean.includes('\n')) {
        return true;
    }
    return /^\s*\d+\.\s/.test(clean) && !clean.includes(';\n') && !clean.includes('{\n');
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
        if (!isProseExample(codeCandidate) && codeCandidate && (
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
    if (isProseExample(text)) {
        return {
            title: text.replace(/^\s*\d+\.\s*/, '').trim(),
            code: ''
        };
    }

    // Pattern 3: Pure code snippet
    return {
        title: '',
        code: text
    };
}

function normalizeCodeForComparison(code) {
    if (!code) return '';
    return code.replace(/\s+/g, '').replace(/;+/g, ';').trim().toLowerCase();
}

function processExamples(rawExamples) {
    if (!rawExamples || !Array.isArray(rawExamples)) return [];
    const parsedList = [];
    const seenCodes = new Set();

    for (const item of rawExamples) {
        const parsed = typeof item === 'string' ? parseExampleItem(item) : item;
        if (!parsed) continue;

        if (parsed.code) {
            const normalizedCode = parsed.code.replace(/[\s\r\n\t]+/g, ' ').trim();
            if (seenCodes.has(normalizedCode)) {
                // If this is a duplicate code block with a descriptive title, update the title on the earlier item
                if (parsed.title) {
                    const existing = parsedList.find(p => p.code && p.code.replace(/[\s\r\n\t]+/g, ' ').trim() === normalizedCode);
                    if (existing && !existing.title) {
                        existing.title = parsed.title;
                    }
                }
                continue;
            }
            seenCodes.add(normalizedCode);
            parsedList.push(parsed);
        } else if (parsed.title) {
            const isDupTitle = parsedList.some(p => p.title && p.title.toLowerCase() === parsed.title.toLowerCase());
            if (!isDupTitle) {
                parsedList.push(parsed);
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

    const funcName = (info.name || (info.syntax ? info.syntax.split('(')[0] : '') || '').trim().toLowerCase();
    const advisory = BEST_PRACTICE_ADVISORIES[funcName];
    if (advisory) {
        md.appendMarkdown(`> 💡 **${advisory.title}**\n`);
        md.appendMarkdown(`> ${advisory.text}\n`);
        if (advisory.linkText && advisory.linkUrl) {
            md.appendMarkdown(`>\n> → *[${advisory.linkText}](${advisory.linkUrl})*\n\n`);
        } else {
            md.appendMarkdown(`\n\n`);
        }
    }

    if (info.parameters && info.parameters.length) {
        md.appendMarkdown(`### Parameters\n\n`);
        info.parameters.forEach(p => {
            const name = p.name || 'param';
            const type = p.type || p.dataType || 'Any';
            const isOpt = isParamOptional(p, info);
            const req = isOpt ? 'Optional' : 'Required';
            const hasCustomDesc = p.description && !isPlaceholderParamDesc(p.description, p.name, p.type || p.dataType);
            const cleanedDesc = hasCustomDesc ? cleanParamDescription(p.description) : '';
            const desc = cleanedDesc ? ` &mdash; ${cleanedDesc}` : '';
            md.appendMarkdown(`- \`${name}\` (\`${type}\`, ${req})${desc}\n`);
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
            const isAllProse = parsedExamples.every(e => !e.code);
            const heading = isAllProse ? `**Usage Note${parsedExamples.length > 1 ? 's' : ''}:**` : `### Example${parsedExamples.length > 1 ? 's' : ''}`;
            md.appendMarkdown(`${heading}\n\n`);

            if (parsedExamples.length === 1) {
                const ex = parsedExamples[0];
                if (ex.title) {
                    const colon = ex.code ? ':\n' : '\n\n';
                    md.appendMarkdown(`${highlightInlineCode(ex.title)}${colon}`);
                }
                if (ex.code) {
                    md.appendCodeblock(ex.code, 'bml');
                }
            } else {
                parsedExamples.forEach((ex, idx) => {
                    if (ex.title && ex.code) {
                        md.appendMarkdown(`${idx + 1}. ${highlightInlineCode(ex.title)}:\n`);
                        md.appendCodeblock(ex.code, 'bml');
                    } else if (ex.code) {
                        md.appendCodeblock(ex.code, 'bml');
                    } else if (ex.title) {
                        md.appendMarkdown(`${idx + 1}. ${highlightInlineCode(ex.title)}\n\n`);
                    }
                });
            }
        }
    }

    if (info.docs) {
        // Clean out image placeholders, empty bullets, and dangling dashes from rendered hover doc
        let cleanDocs = info.docs
            .replace(/\*🖼️[^*]*\*/g, '')
            .replace(/Example of [^:]*:\s*/gi, '')
            .replace(/^\s*[-*•]\s*$/gm, '')
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
                docBody = docBody.replace(/[\s\r\n]*[-*•]\s*$/, '').trim();
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
        md.appendMarkdown(`### Parameters\n\n`);
        wsInfo.parameters.forEach(p => {
            const name = p.name || 'param';
            const type = p.dataType || 'Any';
            const isOpt = isParamOptional(p, wsInfo);
            const req = isOpt ? 'Optional' : 'Required';
            const cleanedDesc = p.description ? cleanParamDescription(p.description) : '';
            const desc = cleanedDesc ? ` &mdash; ${cleanedDesc}` : '';
            md.appendMarkdown(`- \`${name}\` (\`${type}\`, ${req})${desc}\n`);
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
    KEYWORD_HOVERS,
    BEST_PRACTICE_ADVISORIES
};
