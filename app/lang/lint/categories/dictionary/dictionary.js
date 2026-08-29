const { makeDiagnostic } = require('../best-practices/shared');
const vscode = require('vscode');

function checkDictionary(cleanText, noStringsText, doc) {
    const diagnostics = [];
    if (!cleanText.includes('dict')) return diagnostics;
    let match;

    // dict("boolean") / dict("anytype") / dict("...[][]") declarations later
    // passed to values() - not supported by the values() function.
    const unsupportedDictVars = new Set();
    const dictDeclRegex = /\b([a-zA-Z_]\w*)\s*=\s*dict\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;
    while ((match = dictDeclRegex.exec(cleanText)) !== null) {
        const typeArg = match[2].slice(1, -1).toLowerCase();
        const isTwoDimensional = /\[\]\[\]$/.test(typeArg);
        if (typeArg === 'boolean' || typeArg === 'anytype' || isTwoDimensional) {
            unsupportedDictVars.add(match[1]);
        }
    }
    if (unsupportedDictVars.size > 0) {
        const valuesCallRegex = new RegExp(`\\bvalues\\s*\\(\\s*(${[...unsupportedDictVars].join('|')})\\s*\\)`, 'g');
        while ((match = valuesCallRegex.exec(noStringsText)) !== null) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'values()' does not support boolean, anytype, or double-dimensional dictionaries - '${match[1]}' was declared as one of these.`,
                vscode.DiagnosticSeverity.Error,
                'bml-dict-values-unsupported-type'
            ));
        }
    }

    // dict() requires a type argument (e.g. dict("string"), dict("anytype")) -
    // dict() with no arguments compiles but throws at runtime.
    const dictNoArgsRegex = /\bdict\s*\(\s*\)/g;
    while ((match = dictNoArgsRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `'dict()' requires a type argument (e.g. dict("string"), dict("integer[]"), dict("anytype")) - calling it with none will throw at runtime`,
            vscode.DiagnosticSeverity.Error,
            'bml-dict-missing-type'
        ));
    }

    // dict(dictType) - check if literal type is valid
    const allowedDictTypes = new Set([
        'string', 'integer', 'float', 'date', 'boolean', 'bytearray', 'json', 'jsonarray',
        'string[]', 'integer[]', 'float[]', 'date[]', 'boolean[]', 'bytearray[]', 'json[]', 'jsonarray[]',
        'string[][]', 'integer[][]', 'float[][]', 'date[][]', 'boolean[][]',
        'anytype', 'dict<string>', 'dict<integer>', 'dict<float>', 'dict<boolean>', 'dict<date>', 'dict<json>', 'dict<jsonarray>', 'dict<anytype>'
    ]);
    const dictRegex = /\bdict\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g;
    while ((match = dictRegex.exec(cleanText)) !== null) {
        const typeArg = match[1].slice(1, -1).toLowerCase();
        if (!allowedDictTypes.has(typeArg)) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Error: 'dict()' type '${typeArg}' is invalid. Supported types are primitives (string, integer, float, date, boolean, json, jsonarray, bytearray), array suffixes, anytype, or nested dict types like dict<string>, dict<anytype>.`,
                vscode.DiagnosticSeverity.Error,
                'bml-dict-invalid-type'
            ));
        }
    }

    return diagnostics;
}

module.exports = { checkDictionary };
