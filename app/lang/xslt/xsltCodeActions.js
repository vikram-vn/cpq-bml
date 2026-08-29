const vscode = require('vscode');

function registerXsltCodeActions(context) {
    const provider = {
        provideCodeActions(document, range, context) {
            const fixes = [];
            for (const diag of context.diagnostics) {
                if (diag.code === 'xslt-missing-version') {
                    const action = new vscode.CodeAction('Add version="1.0" attribute', vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    const text = document.getText(diag.range);
                    const updated = text.replace(/<xsl:(stylesheet|transform)/i, '$& version="1.0"');
                    action.edit.replace(document.uri, diag.range, updated);
                    action.diagnostics = [diag];
                    fixes.push(action);
                } else if (diag.code === 'xslt-invalid-namespace') {
                    const action = new vscode.CodeAction('Add XSLT namespace (xmlns:xsl="http://www.w3.org/1999/XSL/Transform")', vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    const text = document.getText(diag.range);
                    const updated = text.replace(/<xsl:(stylesheet|transform)/i, '$& xmlns:xsl="http://www.w3.org/1999/XSL/Transform"');
                    action.edit.replace(document.uri, diag.range, updated);
                    action.diagnostics = [diag];
                    fixes.push(action);
                } else if (diag.code === 'xslt-unused-template') {
                    const action = new vscode.CodeAction('Remove unused named template', vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    action.edit.delete(document.uri, diag.range);
                    action.diagnostics = [diag];
                    fixes.push(action);
                } else if (diag.code === 'xslt-empty-select') {
                    const action = new vscode.CodeAction('Add select="." attribute', vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    const text = document.getText(diag.range);
                    const updated = text.includes('select=')
                        ? text.replace(/select=["'][^"']*["']/i, 'select="."')
                        : text.replace(/<xsl:([a-z-]+)/i, '$& select="."');
                    action.edit.replace(document.uri, diag.range, updated);
                    action.diagnostics = [diag];
                    fixes.push(action);
                }
            }
            return fixes;
        }
    };

    const selector = [
        { language: 'xsl', scheme: 'file' },
        { language: 'xslt', scheme: 'file' },
        { language: 'xml', scheme: 'file' }
    ];

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(selector, provider, {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );
}

module.exports = { registerXsltCodeActions };
