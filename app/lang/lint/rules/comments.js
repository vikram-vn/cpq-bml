function getCommentRanges(text) {
    const commentRanges = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    const len = text.length;
    
    for (let i = 0; i < len; i++) {
        const char = text.charCodeAt(i);
        
        if (char === 92) { // '\\'
            i++; // skip escaped char
            continue;
        }
        
        if (inSingleQuote) {
            if (char === 39) inSingleQuote = false; // "'"
        } else if (inDoubleQuote) {
            if (char === 34) inDoubleQuote = false; // '"'
        } else {
            if (char === 39) { // "'"
                inSingleQuote = true;
            } else if (char === 34) { // '"'
                inDoubleQuote = true;
            } else if (char === 47 && i + 1 < len && text.charCodeAt(i + 1) === 42) { // '/*'
                const start = i;
                i += 2;
                while (i < len && !(text.charCodeAt(i) === 42 && text.charCodeAt(i + 1) === 47)) {
                    i++;
                }
                i += 1; // move to '/'
                commentRanges.push([start, Math.min(i + 1, len)]);
            } else if (char === 47 && i + 1 < len && text.charCodeAt(i + 1) === 47) { // '//'
                const start = i;
                i += 2;
                while (i < len && text.charCodeAt(i) !== 10 && text.charCodeAt(i) !== 13) {
                    i++;
                }
                commentRanges.push([start, i]);
            }
        }
    }
    return commentRanges;
}

function blankRanges(text, ranges) {
    if (!ranges || ranges.length === 0) return text;
    let result = '';
    let lastIndex = 0;
    for (let i = 0; i < ranges.length; i++) {
        const [start, end] = ranges[i];
        if (start > lastIndex) {
            result += text.slice(lastIndex, start);
        }
        const slice = text.slice(start, end);
        if (slice.includes('\n') || slice.includes('\r')) {
            result += slice.replace(/[^\r\n]/g, ' ');
        } else {
            result += ' '.repeat(end - start);
        }
        lastIndex = end;
    }
    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}

module.exports = { getCommentRanges, blankRanges };
