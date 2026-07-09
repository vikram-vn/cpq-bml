const vscode = require('vscode');
const { lintBMLCustom } = require('./lint');
const { registerBmlCodeActions } = require('./codeActions');
const { loadDictionaries } = require('../spell-check/spelling');

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

    // Threaded down to checkSpelling so its dictionary lookup can anchor to
    // the extension's real install root instead of __dirname, which after
    // esbuild bundles everything into dist/extension.js no longer points at
    // app/lang/spell-check/ - same convention as intellisense/index.js's
    // loadApiData(context).
    const extensionPath = context.extensionPath;

    // Prewarm the ~4.1MB spell-check dictionary in the background right after
    // activation, so it's already parsed by the time the first lint pass
    // needs it instead of blocking the editor on the user's first edit.
    // loadDictionaries() itself caches after the first call either way, so
    // this is a pure timing win with no behavior change if it's skipped.
    if (isSpellingEnabled()) {
        setImmediate(() => loadDictionaries(extensionPath));
    }

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
            lintBMLCustom(doc, diagnosticCollection, vscode, extensionPath);
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

function getDiagnosticCollection() {
    return diagnosticCollection;
}

module.exports = { registerBmlLinter, deactivate, getDiagnosticCollection };
