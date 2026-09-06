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
    const totalLines = noStringsLines.length;
    const lineParenDepths = new Int32Array(totalLines);
    const lineBracketDepths = new Int32Array(totalLines);
    const lineInLiteralBrace = new Uint8Array(totalLines);
    const lineBraceDepths = new Int32Array(totalLines);
    const lineClosesLiteralBrace = new Uint8Array(totalLines);
    let parenDepth = 0;
    let bracketDepth = 0;
    const braceStack = [];
    for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
        const line = noStringsLines[lineIndex];
        for (let i = 0; i < line.length; i++) {
            const c = line.charCodeAt(i);
            if (c === 40) parenDepth++; // '('
            else if (c === 41) parenDepth = parenDepth > 0 ? parenDepth - 1 : 0; // ')'
            else if (c === 91) bracketDepth++; // '['
            else if (c === 93) bracketDepth = bracketDepth > 0 ? bracketDepth - 1 : 0; // ']'
            else if (c === 123) { // '{'
                let j = i - 1;
                while (j >= 0 && line.charCodeAt(j) <= 32) j--;
                braceStack.push(j >= 0 && line.charCodeAt(j) === 93); // ']'
            } else if (c === 125) { // '}'
                const popped = braceStack.pop();
                if (popped === true) {
                    lineClosesLiteralBrace[lineIndex] = 1;
                }
            }
        }
        lineParenDepths[lineIndex] = parenDepth;
        lineBracketDepths[lineIndex] = bracketDepth;
        lineInLiteralBrace[lineIndex] = (braceStack.length > 0 && braceStack[braceStack.length - 1] === true) ? 1 : 0;
        lineBraceDepths[lineIndex] = braceStack.length;
    }

    const conditionLineSet = new Set();
    if (conditionRanges && conditionRanges.length > 0) {
        let lineIdx = 0;
        for (const [cStart, cEnd] of conditionRanges) {
            while (lineIdx < lineStarts.length && lineStarts[lineIdx] + lines[lineIdx].length <= cStart) {
                lineIdx++;
            }
            let cur = lineIdx;
            while (cur < lineStarts.length && lineStarts[cur] < cEnd) {
                conditionLineSet.add(cur);
                cur++;
            }
        }
    }

    const isLineInCondition = (lineIndex) => conditionLineSet.has(lineIndex);

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

function checkConsecutiveSemicolons(noStringsText, doc, passedVscode) {
    const vs = passedVscode || vscode;
    const diagnostics = [];
    if (!noStringsText || !noStringsText.includes(';')) return diagnostics;

    const consecutiveSemiRegex = /;([ \t\r\n]*;)+/g;
    let match;
    while ((match = consecutiveSemiRegex.exec(noStringsText)) !== null) {
        const startPos = doc ? doc.positionAt(match.index) : new vs.Position(0, 0);
        const endPos = doc ? doc.positionAt(match.index + match[0].length) : startPos;
        const diag = new vs.Diagnostic(
            new vs.Range(startPos, endPos),
            "Syntax Error: Unexpected consecutive semicolon ';;' (empty statements are not allowed in BML).",
            vs.DiagnosticSeverity.Error
        );
        diag.code = 'bml-consecutive-semicolon';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkMissingSemicolons, checkConsecutiveSemicolons };
