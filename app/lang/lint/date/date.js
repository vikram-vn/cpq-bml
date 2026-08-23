const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../typeCheck');
const vscode = require('vscode');

function checkDate(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

    // Deprecated date methods (run on noStringsText to ignore calls inside strings/comments)
    const deprecatedRegex = /\bstrtodate\b/g;
    while ((match = deprecatedRegex.exec(noStringsText)) !== null) {
        const name = match[0];
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, name.length);

        const message = `Deprecated function 'strtodate'. Use 'strtojavadate' instead`;
        const severity = vscode.DiagnosticSeverity.Hint;
        const code = 'bml-strtodate-fix';

        const diag = makeDiagnostic(new vscode.Range(startPos, endPos), message, severity, code);
        diag.tags = [vscode.DiagnosticTag.Deprecated];
        diagnostics.push(diag);
    }

    // date() call validation
    const dateRegex = /\bdate\s*\(/g;
    while ((match = dateRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        const allowedCounts = [0, 1, 3, 6];
        if (!allowedCounts.includes(args.length)) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'date()' expects 0, 1, 3, or 6 arguments, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        } else {
            // Type checking
            if (args.length === 1) {
                const actual = inferExpressionType(args[0]);
                if (actual && actual !== 'Integer' && actual !== 'String') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 1 to 'date' should be Integer (timestamp) or String, but got ${actual}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            } else if (args.length === 3 || args.length === 6) {
                for (let i = 0; i < args.length; i++) {
                    const actual = inferExpressionType(args[i]);
                    if (actual && actual !== 'Integer') {
                        const startPos = doc.positionAt(match.index);
                        const endPos = doc.positionAt(closeParenIndex + 1);
                        diagnostics.push(makeDiagnostic(
                            new vscode.Range(startPos, endPos),
                            `Error: Argument ${i + 1} to 'date' should be Integer, but got ${actual}.`,
                            vscode.DiagnosticSeverity.Error,
                            'bml-function-arg-type'
                        ));
                    }
                }
            }
        }
    }

    // Date format pattern checks for formatdate and strtojavadate
    const dateFuncRegex = /\b(formatdate|strtojavadate|strtodate)\s*\(/g;
    while ((match = dateFuncRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length >= 2) {
            const formatArg = args[1].trim();
            const strMatch = formatArg.match(/^(?:"([^"\\]*)"|'([^'\\]*)')$/);
            if (strMatch) {
                const pattern = strMatch[1] !== undefined ? strMatch[1] : strMatch[2];
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);

                if (pattern.includes('YYYY')) {
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        "Warning: 'YYYY' is Week Year in Java SimpleDateFormat, which causes wrong year calculations around New Year's Eve. Use lowercase 'yyyy' for calendar year.",
                        vscode.DiagnosticSeverity.Warning,
                        'bml-date-format-year'
                    ));
                }
                if (pattern.includes('DD')) {
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        "Warning: 'DD' is Day of Year (1-365). Use lowercase 'dd' for Day of Month.",
                        vscode.DiagnosticSeverity.Warning,
                        'bml-date-format-day'
                    ));
                }
                if (/(?:yyyy|dd)[-/\s]mm|mm[-/\s](?:dd|yyyy)/.test(pattern)) {
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        "Warning: Lowercase 'mm' represents Minutes (0-59). Use uppercase 'MM' for Month.",
                        vscode.DiagnosticSeverity.Warning,
                        'bml-date-format-month'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkDate };
