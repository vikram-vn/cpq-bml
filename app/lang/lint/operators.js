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

    return diagnostics;
}

module.exports = { checkOperators };
