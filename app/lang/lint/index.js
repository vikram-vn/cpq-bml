const vscode = require('vscode');
const { lintBMLCustom } = require('./lint');
const { registerBmlCodeActions } = require('./codeActions');

let diagnosticCollection;

function isLintEnabled() {
    return vscode.workspace.getConfiguration('cpqBml').get('features.lint', true);
}

function isSpellingEnabled() {
    return vscode.workspace.getConfiguration('cpqBml').get('features.spelling', true);
}

function registerBmlLinter(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('lint');
    context.subscriptions.push(diagnosticCollection);

    const lintDelay = 300;
    const lintTimers = new Map();

    const triggerLint = (doc) => {
        if (!doc) return;
        const uri = doc.uri.toString();
        if (lintTimers.has(uri)) {
            clearTimeout(lintTimers.get(uri));
        }
        lintTimers.set(uri, setTimeout(() => {
            lintTimers.delete(uri);
            if (!isLintEnabled() && !isSpellingEnabled()) {
                diagnosticCollection.delete(doc.uri);
                return;
            }
            lintBMLCustom(doc, diagnosticCollection, vscode);
        }, lintDelay));
    };

    context.subscriptions.push({
        dispose: () => {
            for (const timer of lintTimers.values()) {
                clearTimeout(timer);
            }
            lintTimers.clear();
        }
    });

    vscode.workspace.onDidOpenTextDocument(triggerLint, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument((e) => triggerLint(e.document), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(triggerLint, null, context.subscriptions);

    // Toggling cpqBml.features.lint or cpqBml.features.spelling should take effect immediately rather than
    // waiting for the next edit/save of each open document.
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('cpqBml.features.lint') && !e.affectsConfiguration('cpqBml.features.spelling')) return;
        if (!isLintEnabled() && !isSpellingEnabled()) {
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
