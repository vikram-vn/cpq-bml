const vscode = require('vscode');

// Two different "cleaned" views are needed here, for two different reasons:
//  - cleanText (comments blanked, strings left intact) is used to decide what a
//    line's code actually ends with. Real comments are already gone (so no need
//    to re-detect "//" markers - and crucially no risk of mistaking a "//" inside
//    a string like a URL for one), but string content is still real, so a line
//    like `x = "hello"` still visibly ends with a quote rather than an `=` that
//    would otherwise be misread as a continuation operator once the string is
//    blanked to spaces and trimmed away.
//  - noStringsText (comments AND strings blanked) is used only for paren/bracket
//    depth tracking, since an unbalanced paren inside a string literal (e.g.
//    `msg = "Enter your name (";`) would otherwise corrupt depth-counting for
//    the rest of the file.
// Both are blanked length-preserving (see lint.js's blank()), so they line up
// index-for-index with each other and with the original document.
function checkMissingSemicolons(cleanText, noStringsText, conditionRanges) {
    const diagnostics = [];
    const lines = cleanText.split(/\r?\n/);
    const noStringsLines = noStringsText.split(/\r?\n/);

    // Line start offsets into cleanText (and therefore into the original text
    // too, since blanking preserves length and line breaks exactly).
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

    // Track paren/bracket depth at the end of each line (computed from the
    // string-free view), so continuation lines inside an unfinished call/array
    // don't get flagged.
    // Also track whether we're inside an array/dict literal body, e.g.
    //   returnCol = String[] {
    //       "name",
    //       "value"
    //   };
    // Individual element lines there don't end in ';' and aren't wrapped in ()/[]
    // either, so without this they'd be wrongly flagged as missing a semicolon.
    // A literal body is identified by its opening '{' being preceded by ']'
    // (the array type declarator), as opposed to a control-block '{' which
    // follows a condition's ')' or 'else'/'try' etc.
    const lineParenDepths = [];
    const lineBracketDepths = [];
    const lineInLiteralBrace = [];
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
                braceStack.pop();
            }
        }
        lineParenDepths[lineIndex] = parenDepth;
        lineBracketDepths[lineIndex] = bracketDepth;
        lineInLiteralBrace[lineIndex] = braceStack.length > 0 && braceStack[braceStack.length - 1] === true;
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

    // A continuation line that opens a multi-line boolean expression with a
    // logical operator, e.g. "    AND b" - matched by whole word, not prefix,
    // so identifiers that merely start with those letters (orderId, notesField,
    // androidFlag, ...) aren't mistaken for a continuation and skipped.
    const startsWithContinuationOperator = (trimmed) => /^(AND|OR|NOT)\b/i.test(trimmed);

    // BML has no unary '+', so a line starting with a lone '+' (not '++', which
    // isn't valid BML anyway and is handled separately) is unambiguously a
    // continuation of the previous line's expression, e.g.:
    //   ret = ret + a + "|"
    //       + b + "|";
    const nextLineContinuesWithPlus = (nextCodeLine) => /^\+(?!\+)/.test(nextCodeLine || '');

    const shouldSkipSemicolonCheck = (codeLine, lineIndex, nextCodeLine) => {
        if (!codeLine) return true;
        if (codeLine.endsWith(';') || codeLine.endsWith('{') || codeLine.endsWith('}')) return true;
        if (isLineInCondition(lineIndex)) return true;

        // Skip lines ending with an operator/separator (continuation line)
        if (endsWithOperator(codeLine)) return true;
        if (nextLineContinuesWithPlus(nextCodeLine)) return true;

        // Skip lines that start or end inside parentheses or brackets
        if (lineParenDepths[lineIndex] > 0 || lineBracketDepths[lineIndex] > 0) return true;
        if (lineIndex > 0 && (lineParenDepths[lineIndex - 1] > 0 || lineBracketDepths[lineIndex - 1] > 0)) return true;

        // Skip element lines inside a multi-line array/dict literal body
        if (lineInLiteralBrace[lineIndex]) return true;
        if (lineIndex > 0 && lineInLiteralBrace[lineIndex - 1]) return true;

        // Skip control flow statements
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

        // Skip multi-line boolean expression continuations (see comment above).
        if (startsWithContinuationOperator(codeLine)) continue;

        const nextCodeLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (shouldSkipSemicolonCheck(codeLine, i, nextCodeLine)) continue;

        // Report missing semicolon
        const range = new vscode.Range(i, lines[i].length - 1, i, lines[i].length);
        const diag = new vscode.Diagnostic(range, 'Missing semicolon', vscode.DiagnosticSeverity.Error);
        diag.code = 'bml-missing-semicolon';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkMissingSemicolons };
