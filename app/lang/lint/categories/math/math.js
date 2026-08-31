const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../../rules/typeCheck');
const vscode = require('vscode');

function checkMath(cleanText, noStringsText, doc, firstTypeByVar) {
    const diagnostics = [];
    if (!noStringsText.includes('NaN') && !cleanText.includes('jNaN') && !cleanText.includes('acos') && !cleanText.includes('asin') && !cleanText.includes('integer') && !cleanText.includes('float') && !cleanText.includes('boolean')) {
        return diagnostics;
    }
    let match;

    // Oracle Constants: NaN vs jNaN (run on noStringsText)
    const nanRegex = /\bNaN\b/g;
    while ((match = nanRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, 3);
        const diag = makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Deprecated constant 'NaN'. Use 'jNaN' instead for Java compatibility",
            vscode.DiagnosticSeverity.Hint,
            'bml-nan-fix'
        );
        diag.tags = [vscode.DiagnosticTag.Deprecated];
        diagnostics.push(diag);
    }

    // jNaN is a constant, not a function - check for jNaN(...) calls
    const jnanCallRegex = /\bjNaN\s*\(/g;
    while ((match = jnanCallRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        const endOffset = closeParenIndex !== -1 ? closeParenIndex + 1 : match.index + match[0].length;
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(endOffset);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Error: 'jNaN' is a constant, not a function. Do not invoke it with parentheses.",
            vscode.DiagnosticSeverity.Error,
            'bml-jnan-function-call'
        ));
    }

    // acos(x) / asin(x) - check domain [-1, 1]
    const mathDomainRegex = /\b(acos|asin)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/g;
    while ((match = mathDomainRegex.exec(cleanText)) !== null) {
        const funcName = match[1];
        const val = parseFloat(match[2]);
        if (val > 1.0 || val < -1.0) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Warning: '${funcName}()' argument is outside the valid domain [-1, 1] - passing '${match[2]}' will return NaN.`,
                vscode.DiagnosticSeverity.Warning,
                'bml-math-domain-error'
            ));
        }
    }

    // integer() / float() / boolean() call validations
    const castFuncs = [
        { name: 'integer', expected: ['Float'] },
        { name: 'float', expected: ['Integer', 'String'] },
        { name: 'boolean', expected: ['String'] }
    ];

    for (const cf of castFuncs) {
        const regex = new RegExp(`\\b${cf.name}\\s*\\(`, 'g');
        while ((match = regex.exec(cleanText)) !== null) {
            const openParenIndex = match.index + match[0].length - 1;
            const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
            if (closeParenIndex === -1) continue;
            const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

            if (args.length !== 1) {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Error: '${cf.name}()' expects 1 argument, but got ${args.length}.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-function-arg-count'
                ));
            } else {
                const argTrimmed = args[0].trim();
                const actual = inferExpressionType(argTrimmed, firstTypeByVar) || (firstTypeByVar && (firstTypeByVar.get(argTrimmed.toLowerCase()) || firstTypeByVar.get(argTrimmed)) && (firstTypeByVar.get(argTrimmed.toLowerCase()) || firstTypeByVar.get(argTrimmed)).type);
                if (actual && !cf.expected.includes(actual)) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 1 to '${cf.name}' should be ${cf.expected.join(' or ')}, but got ${actual}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkMath };
