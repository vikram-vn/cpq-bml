function findStringLiterals(lineText) {
    const strings = [];
    let inSingle = false;
    let inDouble = false;
    let start = -1;
    for (let i = 0; i < lineText.length; i++) {
        const ch = lineText[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (ch === "'" && !inDouble) {
            if (!inSingle) {
                inSingle = true;
                start = i;
            } else {
                inSingle = false;
                strings.push({ start, end: i + 1, quote: "'", content: lineText.substring(start + 1, i) });
            }
        } else if (ch === '"' && !inSingle) {
            if (!inDouble) {
                inDouble = true;
                start = i;
            } else {
                inDouble = false;
                strings.push({ start, end: i + 1, quote: '"', content: lineText.substring(start + 1, i) });
            }
        }
    }
    return strings;
}

function chunkStringContent(str, quoteChar, maxLen = 70) {
    if (str.length <= maxLen) return [quoteChar + str + quoteChar];

    const chunks = [];
    let remaining = str;

    while (remaining.length > maxLen) {
        let splitIdx = -1;
        const candidateWindow = remaining.substring(0, Math.min(remaining.length, maxLen + 15));

        for (let i = Math.min(candidateWindow.length - 1, maxLen); i >= 25; i--) {
            if (candidateWindow[i - 1] === '\\') continue;

            if (i >= 5 && (candidateWindow.substring(i - 5, i) === '</br>' || candidateWindow.substring(i - 5, i) === '<br/>')) {
                splitIdx = i;
                break;
            }
            if (candidateWindow[i] === ' ' || candidateWindow[i] === '~' || candidateWindow[i] === '\n') {
                splitIdx = i + 1;
                break;
            }
            if (i < candidateWindow.length - 1 && (candidateWindow[i] === '.' || candidateWindow[i] === ',' || candidateWindow[i] === ';') && candidateWindow[i + 1] === ' ') {
                splitIdx = i + 2;
                break;
            }
        }

        if (splitIdx === -1 || splitIdx <= 10) {
            const nextSpace = candidateWindow.indexOf(' ', maxLen);
            if (nextSpace !== -1 && nextSpace < maxLen + 20) {
                splitIdx = nextSpace + 1;
            } else {
                splitIdx = maxLen;
            }
        }

        if (remaining[splitIdx - 1] === '\\') {
            splitIdx++;
        }

        const chunk = remaining.substring(0, splitIdx);
        chunks.push(quoteChar + chunk + quoteChar);
        remaining = remaining.substring(splitIdx);
    }

    if (remaining.length > 0) {
        chunks.push(quoteChar + remaining + quoteChar);
    }

    return chunks;
}

function splitLongStringLiteral(lineText) {
    const stringLiterals = findStringLiterals(lineText);
    if (!stringLiterals || stringLiterals.length === 0) return null;

    const longStrings = stringLiterals.filter(s => (s.end - s.start) > 60 || (lineText.length > 180 && (s.end - s.start) > 40));
    if (longStrings.length === 0) return null;

    const baseIndent = lineText.match(/^\s*/)[0];
    const indentUnit = baseIndent.includes('\t') ? '\t' : '    ';
    const continuationIndent = baseIndent + indentUnit;

    let result = lineText;
    for (let i = longStrings.length - 1; i >= 0; i--) {
        const { start, end, quote, content } = longStrings[i];
        const chunks = chunkStringContent(content, quote, 65);
        if (chunks.length <= 1) continue;

        const replacement = chunks.join('\n' + continuationIndent + '+ ');
        result = result.substring(0, start) + replacement + result.substring(end);
    }

    return result !== lineText ? result : null;
}

function splitConcatenationIntoLines(lineText) {
    const baseIndent = lineText.match(/^\s*/)[0];
    const indentUnit = baseIndent.includes('\t') ? '\t' : '    ';
    const continuationIndent = baseIndent + indentUnit;

    let inSingle = false;
    let inDouble = false;
    let depth = 0;
    const plusDepths = [];
    const plusIndices = [];

    let exprStart = 0;
    const assignMatch = lineText.match(/^(\s*(?:(?:string|integer|float|boolean|dict|json|jsonarray|date)\s+)?[a-zA-Z_]\w*\s*=\s*)/i);
    const returnMatch = lineText.match(/^(\s*(?:return|print)\s+)/i);

    if (assignMatch) {
        exprStart = assignMatch[0].length;
    } else if (returnMatch) {
        exprStart = returnMatch[0].length;
    }

    for (let i = exprStart; i < lineText.length; i++) {
        const ch = lineText[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') {
                depth++;
            } else if (ch === ')' || ch === ']' || ch === '}') {
                depth = Math.max(0, depth - 1);
            } else if (ch === '+') {
                const prev = lineText[i - 1];
                const next = lineText[i + 1];
                if (prev !== '+' && next !== '+') {
                    plusIndices.push({ index: i, depth });
                    plusDepths.push(depth);
                }
            }
        }
    }

    if (plusIndices.length === 0) return null;

    const minDepth = Math.min(...plusDepths);
    if (minDepth > 1) return null;

    const topPlusIndices = plusIndices.filter(p => p.depth === minDepth).map(p => p.index);
    if (topPlusIndices.length === 0) return null;

    const parts = [];
    let lastIdx = exprStart;
    for (const pIdx of topPlusIndices) {
        parts.push(lineText.substring(lastIdx, pIdx).trim());
        lastIdx = pIdx + 1;
    }
    parts.push(lineText.substring(lastIdx).trim());

    if (parts.length <= 1) return null;

    const prefix = lineText.substring(0, exprStart);
    const formattedLines = [];

    formattedLines.push(`${prefix}${parts[0]}`);

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const strLiterals = findStringLiterals(part);
        if (strLiterals.length === 1 && strLiterals[0].start === 0 && strLiterals[0].end === part.replace(/;$/, '').length && part.length > 75) {
            const hasTrailingSemi = part.endsWith(';');
            const { quote, content } = strLiterals[0];
            const chunks = chunkStringContent(content, quote, 60);
            for (let c = 0; c < chunks.length; c++) {
                const isLastChunk = (c === chunks.length - 1);
                formattedLines.push(`${continuationIndent}+ ${chunks[c]}${isLastChunk && hasTrailingSemi ? ';' : ''}`);
            }
        } else {
            formattedLines.push(`${continuationIndent}+ ${part}`);
        }
    }

    return formattedLines.join('\n');
}

function splitFunctionArgumentsIntoLines(lineText) {
    const match = lineText.match(/^(\s*(?:(?:string|integer|float|boolean|dict|json|jsonarray|date)\s+)?[a-zA-Z_]\w*\s*=\s*)?(\s*[a-zA-Z_]\w*\s*\()(.*)(\)\s*;?\s*)$/);
    if (!match) return null;

    const baseIndent = lineText.match(/^\s*/)[0];
    const indentUnit = baseIndent.includes('\t') ? '\t' : '    ';
    const continuationIndent = baseIndent + indentUnit;

    const prefix = (match[1] || '') + match[2];
    const argsContent = match[3];
    const suffix = match[4];

    let inSingle = false;
    let inDouble = false;
    let depth = 0;
    const commaIndices = [];

    for (let i = 0; i < argsContent.length; i++) {
        const ch = argsContent[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
        } else if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
        } else if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
            else if (ch === ',' && depth === 0) {
                commaIndices.push(i);
            }
        }
    }

    if (commaIndices.length === 0) return null;

    const args = [];
    let lastIdx = 0;
    for (const cIdx of commaIndices) {
        args.push(argsContent.substring(lastIdx, cIdx).trim());
        lastIdx = cIdx + 1;
    }
    args.push(argsContent.substring(lastIdx).trim());

    const formattedLines = [];
    formattedLines.push(prefix);
    for (let i = 0; i < args.length; i++) {
        const isLast = (i === args.length - 1);
        formattedLines.push(`${continuationIndent}${args[i]}${isLast ? '' : ','}`);
    }
    formattedLines.push(`${baseIndent}${suffix}`);

    return formattedLines.join('\n');
}

function splitConditionIntoLines(lineText) {
    const match = lineText.match(/^(\s*)(if|elif)\s*\(/i);
    if (!match) return null;

    const baseIndent = match[1];
    const keyword = match[2];
    const condStartIndex = match[0].length;

    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let condEndIndex = -1;

    for (let i = condStartIndex; i < lineText.length; i++) {
        const ch = lineText[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        if (inSingle || inDouble) continue;

        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) {
                condEndIndex = i;
                break;
            }
        }
    }

    if (condEndIndex === -1) return null;

    const condContent = lineText.substring(condStartIndex, condEndIndex);
    const afterCondition = lineText.substring(condEndIndex + 1).trim();

    depth = 0;
    inSingle = false;
    inDouble = false;
    const parts = [];
    let currentPart = '';

    for (let i = 0; i < condContent.length; i++) {
        const ch = condContent[i];
        if (ch === '\\') {
            currentPart += ch + (condContent[i + 1] || '');
            i++;
            continue;
        }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;

        if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

            if (depth === 0) {
                const rest = condContent.substring(i);
                const opMatch = rest.match(/^\b(AND|OR|and|or)\b/);
                if (opMatch && currentPart.trim().length > 0) {
                    parts.push(currentPart.trim());
                    currentPart = opMatch[1] + ' ';
                    i += opMatch[0].length;
                    continue;
                }
            }
        }
        currentPart += ch;
    }

    if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim());
    }

    if (parts.length <= 1) return null;

    const indentUnit = baseIndent.includes('\t') ? '\t' : '    ';
    const continuationIndent = baseIndent + indentUnit;
    const formattedLines = [];

    formattedLines.push(`${baseIndent}${keyword} (${parts[0]}`);
    for (let i = 1; i < parts.length; i++) {
        const isLast = (i === parts.length - 1);
        const closing = isLast ? `)${afterCondition.length > 0 ? ` ${afterCondition}` : ''}` : '';
        formattedLines.push(`${continuationIndent}${parts[i]}${closing}`);
    }

    return formattedLines.join('\n');
}

module.exports = {
    findStringLiterals,
    chunkStringContent,
    splitLongStringLiteral,
    splitConcatenationIntoLines,
    splitFunctionArgumentsIntoLines,
    splitConditionIntoLines
};
