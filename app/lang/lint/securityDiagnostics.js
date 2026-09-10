const vscode = require('vscode');
const { auditBmlCode } = require('@/lang/mcp/tools/audit');

let diagnosticCollection = null;
let debounceTimers = new Map();

function updateSecurityDiagnostics(document) {
    if (!document || !diagnosticCollection) return;
    if (document.languageId !== 'bml' && !document.fileName.endsWith('.bml') && !document.fileName.endsWith('.util')) {
        return;
    }

    const text = document.getText();
    const result = auditBmlCode({ code: text });
    if (!result || !result.issues) {
        diagnosticCollection.set(document.uri, []);
        return;
    }

    const diagnostics = result.issues.map((issue) => {
        const lineIdx = Math.max(0, (issue.line || 1) - 1);
        const lineText = document.lineAt(lineIdx).text;
        const range = new vscode.Range(
            new vscode.Position(lineIdx, 0),
            new vscode.Position(lineIdx, lineText.length)
        );

        const severity = issue.severity === 'critical'
            ? vscode.DiagnosticSeverity.Error
            : issue.severity === 'high'
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;

        const diag = new vscode.Diagnostic(range, `${issue.message} (${issue.suggestion})`, severity);
        diag.source = 'CPQ-BML Security';
        diag.code = issue.id || issue.type;
        return diag;
    });

    diagnosticCollection.set(document.uri, diagnostics);
}

function registerSecurityDiagnostics(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('bml-security');
    context.subscriptions.push(diagnosticCollection);

    // Initial check on active editor
    if (vscode.window.activeTextEditor) {
        updateSecurityDiagnostics(vscode.window.activeTextEditor.document);
    }

    // On open
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((doc) => {
            updateSecurityDiagnostics(doc);
        })
    );

    // On change (debounced 400ms)
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const uriKey = event.document.uri.toString();
            if (debounceTimers.has(uriKey)) {
                clearTimeout(debounceTimers.get(uriKey));
            }
            debounceTimers.set(
                uriKey,
                setTimeout(() => {
                    updateSecurityDiagnostics(event.document);
                    debounceTimers.delete(uriKey);
                }, 400)
            );
        })
    );

    // On close
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((doc) => {
            if (diagnosticCollection) {
                diagnosticCollection.delete(doc.uri);
            }
        })
    );
}

module.exports = {
    registerSecurityDiagnostics,
    updateSecurityDiagnostics,
};
