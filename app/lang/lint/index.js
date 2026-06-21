const vscode = require('vscode');
const { lintBMLCustom } = require('./lint');
const { registerBmlCodeActions } = require('./codeActions');

let diagnosticCollection;

function isLintEnabled() {
    return vscode.workspace.getConfiguration('cpqBml').get('features.lint', true);
}

function registerBmlLinter(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('lint');
    context.subscriptions.push(diagnosticCollection);

    const lintDelay = 300;
    let lintTimer;

    const triggerLint = (doc) => {
        clearTimeout(lintTimer);
        lintTimer = setTimeout(() => {
            if (!isLintEnabled()) {
                diagnosticCollection.delete(doc.uri);
                return;
            }
            lintBMLCustom(doc, diagnosticCollection, vscode);
        }, lintDelay);
    };

    vscode.workspace.onDidOpenTextDocument(triggerLint, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument((e) => triggerLint(e.document), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(triggerLint, null, context.subscriptions);

    // Toggling cpqBml.features.lint should take effect immediately rather than
    // waiting for the next edit/save of each open document.
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('cpqBml.features.lint')) return;
        if (!isLintEnabled()) {
            diagnosticCollection.clear();
            return;
        }
        vscode.workspace.textDocuments.forEach((doc) => {
            if (doc.languageId === 'bml') triggerLint(doc);
        });
    }, null, context.subscriptions);

    vscode.workspace.textDocuments.forEach((doc) => {
        if (doc.languageId === 'bml') triggerLint(doc);
    });

    // register code actions
    registerBmlCodeActions(context);
}

function deactivate() {
    if (diagnosticCollection) diagnosticCollection.dispose();
}

module.exports = { registerBmlLinter, deactivate };
