const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/lint');

function lintText(bmlText, filePath = '/mock/test.bml') {
    const doc = {
        languageId: 'bml',
        getText: () => bmlText,
        positionAt: (idx) => {
            const lines = bmlText.slice(0, idx).split(/\r?\n/);
            return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
        uri: vscode.Uri.file(filePath)
    };
    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    lintBMLCustom(doc, collection, vscode);
    return diagnostics;
}

module.exports = { lintText };
