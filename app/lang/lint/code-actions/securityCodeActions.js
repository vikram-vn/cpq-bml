const vscode = require('vscode');

class BmlSecurityCodeActionProvider {
    provideCodeActions(document, range, context) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'CPQ-BML Security') continue;

            const code = String(diagnostic.code || '');
            if (code === 'BMQL_INJECTION_RISK') {
                const line = document.lineAt(range.start.line);
                const lineText = line.text;

                // If line contains + inside bmql, propose parameterizing
                const fix = new vscode.CodeAction(
                    'Replace dynamic BMQL concatenation with parameterized $variable',
                    vscode.CodeActionKind.QuickFix
                );
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;

                // Example replacement: replace ' " + var + " ' with ' $var '
                const parameterized = lineText.replace(/'\s*\+\s*([a-zA-Z0-9_]+)\s*\+\s*'/g, '$$$1')
                                              .replace(/"\s*\+\s*([a-zA-Z0-9_]+)\s*\+\s*"/g, '$$$1');

                if (parameterized !== lineText) {
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(document.uri, line.range, parameterized);
                    fix.edit = edit;
                    actions.push(fix);
                }
            } else if (code === 'UNBOUNDED_LOOP') {
                const fix = new vscode.CodeAction(
                    'Add loop iteration safety limit (max 1000 iterations)',
                    vscode.CodeActionKind.QuickFix
                );
                fix.diagnostics = [diagnostic];

                const edit = new vscode.WorkspaceEdit();
                const insertPos = new vscode.Position(range.start.line, 0);
                edit.insert(document.uri, insertPos, '    _loopCounter = 0;\n');
                const nextPos = new vscode.Position(range.start.line + 1, 0);
                edit.insert(document.uri, nextPos, '        _loopCounter = _loopCounter + 1; if (_loopCounter > 1000) { break; }\n');
                fix.edit = edit;
                actions.push(fix);
            }
        }
        return actions;
    }
}

function registerSecurityCodeActions(context) {
    const provider = new BmlSecurityCodeActionProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            ['bml'],
            provider,
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            }
        )
    );
}

module.exports = {
    BmlSecurityCodeActionProvider,
    registerSecurityCodeActions,
};
