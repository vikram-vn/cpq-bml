const vscode = require('vscode');
const { lintBMLCustom } = require('../../app/lang/lint/lint');

function lintText(bmlText, filePath = '/mock/test.bml') {
    const lineOffsets = [0];
    for (let i = 0; i < bmlText.length; i++) {
        if (bmlText[i] === '\n') lineOffsets.push(i + 1);
    }
    const doc = {
        languageId: 'bml',
        getText: () => bmlText,
        positionAt: (idx) => {
            let low = 0, high = lineOffsets.length - 1;
            let line = 0;
            while (low <= high) {
                const mid = (low + high) >> 1;
                if (lineOffsets[mid] <= idx) {
                    line = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            const col = idx - lineOffsets[line];
            return new vscode.Position(line, col);
        },
        uri: vscode.Uri.file(filePath)
    };
    const diagnostics = [];
    const collection = { set: (uri, diags) => diagnostics.push(...diags) };
    lintBMLCustom(doc, collection, vscode);
    return diagnostics;
}

module.exports = { lintText };
