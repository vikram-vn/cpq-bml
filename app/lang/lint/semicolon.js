const vscode = require('vscode');

// cleanText (strings intact) decides what a line's code actually ends with - e.g. `x =
// "hello"` must still visibly end with a quote, not an `=` misread as a continuation
// operator. noStringsText (strings also blanked) is used only for paren/bracket depth
// tracking, so an unbalanced paren inside a string literal can't corrupt depth-counting.
function checkMissingSemicolons(cleanText, noStringsText, conditionRanges) {
    const diagnostics = [];
    const lines = cleanText.split(/\r?\n/);
    const noStringsLines = noStringsText.split(/\r?\n/);

    const lineStarts = [];
    {
        let pos = 0;
        for (const line of lines) {
            lineStarts.push(pos);
            pos += line.length;
            if (cleanText.substring(pos, pos + 2) === '\r\n') pos += 2;
            else if (cleanText[pos] === '\n') pos += 1;
        }
    }

    // Also tracks whether a line is inside an array/dict literal body (e.g.
    // `returnCol = String[] { "name", "value" };`), identified by its opening '{' being
    // preceded by ']' - those element lines don't end in ';' or sit inside ()/[].
    const lineParenDepths = [];
    const lineBracketDepths = [];
    const lineInLiteralBrace = [];
    const lineBraceDepths = [];
    const lineClosesLiteralBrace = [];
    let parenDepth = 0;
    let bracketDepth = 0;
    const braceStack = [];
    for (let lineIndex = 0; lineIndex < noStringsLines.length; lineIndex++) {
        const line = noStringsLines[lineIndex];
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '(') parenDepth++;
            else if (line[i] === ')') parenDepth = Math.max(0, parenDepth - 1);
            else if (line[i] === '[') bracketDepth++;
            else if (line[i] === ']') bracketDepth = Math.max(0, bracketDepth - 1);
            else if (line[i] === '{') {
                let j = i - 1;
                while (j >= 0 && /\s/.test(line[j])) j--;
                braceStack.push(j >= 0 && line[j] === ']');
            } else if (line[i] === '}') {
                const popped = braceStack.pop();
                if (popped === true) {
                    lineClosesLiteralBrace[lineIndex] = true;
                }
            }
        }
        lineParenDepths[lineIndex] = parenDepth;
        lineBracketDepths[lineIndex] = bracketDepth;
        lineInLiteralBrace[lineIndex] = braceStack.length > 0 && braceStack[braceStack.length - 1] === true;
        lineBraceDepths[lineIndex] = braceStack.length;
    }

    const isLineInCondition = (lineIndex) => {
        const lineStart = lineStarts[lineIndex];
        const lineEnd = lineStart + lines[lineIndex].length;
        return conditionRanges.some(([start, end]) => start < lineEnd && end > lineStart);
    };

    const endsWithOperator = (codeLine) => {
        const trimmed = codeLine.trim();
        if (!trimmed) return false;

        const lastChar = trimmed[trimmed.length - 1];
        if (['+', '-', '*', '/', '=', '<', '>', ',', '&', '|'].includes(lastChar)) {
            return true;
        }

        const upper = trimmed.toUpperCase();
        if (upper.endsWith(' AND') || upper.endsWith('\tAND') ||
            upper.endsWith(' OR') || upper.endsWith('\tOR') ||
            upper.endsWith(' NOT') || upper.endsWith('\tNOT') ||
            upper === 'AND' || upper === 'OR' || upper === 'NOT') {
            return true;
        }

        return false;
    };

    // Matched by whole word so identifiers like orderId/androidFlag aren't mistaken for continuations.
    const startsWithContinuationOperator = (trimmed) => /^(AND|OR|NOT)\b/i.test(trimmed);

    // BML has no unary '+', so a line starting with a lone '+' is unambiguously a
    // continuation of the previous line's expression.
    const nextLineContinuesWithPlus = (nextCodeLine) => /^\+(?!\+)/.test(nextCodeLine || '');

    const shouldSkipSemicolonCheck = (codeLine, lineIndex, nextCodeLine) => {
        if (!codeLine) return true;
        if (codeLine.endsWith(';') || codeLine.endsWith('{')) return true;

        if (codeLine.endsWith('}')) {
            // Skip check unless it closes a literal array/dict brace
            if (!lineClosesLiteralBrace[lineIndex]) {
                return true;
            }
            // If it's a nested block/literal closing, skip
            if (lineBraceDepths[lineIndex] > 0 || lineParenDepths[lineIndex] > 0 || lineBracketDepths[lineIndex] > 0) {
                return true;
            }
        }

        if (isLineInCondition(lineIndex)) return true;

        if (endsWithOperator(codeLine)) return true;
        if (nextLineContinuesWithPlus(nextCodeLine)) return true;

        if (lineParenDepths[lineIndex] > 0 || lineBracketDepths[lineIndex] > 0) return true;
        if (lineIndex > 0 && (lineParenDepths[lineIndex - 1] > 0 || lineBracketDepths[lineIndex - 1] > 0)) return true;

        if (lineInLiteralBrace[lineIndex]) return true;
        if (lineIndex > 0 && lineInLiteralBrace[lineIndex - 1] && !lineClosesLiteralBrace[lineIndex]) return true;

        const cleanedStart = codeLine.replace(/^[{}()\s]+/, '');
        const lowerCleaned = cleanedStart.toLowerCase();
        if (lowerCleaned.startsWith('if') ||
            lowerCleaned.startsWith('elif') ||
            lowerCleaned.startsWith('else') ||
            lowerCleaned.startsWith('for')) {
            const firstWord = lowerCleaned.split(/[^a-zA-Z]/)[0];
            if (['if', 'elif', 'else', 'for'].includes(firstWord)) {
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < lines.length; i++) {
        const codeLine = lines[i].trim();
        if (!codeLine) continue;

        if (startsWithContinuationOperator(codeLine)) continue;

        const nextCodeLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (shouldSkipSemicolonCheck(codeLine, i, nextCodeLine)) continue;

        const range = new vscode.Range(i, 0, i, lines[i].length);
        const diag = new vscode.Diagnostic(range, 'Missing semicolon', vscode.DiagnosticSeverity.Error);
        diag.code = 'bml-missing-semicolon';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkMissingSemicolons };
