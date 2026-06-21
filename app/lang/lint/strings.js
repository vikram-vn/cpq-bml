function getStringRanges(text) {
    const stringRanges = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '\\') {
            i++; // skip escaped char
            continue;
        }
        if (char === "'" && !inDoubleQuote) {
            if (!inSingleQuote) {
                inSingleQuote = true;
                start = i;
            } else {
                inSingleQuote = false;
                stringRanges.push([start, i + 1]);
            }
        } else if (char === '"' && !inSingleQuote) {
            if (!inDoubleQuote) {
                inDoubleQuote = true;
                start = i;
            } else {
                inDoubleQuote = false;
                stringRanges.push([start, i + 1]);
            }
        }
    }
    return stringRanges;
}

module.exports = { getStringRanges };
