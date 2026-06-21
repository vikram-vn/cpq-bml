function getConditionRanges(text) {
    const conditionRanges = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '\\') {
            i++;
            continue;
        }

        if (inLineComment) {
            if (char === '\n' || char === '\r') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (char === '*' && text[i + 1] === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inSingleQuote) {
            if (char === "'") inSingleQuote = false;
            continue;
        }
        if (inDoubleQuote) {
            if (char === '"') inDoubleQuote = false;
            continue;
        }

        if (char === '/' && text[i + 1] === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        if (char === '/' && text[i + 1] === '/') {
            inLineComment = true;
            i++;
            continue;
        }
        if (char === "'") {
            inSingleQuote = true;
            continue;
        }
        if (char === '"') {
            inDoubleQuote = true;
            continue;
        }

        // Active BML code: check for if, elif, or else if followed by (
        const sub = text.substring(i);
        const match = /^(?:if|elif|else\s+if)\s*\(/i.exec(sub);
        if (match) {
            const start = i + match[0].indexOf('(');
            let depth = 1;
            let end = start + 1;
            while (end < text.length && depth > 0) {
                const c = text[end];
                if (c === '(') depth++;
                else if (c === ')') depth--;
                end++;
            }
            while (end < text.length && /\s/.test(text[end])) end++;
            conditionRanges.push([start, end]);
            i = end - 1; // skip forward
        }
    }

    return conditionRanges;
}

module.exports = { getConditionRanges };
