/**
 * High-performance XML/XSLT Formatter (adapted from inuris/xslt-viewer-for-vs)
 * Handles inline vs block tags, embedded CSS style blocks, quote-aware tokenization, and space preservation.
 */

const TokenType = {
    Text: 'text',
    OpenTag: 'open',
    CloseTag: 'close',
    SelfCloseTag: 'selfclose',
    PI: 'pi',
    Comment: 'comment',
    CDATA: 'cdata',
    Doctype: 'doctype',
};

function getTagName(tagValue, isClose) {
    const start = isClose ? 2 : 1;
    let end = start;
    while (end < tagValue.length && /[\w:-]/.test(tagValue[end])) end++;
    return tagValue.substring(start, end).toLowerCase();
}

function tokenize(input) {
    const tokens = [];
    let i = 0;
    const n = input.length;

    while (i < n) {
        if (input[i] === '<') {
            if (input.substr(i, 5) === '<?xml' || input.substr(i, 2) === '<?') {
                const end = input.indexOf('?>', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                tokens.push({ type: TokenType.PI, value: input.substring(i, end + 2) });
                i = end + 2;
                continue;
            }
            if (input.substr(i, 4) === '<!--') {
                const end = input.indexOf('-->', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                tokens.push({ type: TokenType.Comment, value: input.substring(i, end + 3) });
                i = end + 3;
                continue;
            }
            if (input.substr(i, 9) === '<![CDATA[') {
                const end = input.indexOf(']]>', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                tokens.push({ type: TokenType.CDATA, value: input.substring(i, end + 3) });
                i = end + 3;
                continue;
            }
            if (input.substr(i, 2) === '<!' && (input.substr(i, 9) === '<!DOCTYPE' || input.substr(i, 9) === '<!doctype')) {
                let j = i + 9;
                let inQuote = '';
                while (j < n) {
                    const c = input[j];
                    if (inQuote) {
                        if (c === inQuote) inQuote = '';
                        j++;
                        continue;
                    }
                    if (c === '"' || c === "'") { inQuote = c; j++; continue; }
                    if (c === '>') break;
                    j++;
                }
                if (j < n) {
                    tokens.push({ type: TokenType.Doctype, value: input.substring(i, j + 1) });
                    i = j + 1;
                    continue;
                }
            }
            if (input.substr(i, 2) === '</') {
                const end = input.indexOf('>', i);
                if (end === -1) {
                    tokens.push({ type: TokenType.Text, value: input[i++] });
                    continue;
                }
                const closeRaw = input.substring(i, end + 1);
                tokens.push({ type: TokenType.CloseTag, value: closeRaw, tagName: getTagName(closeRaw, true) });
                i = end + 1;
                continue;
            }
            const tagStart = i;
            i++;
            let inQuote = '';
            while (i < n) {
                const c = input[i];
                if (inQuote) {
                    if (c === inQuote) inQuote = '';
                    i++;
                    continue;
                }
                if (c === '"' || c === "'") {
                    inQuote = c;
                    i++;
                    continue;
                }
                if (c === '>') {
                    i++;
                    const raw = input.substring(tagStart, i);
                    const trimmed = raw.trimEnd();
                    const tagName = getTagName(raw, false);

                    if (trimmed.endsWith('/>')) {
                        tokens.push({ type: TokenType.SelfCloseTag, value: raw });
                    } else {
                        tokens.push({ type: TokenType.OpenTag, value: raw, tagName });
                    }
                    break;
                }
                i++;
            }
            continue;
        }
        let start = i;
        while (i < n && input[i] !== '<') i++;
        if (start < i) {
            tokens.push({ type: TokenType.Text, value: input.substring(start, i) });
        }
    }
    return tokens;
}

function findMatchingClose(tokens, openIdx) {
    const openTag = tokens[openIdx];
    const name = openTag.tagName;
    if (!name) return { endIdx: openIdx + 1, isInline: false };

    const forceBlock = name === 'style' || name === 'script' || name === 'head' || name === 'body' || name === 'html';

    let depth = 1;
    let hasChildTags = false;
    for (let i = openIdx + 1; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type === TokenType.OpenTag) {
            depth++;
            hasChildTags = true;
        } else if (tok.type === TokenType.SelfCloseTag) {
            hasChildTags = true;
        } else if (tok.type === TokenType.CloseTag && tok.tagName === name) {
            depth--;
            if (depth === 0) return { endIdx: i, isInline: forceBlock ? false : !hasChildTags };
        } else if (tok.type === TokenType.CloseTag) {
            depth--;
        }
    }
    return { endIdx: openIdx + 1, isInline: false };
}

const ASCII_WS = /[\t\n\r\f\v ]/;
const ASCII_WS_GLOBAL = /[\t\n\r\f\v ]+/g;
const ASCII_WS_EDGE = /^[\t\n\r\f\v ]+|[\t\n\r\f\v ]+$/g;

function trimAscii(value) {
    return value.replace(ASCII_WS_EDGE, '');
}

function normalizeTagWhitespace(tagValue) {
    let out = '';
    let i = 0;
    let inQuote = '';
    let whitespaceRun = '';
    while (i < tagValue.length) {
        const c = tagValue[i];
        if (inQuote) {
            out += c;
            if (c === inQuote) inQuote = '';
            i++;
            continue;
        }
        if (c === '"' || c === "'") {
            inQuote = c;
            if (whitespaceRun.includes('\n')) out += ' ';
            else out += whitespaceRun;
            whitespaceRun = '';
            out += c;
            i++;
            continue;
        }
        if (ASCII_WS.test(c)) {
            whitespaceRun += c;
            i++;
            continue;
        }
        if (whitespaceRun) {
            out += whitespaceRun.includes('\n') ? ' ' : whitespaceRun;
            whitespaceRun = '';
        }
        out += c;
        i++;
    }
    if (whitespaceRun) out += whitespaceRun.includes('\n') ? ' ' : whitespaceRun;
    return trimAscii(out);
}

function normalizeCommentWhitespace(commentValue) {
    if (!commentValue.startsWith('<!--') || !commentValue.endsWith('-->')) return commentValue;
    const inner = trimAscii(commentValue.slice(4, -3).replace(ASCII_WS_GLOBAL, ' '));
    return `<!-- ${inner} -->`;
}

function collapseTextToLine(text) {
    const compact = text.replace(ASCII_WS_GLOBAL, '');
    const looksEncoded = compact.length > 160 && /^[A-Za-z0-9+/=]+$/.test(compact);
    if (looksEncoded) return text;

    const hadLeading = text.length > 0 && ASCII_WS.test(text[0]);
    const hadTrailing = text.length > 0 && ASCII_WS.test(text[text.length - 1]);
    let s = trimAscii(text.replace(ASCII_WS_GLOBAL, ' '));
    if (s.length === 0) {
        return hadLeading || hadTrailing ? ' ' : '';
    }
    if (hadLeading) s = ' ' + s;
    if (hadTrailing) s = s + ' ';
    return s;
}

function formatWithIndent(tokens, indentStr) {
    let depth = 0;
    const out = [];
    let afterNewline = true;

    for (let idx = 0; idx < tokens.length; idx++) {
        const t = tokens[idx];
        switch (t.type) {
            case TokenType.Text: {
                const isWhitespaceOnly = /^[\t\n\r\f\v ]*$/.test(t.value);
                if (isWhitespaceOnly) {
                    if (!afterNewline) {
                        out.push('\n');
                        afterNewline = true;
                    }
                } else {
                    const collapsed = collapseTextToLine(t.value);
                    if (collapsed) {
                        if (afterNewline) {
                            out.push(indentStr.repeat(depth));
                        }
                        out.push(collapsed);
                        afterNewline = false;
                    }
                }
                break;
            }
            case TokenType.PI:
            case TokenType.CDATA:
            case TokenType.Doctype:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), t.value);
                afterNewline = false;
                break;
            case TokenType.Comment:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), normalizeCommentWhitespace(t.value));
                afterNewline = false;
                break;
            case TokenType.SelfCloseTag:
                if (!afterNewline) out.push('\n');
                out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                afterNewline = false;
                break;
            case TokenType.OpenTag: {
                const { endIdx, isInline } = findMatchingClose(tokens, idx);
                if (isInline) {
                    if (!afterNewline) out.push('\n');
                    out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                    for (let j = idx + 1; j < endIdx; j++) {
                        const inner = tokens[j];
                        if (inner.type === TokenType.Text) {
                            out.push(collapseTextToLine(inner.value));
                        } else if (inner.type === TokenType.Comment) {
                            out.push(normalizeCommentWhitespace(inner.value));
                        } else if (inner.type === TokenType.CDATA || inner.type === TokenType.PI) {
                            out.push(inner.value);
                        }
                    }
                    out.push(normalizeTagWhitespace(tokens[endIdx].value));
                    idx = endIdx;
                    afterNewline = false;
                } else {
                    if (!afterNewline) out.push('\n');
                    out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                    depth++;
                    afterNewline = false;
                }
                break;
            }
            case TokenType.CloseTag:
                depth--;
                if (depth < 0) depth = 0;
                if (!afterNewline) {
                    out.push('\n');
                }
                out.push(indentStr.repeat(depth), normalizeTagWhitespace(t.value));
                afterNewline = false;
                break;
        }
    }
    return out.join('');
}

/**
 * Format XML/XSLT content using inuris/xslt-viewer-for-vs algorithm
 */
function formatXml(contents, indentInput = 4) {
    const indentStr = typeof indentInput === 'string' ? indentInput : ' '.repeat(indentInput);
    const tokens = tokenize(contents);
    return formatWithIndent(tokens, indentStr);
}

module.exports = { formatXml };
