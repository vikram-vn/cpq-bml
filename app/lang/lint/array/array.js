const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../typeCheck');
const vscode = require('vscode');

function checkArray(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

    // Negative literal array size: <type>[-N] or <type>[-N][n] / [n][-N]
    const negativeArraySizeRegex = /\b(float|integer|string|boolean|date)\s*\[\s*(-\d+)\s*\]/gi;
    while ((match = negativeArraySizeRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Error: A negative array size ('${match[2]}') always throws a runtime exception. Array sizes must be 0 or positive.`,
            vscode.DiagnosticSeverity.Error,
            'bml-negative-array-size'
        ));
    }

    // bytearray() call validation
    const bytearrayRegex = /\bbytearray\s*\(/g;
    while ((match = bytearrayRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length < 1 || args.length > 2) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'bytearray()' expects 1 or 2 arguments, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        } else {
            // Type checking
            for (let i = 0; i < args.length; i++) {
                const actual = inferExpressionType(args[i]);
                if (actual && actual !== 'String') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: Argument ${i + 1} to 'bytearray' should be String, but got ${actual}.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkArray };
