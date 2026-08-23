const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType } = require('../typeCheck');
const vscode = require('vscode');

const EMPTY_STRING_LITERAL = /^(?:""|'')$/;

function checkString(cleanText, noStringsText, doc) {
    const diagnostics = [];
    let match;

    // atof(str) / atoi(str) - empty string literal throws a runtime exception
    const atoiAtofRegex = /\b(atoi|atof)\s*\(/g;
    while ((match = atoiAtofRegex.exec(cleanText)) !== null) {
        const funcName = match[1];
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 1) {
            const arg = args[0].trim();
            if (arg === '""' || arg === "''") {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Error: '${funcName}("")' always throws an exception - an empty string cannot be parsed as a number.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-atoi-atof-empty-string'
                ));
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `Error: '${funcName}("")' always throws an exception - an empty string cannot be parsed as a number.`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-atoi-atof-empty-literal'
                ));
            } else if (funcName === 'atoi') {
                // Check if the argument is a string literal containing a decimal point (e.g. "123.45")
                const literalMatch = /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.exec(arg);
                if (literalMatch) {
                    const inner = literalMatch[1].slice(1, -1);
                    if (inner.includes('.')) {
                        const startPos = doc.positionAt(match.index);
                        const endPos = doc.positionAt(closeParenIndex + 1);
                        diagnostics.push(makeDiagnostic(
                            new vscode.Range(startPos, endPos),
                            `Error: 'atoi()' throws a runtime exception when passed a string representing a decimal number ('${inner}').`,
                            vscode.DiagnosticSeverity.Error,
                            'bml-atoi-decimal-string'
                        ));
                    }
                }
            }
        }
    }

    // isnumber() with no argument at all (isnumber("") is valid - returns false)
    const isnumberNoArgsRegex = /\bisnumber\s*\(\s*\)/g;
    while ((match = isnumberNoArgsRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            "Error: 'isnumber()' requires a string argument - calling it with none is a compile time error.",
            vscode.DiagnosticSeverity.Error,
            'bml-isnumber-no-args'
        ));
    }

    // replace(str, searchStr, replaceStr) - empty searchStr throws a runtime exception
    const replaceRegex = /\breplace\s*\(/g;
    while ((match = replaceRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));
        if (args.length >= 2) {
            const searchStr = args[1].trim();
            if (EMPTY_STRING_LITERAL.test(searchStr)) {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(closeParenIndex + 1);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    "Error: 'replace()' always throws when the 'old' (search) argument is an empty string.",
                    vscode.DiagnosticSeverity.Error,
                    'bml-replace-empty-search-string'
                ));
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    "Error: 'replace()' always throws when the 'old' (search) argument is an empty string.",
                    vscode.DiagnosticSeverity.Error,
                    'bml-replace-empty-pattern'
                ));
            }
        }
    }

    // string() call validation
    const stringCallRegex = /\bstring\s*\(/g;
    while ((match = stringCallRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length !== 1) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'string()' expects 1 argument, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        } else {
            const actual = inferExpressionType(args[0]);
            if (actual) {
                if (actual === 'String') {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        "Error: 'string()' converts a Float, Integer, or Boolean to text - passing a string literal is a compile time error (the value is already a string).",
                        vscode.DiagnosticSeverity.Error,
                        'bml-string-cast-of-string'
                    ));
                } else if (!['Integer', 'Float', 'Boolean'].includes(actual)) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: Argument 1 to 'string' should be Float, Integer, or Boolean, but got ${actual}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    // join(str_array, [delimiter]) call validation
    const joinRegex = /\bjoin\s*\(/g;
    while ((match = joinRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length < 1 || args.length > 2) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'join()' expects 1 or 2 arguments (str_array, [delimiter]), but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        }
    }

    return diagnostics;
}

module.exports = { checkString };
