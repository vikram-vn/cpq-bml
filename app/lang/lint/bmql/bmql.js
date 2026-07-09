const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../typeCheck');
const vscode = require('vscode');

function checkBmql(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

    // Deprecated direct DB access methods (run on noStringsText to ignore calls inside strings/comments)
    const deprecatedRegex = /\b(gettabledata|getpartsdata)\b/g;
    while ((match = deprecatedRegex.exec(noStringsText)) !== null) {
        const name = match[1];
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, name.length);

        const message = `Deprecated function '${name}'. Use 'bmql' instead to avoid SQL injection vulnerability`;
        const severity = vscode.DiagnosticSeverity.Error; // SQL vulnerability is High risk
        const code = name === 'gettabledata' ? 'bml-gettabledata-fix' : 'bml-getpartsdata-fix';

        diagnostics.push(makeDiagnostic(new vscode.Range(startPos, endPos), message, severity, code));
    }

    // bmql() call validation
    const bmqlRegex = /\bbmql\s*\(/g;
    while ((match = bmqlRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length < 1 || args.length > 3) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'bmql()' expects 1 to 3 arguments, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        } else {
            // Type checking
            if (args.length >= 1) {
                const actual1 = inferExpressionType(args[0]);
                if (actual1 && actual1 !== 'String') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: Argument 1 to 'bmql' should be String, but got ${actual1}.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-function-arg-type'
                    ));
                }
            }
            if (args.length >= 2) {
                const actual2 = inferExpressionType(args[1]);
                if (actual2 && actual2 !== 'Dictionary') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: Argument 2 to 'bmql' should be Dictionary, but got ${actual2}.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-function-arg-type'
                    ));
                }
            }
            if (args.length === 3) {
                const actual3 = inferExpressionType(args[2]);
                if (actual3 && actual3 !== 'Dictionary') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: Argument 3 to 'bmql' should be Dictionary, but got ${actual3}.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    // recordset() call validation
    const recordsetRegex = /\brecordset\s*\(/g;
    while ((match = recordsetRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length > 0) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'recordset()' expects 0 arguments, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        }
    }

    return diagnostics;
}

module.exports = { checkBmql };
