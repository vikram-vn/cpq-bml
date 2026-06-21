function getCommentRanges(text) {
    const commentRanges = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (char === '\\') {
            i++; // skip escaped char
            continue;
        }
        
        if (inSingleQuote) {
            if (char === "'") inSingleQuote = false;
        } else if (inDoubleQuote) {
            if (char === '"') inDoubleQuote = false;
        } else {
            if (char === "'") {
                inSingleQuote = true;
            } else if (char === '"') {
                inDoubleQuote = true;
            } else if (char === '/' && text[i + 1] === '*') {
                const start = i;
                i += 2;
                while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
                    i++;
                }
                i += 1; // move to '/'
                commentRanges.push([start, Math.min(i + 1, text.length)]);
            } else if (char === '/' && text[i + 1] === '/') {
                const start = i;
                i += 2;
                while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
                    i++;
                }
                commentRanges.push([start, i]);
            }
        }
    }
    return commentRanges;
}

module.exports = { getCommentRanges };
