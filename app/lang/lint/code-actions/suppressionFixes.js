const vscode = require('vscode');

function getSuppressionFixes(document, diag, editRange) {
    const fixes = [];

    if (diag.code && typeof diag.code === 'string' && diag.code.startsWith('bml-')) {
        const codeStr = diag.code;

        // 1. Disable for this line (TOP PREFERRED ACTION)
        const lineAction = new vscode.CodeAction(`Disable '${codeStr}' for this line`, vscode.CodeActionKind.QuickFix);
        lineAction.isPreferred = true;
        lineAction.edit = new vscode.WorkspaceEdit();

        const lineIndex = editRange.start.line;
        const lineText = document.lineAt(lineIndex).text;
        const disableMatch = lineText.match(/\/\/\s*bml-lint-disable-line\s+([\w\s,-]+)/);

        if (disableMatch) {
            const existingCodes = disableMatch[1].trim();
            if (!existingCodes.includes(codeStr)) {
                const newDisableComment = ` // bml-lint-disable-line ${existingCodes}, ${codeStr}`;
                const matchStartPos = new vscode.Position(lineIndex, lineText.indexOf(disableMatch[0]));
                const matchEndPos = new vscode.Position(lineIndex, lineText.length);
                lineAction.edit.replace(document.uri, new vscode.Range(matchStartPos, matchEndPos), newDisableComment);
            }
        } else {
            const endOfLinePos = new vscode.Position(lineIndex, lineText.length);
            lineAction.edit.insert(document.uri, endOfLinePos, ` // bml-lint-disable-line ${codeStr}`);
        }

        lineAction.diagnostics = [diag];
        fixes.push(lineAction);

        // 2. Disable for entire file
        const fileAction = new vscode.CodeAction(`Disable '${codeStr}' for entire file`, vscode.CodeActionKind.QuickFix);
        fileAction.edit = new vscode.WorkspaceEdit();

        const firstLineText = document.lineAt(0).text;
        const fileDisableMatch = firstLineText.match(/\/\/\s*bml-lint-disable-file\s+([\w\s,-]+)/);

        if (fileDisableMatch) {
            const existingCodes = fileDisableMatch[1].trim();
            if (!existingCodes.includes(codeStr)) {
                const newDisableComment = `// bml-lint-disable-file ${existingCodes}, ${codeStr}`;
                const matchStartPos = new vscode.Position(0, firstLineText.indexOf(fileDisableMatch[0]));
                const matchEndPos = new vscode.Position(0, firstLineText.length);
                fileAction.edit.replace(document.uri, new vscode.Range(matchStartPos, matchEndPos), newDisableComment);
            }
        } else {
            fileAction.edit.insert(document.uri, new vscode.Position(0, 0), `// bml-lint-disable-file ${codeStr}\n`);
        }

        fileAction.diagnostics = [diag];
        fixes.push(fileAction);
    }

    return fixes;
}

module.exports = { getSuppressionFixes };
