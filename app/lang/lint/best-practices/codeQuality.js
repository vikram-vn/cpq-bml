const { vscode, makeDiagnostic } = require('./shared');

const STANDARD_NUMBERS = new Set(['0', '1', '2', '10', '100', '0.0', '1.0', '2.0', '-1', '-1.0']);
const HTTP_STATUS_CODES = new Set([
    '200', '201', '202', '204',
    '301', '302', '304',
    '400', '401', '403', '404', '408', '409', '422', '429',
    '500', '502', '503', '504'
]);
const TIME_UNIT_MULTIPLIERS = new Set(['24', '60', '3600', '86400', '1000', '365']);
const SAFE_CONTEXT_FUNCTIONS = new Set([
    'substring', 'left', 'right', 'find', 'findfirst', 'findlast', 'search',
    'startswith', 'endswith', 'replace', 'len', 'split',
    'range', 'subarray', 'insert', 'remove', 'get', 'set', 'sizeofarray',
    'adddays', 'addmonths', 'addyears', 'addweeks', 'addhours', 'addminutes', 'addseconds',
    'minusdays', 'minusmonths', 'minusyears', 'minusweeks', 'minushours', 'minusminutes', 'minusseconds',
    'getdate', 'time', 'getyear', 'getmonth', 'getday'
]);

function isInsideSquareBrackets(linePrefix) {
    let openCount = 0;
    for (let i = 0; i < linePrefix.length; i++) {
        const c = linePrefix.charCodeAt(i);
        if (c === 91) openCount++; // '['
        else if (c === 93) openCount--; // ']'
    }
    return openCount > 0;
}

function isIndexArithmetic(linePrefix, val) {
    const num = parseFloat(val);
    if (Number.isInteger(num) && num >= -10 && num <= 10) {
        return /\b[a-zA-Z_]\w*\s*[+\-]\s*$/.test(linePrefix);
    }
    return false;
}

function isInsideSafeFunctionCall(text, index) {
    let depth = 0;
    const minBound = Math.max(0, index - 300);
    for (let i = index - 1; i >= minBound; i--) {
        const ch = text[i];
        if (ch === ')') {
            depth++;
        } else if (ch === '(') {
            if (depth > 0) {
                depth--;
            } else {
                const beforeParen = text.substring(Math.max(0, i - 40), i).trim();
                const funcMatch = beforeParen.match(/\b([a-zA-Z_]\w*)$/);
                if (funcMatch) {
                    const funcName = funcMatch[1].toLowerCase();
                    return SAFE_CONTEXT_FUNCTIONS.has(funcName);
                }
                break;
            }
        } else if (ch === ';' || ch === '{' || ch === '}') {
            if (depth === 0) break;
        }
    }
    return false;
}

function isComparisonContext(linePrefix, lineSuffix) {
    if (/(?:==|!=|<>|>=|<=|>|<)\s*$/.test(linePrefix)) {
        return true;
    }
    if (/^\s*(?:==|!=|<>|>=|<=|>|<)/.test(lineSuffix)) {
        return true;
    }
    return false;
}

function isHttpStatusCheck(linePrefix, lineSuffix, val) {
    if (!HTTP_STATUS_CODES.has(val)) return false;
    const lineCombined = linePrefix + val + lineSuffix;
    return /\b(?:status|statusCode|httpStatus|responseCode|code|resultCode|urldata|http)\b/i.test(lineCombined) &&
           /(?:==|!=|<=|>=|<|>)\s*\b\d+\b|\b\d+\b\s*(?:==|!=|<=|>=|<|>)/.test(lineCombined);
}

function isTimeMultiplier(linePrefix, lineSuffix, val) {
    if (!TIME_UNIT_MULTIPLIERS.has(val)) return false;
    return /[*/]\s*$/.test(linePrefix) || /^\s*[*/]/.test(lineSuffix);
}

function isBmqlClause(linePrefix) {
    return /\b(?:LIMIT|OFFSET|FETCH\s+FIRST)\s+$/i.test(linePrefix);
}

/**
 * General code-quality checks: empty blocks, magic numbers, missing return.
 *
 * Codes: bml-empty-block, bml-magic-number, bml-missing-return
 */
function checkCodeQuality(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Empty Blocks (run on noStringsText)
    const emptyBlockRegex = /\b(if|elif)\s*\(.*?\)\s*\{\s*\}|\bfor\s*(?:\(.*?\)|[^{]*?)\s*\{\s*\}|\belse\s*\{\s*\}/gi;
    let match;
    while ((match = emptyBlockRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            'Syntax Error: Empty block detected',
            vscode.DiagnosticSeverity.Error,
            'bml-empty-block'
        ));
    }

    // Magic Numbers (run on noStringsText to ignore numbers inside strings)
    const magicNumRegex = /\b\d+(?:\.\d+)?\b/g;
    while ((match = magicNumRegex.exec(noStringsText)) !== null) {
        const val = match[0];
        if (STANDARD_NUMBERS.has(val)) {
            continue;
        }

        const index = match.index;
        if (index > 0) {
            const precedingChar = noStringsText[index - 1];
            if (precedingChar === '.' || precedingChar === '_' || /[a-zA-Z]/.test(precedingChar)) {
                continue; // part of property or variable name
            }
        }

        const lineStart = noStringsText.lastIndexOf('\n', index) + 1;
        let lineEnd = noStringsText.indexOf('\n', index);
        if (lineEnd === -1) lineEnd = noStringsText.length;
        const linePrefix = noStringsText.substring(lineStart, index);
        const lineSuffix = noStringsText.substring(index + val.length, lineEnd);

        // 1. Constant candidate definition (e.g. CONST_2026 = 2026; or MY_CONST = 2026;)
        if (/\b(?:CONST_[a-zA-Z0-9_]+|[A-Z0-9_]{2,})\s*=\s*$/.test(linePrefix.trim())) {
            continue;
        }

        // 2. Negative sentinel/number (e.g. -1, -1.0)
        if (linePrefix.trimEnd().endsWith('-')) {
            const opCheck = linePrefix.trimEnd().slice(0, -1).trimEnd();
            if (opCheck.endsWith('=') || opCheck.endsWith('==') || opCheck.endsWith('!=') || opCheck.endsWith('(') || opCheck.endsWith(',')) {
                if (STANDARD_NUMBERS.has('-' + val)) {
                    continue;
                }
            }
        }

        // 3. Array indexing brackets (e.g. arr[0], arr[i + 1])
        if (isInsideSquareBrackets(linePrefix)) {
            continue;
        }

        // 4. Index arithmetic (e.g. i + 1, len - 1, idx + 2)
        if (isIndexArithmetic(linePrefix, val)) {
            continue;
        }

        // 5. Safe built-in function argument (e.g. substring(s, 0, 5), adddays(d, 7), range(0, 10))
        if (isInsideSafeFunctionCall(noStringsText, index)) {
            continue;
        }

        // 6. Comparison expressions (e.g. mId_18 > 40, mRate_18 > 600.0, status == 200)
        if (isComparisonContext(linePrefix, lineSuffix)) {
            continue;
        }

        // 7. Time / unit multiplier (e.g. sec * 1000, hours * 60, days * 24)
        if (isTimeMultiplier(linePrefix, lineSuffix, val)) {
            continue;
        }

        // 8. BMQL clause (e.g. LIMIT 50, OFFSET 10)
        if (isBmqlClause(linePrefix)) {
            continue;
        }

        const startPos = doc.positionAt(index);
        const endPos = startPos.translate(0, val.length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Design Info: Magic number '${val}' detected. Consider defining a named constant`,
            vscode.DiagnosticSeverity.Information,
            'bml-magic-number'
        ));
    }

    // Missing Return Statement Check (run on noStringsText to ignore return in strings/comments)
    if (!/\breturn\b/.test(noStringsText)) {
        const startPos = new vscode.Position(0, 0);
        const endLineText = doc.lineCount > 0 ? doc.lineAt(0).text : '';
        const endPos = new vscode.Position(0, Math.max(1, endLineText.length));
        const range = new vscode.Range(startPos, endPos);
        diagnostics.push(makeDiagnostic(
            range,
            "Script is missing a return statement",
            vscode.DiagnosticSeverity.Error,
            'bml-missing-return'
        ));
    }

    return diagnostics;
}

module.exports = { checkCodeQuality };
