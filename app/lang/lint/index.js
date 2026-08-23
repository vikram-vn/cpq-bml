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

    // Same idea for the intellisense API data the type/function checkers
    // lazily parse on their first call (bml-functions-api-usage is ~1MB -
    // profiled at ~500ms parse+index on first use, which otherwise lands on
    // the user's first edit of a .bml file).
    if (isLintEnabled()) {
        setImmediate(() => {
            try {
                const { loadJson } = require('../intellisense/apiDataLoader');
                loadJson('bml-functions-api-usage', extensionPath);
                loadJson('bml-variables-api-usage', extensionPath);
                loadJson('function-return-types', extensionPath);
                loadJson('function-param-data-types', extensionPath);
            } catch (e) {
                // Prewarm only - the checkers load on demand if this failed.
            }
        });
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

    const isBmlDoc = (doc) => doc && (doc.languageId === 'bml' || (doc.uri && doc.uri.fsPath && doc.uri.fsPath.endsWith('.bml')));

    if (vscode.window && vscode.window.onDidChangeTextEditorVisibleRanges) {
        vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
            if (e.textEditor && isBmlDoc(e.textEditor.document)) {
                triggerLint(e.textEditor.document);
            }
        }, null, context.subscriptions);
    }

    // Toggling cpqBml.features.lint or cpqBml.features.spelling should take effect immediately rather than
    // waiting for the next edit/save of each open document.
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('cpqBml.features.lint') && !e.affectsConfiguration('cpqBml.features.spelling')) return;
        if (!isLintEnabled() && !isSpellingEnabled()) {
            diagnosticCollection.clear();
            return;
        }
        vscode.workspace.textDocuments.forEach((doc) => {
            if (isBmlDoc(doc)) triggerLint(doc);
        });
    }, null, context.subscriptions);

    vscode.workspace.textDocuments.forEach((doc) => {
        if (isBmlDoc(doc)) triggerLint(doc);
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
