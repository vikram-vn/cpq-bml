const vscode = require('vscode');

function getSuppressionFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code && typeof diag.code === 'string' && diag.code.startsWith('bml-')) {
        const codeStr = diag.code;
        const disableAction = new vscode.CodeAction(`Disable '${codeStr}' for this line`, vscode.CodeActionKind.QuickFix);
        disableAction.edit = new vscode.WorkspaceEdit();

        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const disableMatch = lineText.match(/\/\/\s*bml-lint-disable-line\s+([\w\s,-]+)/);

        if (disableMatch) {
            const existingCodes = disableMatch[1].trim();
            if (!existingCodes.includes(codeStr)) {
                const newDisableComment = ` // bml-lint-disable-line ${existingCodes}, ${codeStr}`;
                const matchStartPos = new vscode.Position(lineIndex, lineText.indexOf(disableMatch[0]));
                const matchEndPos = new vscode.Position(lineIndex, lineText.length);
                disableAction.edit.replace(document.uri, new vscode.Range(matchStartPos, matchEndPos), newDisableComment);
            }
        } else {
            const endOfLinePos = new vscode.Position(lineIndex, lineText.length);
            disableAction.edit.insert(document.uri, endOfLinePos, ` // bml-lint-disable-line ${codeStr}`);
        }

        disableAction.diagnostics = [diag];
        fixes.push(disableAction);
    }

    return fixes;
}

module.exports = { getSuppressionFixes };
