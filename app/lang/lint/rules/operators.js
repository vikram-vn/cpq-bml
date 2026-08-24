const vscode = require('vscode');

function checkOperators(cleanText, doc) {
    const diagnostics = [];
    const operatorRegex = /(\+\+|--|===|!==|!=|< =|> =|&&|\|\||!|\+=|-=|\*=|\/=|%=|~)/g;
    let match;

    while ((match = operatorRegex.exec(cleanText)) !== null) {
        const range = new vscode.Range(doc.positionAt(match.index), doc.positionAt(match.index + match[0].length));
        let message = '';

        switch (match[0]) {
            case '===': message = 'Use == in BML'; break;
            case '!==':
            case '!=': message = 'Use <> in BML'; break;
            case '< =': message = 'Use <= in BML'; break;
            case '> =': message = 'Use >= in BML'; break;
            case '&&': message = 'Use "AND" in BML'; break;
            case '||': message = 'Use "OR" in BML'; break;
            case '!': message = 'Use "NOT" in BML'; break;
            case '++': message = 'Use var = var + 1 in BML'; break;
            case '--': message = 'Use var = var - 1 in BML'; break;
            case '~': message = "'~' is not a BML operator. Use \"+\" for string concatenation"; break;
            default: message = `${match[0]} operator not supported in BML`; break;
        }

        const diag = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
        diag.code = 'bml-operator-fix';
        diagnostics.push(diag);
    }

    // Division / Modulo by Zero detection (/ 0, / 0.0, % 0)
    const divZeroRegex = /[\/%]\s*(0(?:\.0+)?)\b/g;
    while ((match = divZeroRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            `Error: Division or modulo by zero ('${match[0]}') will throw an ArithmeticException at runtime.`,
            vscode.DiagnosticSeverity.Error
        );
        diag.code = 'bml-division-by-zero';
        diagnostics.push(diag);
    }

    return diagnostics;
}

module.exports = { checkOperators };
