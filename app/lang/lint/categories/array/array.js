const { makeDiagnostic, findMatchingParenEnd, splitTopLevelArgs } = require('../best-practices/shared');
const { inferExpressionType, collectVariableTypes } = require('../../rules/typeCheck');
const vscode = require('vscode');

function checkArray(cleanText, noStringsText, doc, precomputedFirstTypes) {
    const diagnostics = [];
    let match;
    const firstTypeByVar = precomputedFirstTypes || collectVariableTypes(cleanText, doc);

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

    // Negative array index access on variables: var[-N]
    const negativeIndexRegex = /\b([a-zA-Z_]\w*)\s*\[\s*(-\d+)\s*\]/g;
    while ((match = negativeIndexRegex.exec(noStringsText)) !== null) {
        const varName = match[1];
        if (!['float', 'integer', 'string', 'boolean', 'date'].includes(varName.toLowerCase())) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: Negative array index '${match[2]}' on variable '${varName}' will throw an ArrayOutOfBoundsException at runtime. Array indices must be >= 0.`,
                vscode.DiagnosticSeverity.Error,
                'bml-array-negative-index'
            ));
        }
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
                        `Error: Argument ${i + 1} to 'bytearray' should be String, but got ${actual}.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-function-arg-type'
                    ));
                }
            }
        }
    }

    // sort() call validation
    const sortRegex = /\bsort\s*\(/g;
    while ((match = sortRegex.exec(cleanText)) !== null) {
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length < 1 || args.length > 3) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(closeParenIndex + 1);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'sort()' expects 1 to 3 arguments, but got ${args.length}.`,
                vscode.DiagnosticSeverity.Error,
                'bml-function-arg-count'
            ));
        } else {
            // Arg 2 (sortOrder) validation
            if (args.length >= 2) {
                const sortOrderRaw = args[1].trim();
                const strMatch = sortOrderRaw.match(/^(?:"([^"\\]*)"|'([^'\\]*)')$/);
                if (strMatch) {
                    const orderVal = (strMatch[1] !== undefined ? strMatch[1] : strMatch[2]).toLowerCase();
                    if (orderVal !== 'asc' && orderVal !== 'desc') {
                        const startPos = doc.positionAt(match.index);
                        const endPos = doc.positionAt(closeParenIndex + 1);
                        diagnostics.push(makeDiagnostic(
                            new vscode.Range(startPos, endPos),
                            `Error: 'sortOrder' argument (argument 2) to 'sort()' must be "asc" or "desc", but got '${sortOrderRaw}'.`,
                            vscode.DiagnosticSeverity.Error,
                            'bml-sort-invalid-order'
                        ));
                    }
                } else {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Warning: 'sortOrder' argument (argument 2) to 'sort()' must be a string literal ("asc" or "desc"). Using a variable may cause a runtime error.`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-sort-non-literal-order'
                    ));
                }
            }

            // Arg 3 (sortType) validation
            if (args.length === 3) {
                const sortTypeRaw = args[2].trim();
                const strMatch = sortTypeRaw.match(/^(?:"([^"\\]*)"|'([^'\\]*)')$/);
                if (strMatch) {
                    const typeVal = (strMatch[1] !== undefined ? strMatch[1] : strMatch[2]).toLowerCase();
                    if (typeVal !== 'text' && typeVal !== 'numeric' && typeVal !== 'date') {
                        const startPos = doc.positionAt(match.index);
                        const endPos = doc.positionAt(closeParenIndex + 1);
                        diagnostics.push(makeDiagnostic(
                            new vscode.Range(startPos, endPos),
                            `Error: 'sortType' argument (argument 3) to 'sort()' must be "text", "numeric", or "date", but got '${sortTypeRaw}'.`,
                            vscode.DiagnosticSeverity.Error,
                            'bml-sort-invalid-type'
                        ));
                    } else if (typeVal === 'date') {
                        const arg1Trimmed = args[0].trim();
                        let actual1 = inferExpressionType(arg1Trimmed);
                        if (!actual1 && firstTypeByVar.has(arg1Trimmed.toLowerCase())) {
                            actual1 = firstTypeByVar.get(arg1Trimmed.toLowerCase()).type;
                        }
                        if (actual1 && actual1.toLowerCase() !== 'date[]' && actual1.toLowerCase() !== 'date') {
                            const startPos = doc.positionAt(match.index);
                            const endPos = doc.positionAt(closeParenIndex + 1);
                            diagnostics.push(makeDiagnostic(
                                new vscode.Range(startPos, endPos),
                                `Error: 'date' sortType can only be used to sort a Date array ('date[]'), but argument 1 is ${actual1}.`,
                                vscode.DiagnosticSeverity.Error,
                                'bml-sort-date-type-mismatch'
                            ));
                        }
                    }
                }
            }

            // Arg 1 1-D array check
            const arg1Trimmed = args[0].trim();
            let actual1 = inferExpressionType(arg1Trimmed);
            if (!actual1 && firstTypeByVar.has(arg1Trimmed.toLowerCase())) {
                actual1 = firstTypeByVar.get(arg1Trimmed.toLowerCase()).type;
            }

            if (actual1) {
                const cleanType = actual1.toLowerCase();
                if (cleanType.endsWith('[][]')) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: 'sort()' only works on 1-D arrays, but argument 1 is 2-D array '${actual1}'.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-sort-array-dimension'
                    ));
                } else if (!cleanType.endsWith('[]')) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: 'sort()' expects a 1-D array, but argument 1 is scalar type '${actual1}'.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-sort-array-dimension'
                    ));
                }
            }
        }
    }

    // 1-D Array dimension validation for append, findinarray, isempty, max, min, reverse, remove
    const oneDArrayFuncsRegex = /\b(append|findinarray|isempty|max|min|reverse|remove)\s*\(/g;
    while ((match = oneDArrayFuncsRegex.exec(cleanText)) !== null) {
        const funcName = match[1];
        const openParenIndex = match.index + match[0].length - 1;
        const closeParenIndex = findMatchingParenEnd(cleanText, openParenIndex);
        if (closeParenIndex === -1) continue;
        const args = splitTopLevelArgs(cleanText.slice(openParenIndex + 1, closeParenIndex));

        if (args.length >= 1) {
            const arg1Trimmed = args[0].trim();
            let actual1 = inferExpressionType(arg1Trimmed);
            if (!actual1 && firstTypeByVar.has(arg1Trimmed.toLowerCase())) {
                actual1 = firstTypeByVar.get(arg1Trimmed.toLowerCase()).type;
            }
            if (actual1) {
                const cleanType = actual1.toLowerCase();
                if (cleanType.endsWith('[][]')) {
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(closeParenIndex + 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Error: '${funcName}()' only works with 1-D arrays, but argument 1 is 2-D array '${actual1}'.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-array-dimension-error'
                    ));
                }
            }
        }
    }

    return diagnostics;
}

module.exports = { checkArray };
