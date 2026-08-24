const vscode = require('vscode');
const { lintBMLCustom } = require('../../../app/lang/lint/core/lint');

function lintText(bmlText, filePath = '/mock/test.bml') {
    const lines = bmlText.split(/\r?\n/);
    const lineOffsets = [0];
    for (let i = 0; i < bmlText.length; i++) {
        if (bmlText[i] === '\n') lineOffsets.push(i + 1);
    }
    const doc = {
        languageId: 'bml',
        getText: () => bmlText,
        lineCount: lines.length,
        lineAt: (line) => ({ text: lines[line] || '', range: new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, (lines[line] || '').length)) }),
        positionAt: (idx) => {
            let low = 0, high = lineOffsets.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (lineOffsets[mid] <= idx) low = mid + 1;
                else high = mid - 1;
            }
            const line = high;
            const col = idx - lineOffsets[line];
            return new vscode.Position(line, col);
        },
        uri: vscode.Uri.file(filePath)
    };
    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    const path = require('path');
    const extPath = path.resolve(__dirname, '../../../');
    lintBMLCustom(doc, collection, vscode, extPath);
    return diagnostics;
}

module.exports = { lintText };
