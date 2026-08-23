/**
 * Complexity Calculator
 *
 * Computes code quality metrics for a single BML file:
 *  - cyclomaticComplexity: number of decision points + 1
 *  - nestingDepth: maximum brace nesting depth
 *  - lineCount: total non-empty, non-comment lines
 */

function computeComplexity(text) {
    const len = text.length;
    let decisionCount = 0;
    let currentDepth = 0;
    let maxDepth = 0;
    let lineCount = len > 0 ? 1 : 0;
    let codeLines = 0;

    let inLineComment = false;
    let inBlockComment = false;
    let inString = false;
    let stringChar = 0;
    let lineHasCode = false;

    let i = 0;
    while (i < len) {
        const c = text.charCodeAt(i);

        if (c === 10) { // '\n'
            lineCount++;
            if (lineHasCode && !inBlockComment) {
                codeLines++;
            }
            lineHasCode = false;
            inLineComment = false;
            i++;
            continue;
        }

        if (inLineComment) {
            i++;
            continue;
        }

        if (inBlockComment) {
            if (c === 42 && i + 1 < len && text.charCodeAt(i + 1) === 47) { // '*/'
                inBlockComment = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }

        if (inString) {
            if (c === 92) { // '\\'
                i += 2; // skip escaped character
                continue;
            }
            if (c === stringChar) {
                inString = false;
            }
            i++;
            continue;
        }

        // Check for comments
        if (c === 47 && i + 1 < len) { // '/'
            const next = text.charCodeAt(i + 1);
            if (next === 47) { // '//'
                inLineComment = true;
                i += 2;
                continue;
            }
            if (next === 42) { // '/*'
                inBlockComment = true;
                i += 2;
                continue;
            }
        }

        // Check for string start
        if (c === 34 || c === 39) { // '"' or "'"
            inString = true;
            stringChar = c;
            lineHasCode = true;
            i++;
            continue;
        }

        // Check for braces
        if (c === 123) { // '{'
            lineHasCode = true;
            currentDepth++;
            if (currentDepth > maxDepth) maxDepth = currentDepth;
            i++;
            continue;
        }
        if (c === 125) { // '}'
            lineHasCode = true;
            currentDepth = Math.max(0, currentDepth - 1);
            i++;
            continue;
        }

        if (c > 32) {
            lineHasCode = true;
        }

        // Decision keywords: if, elif, for, and, or
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95) {
            const wordStart = i;
            while (i < len) {
                const wc = text.charCodeAt(i);
                if ((wc >= 65 && wc <= 90) || (wc >= 97 && wc <= 122) || (wc >= 48 && wc <= 57) || wc === 95) {
                    i++;
                } else {
                    break;
                }
            }
            const wordLen = i - wordStart;
            if (wordLen === 2) {
                const w0 = text.charCodeAt(wordStart) | 32;
                const w1 = text.charCodeAt(wordStart + 1) | 32;
                if ((w0 === 105 && w1 === 102) || (w0 === 111 && w1 === 114)) { // "if" or "or"
                    decisionCount++;
                }
            } else if (wordLen === 3) {
                const w0 = text.charCodeAt(wordStart) | 32;
                const w1 = text.charCodeAt(wordStart + 1) | 32;
                const w2 = text.charCodeAt(wordStart + 2) | 32;
                if ((w0 === 102 && w1 === 111 && w2 === 114) || (w0 === 97 && w1 === 110 && w2 === 100)) { // "for" or "and"
                    decisionCount++;
                }
            } else if (wordLen === 4) {
                const w0 = text.charCodeAt(wordStart) | 32;
                const w1 = text.charCodeAt(wordStart + 1) | 32;
                const w2 = text.charCodeAt(wordStart + 2) | 32;
                const w3 = text.charCodeAt(wordStart + 3) | 32;
                if (w0 === 101 && w1 === 108 && w2 === 105 && w3 === 102) { // "elif"
                    decisionCount++;
                }
            }
            continue;
        }

        i++;
    }

    if (lineHasCode && !inBlockComment) {
        codeLines++;
    }

    return {
        cyclomaticComplexity: decisionCount + 1,
        nestingDepth: maxDepth,
        lineCount,
        codeLines,
    };
}

module.exports = { computeComplexity };
