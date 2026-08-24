function getConditionRanges(text) {
    const conditionRanges = [];
    const ifRegex = /\b(?:if|elif|else\s+if)\s*\(/gi;
    let match;
    while ((match = ifRegex.exec(text)) !== null) {
        const start = match.index + match[0].indexOf('(');
        let depth = 1;
        let end = start + 1;
        while (end < text.length && depth > 0) {
            const c = text.charCodeAt(end);
            if (c === 40) depth++; // '('
            else if (c === 41) depth--; // ')'
            end++;
        }
        while (end < text.length && text.charCodeAt(end) <= 32) end++;
        conditionRanges.push([start, end]);
    }
    return conditionRanges;
}

module.exports = { getConditionRanges };
