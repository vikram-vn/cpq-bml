const assert = require('assert');
const vscode = require('vscode');
const { activateExtension } = require('../extensionHelper');

// Regression guard for the same bug class as
// test/spellCheck/bundledExtension.test.js: functions.js's
// loadBuiltInFunctions(), systemVariables.js's loadSystemVariables(), and
// metadataTypes.js's loadLookupLabels() all used to resolve their
// app/lookups/bml/*.json files relative to __dirname. That's correct when
// required directly (every other lint test does this, bypassing esbuild),
// but esbuild bundles them into dist/extension.js where __dirname resolves
// to dist/ - making '../../lookups/bml/...' resolve outside the repo
// entirely. The real installed extension therefore silently loaded empty
// lookup tables: every built-in function call looked "unknown", and every
// _user_*/_site_* system variable looked unrecognized.
//
// Only activating the real extension through its real entry point (as this
// file does, same pattern as bundledExtension.test.js) exercises the actual
// bundled code path - every other lint test requires app/lang/lint/*.js
// directly and could not have caught this.
suite('BML Linter Test Suite - bundled lookups (functions/system variables/metadata)', () => {
    suiteSetup(async function () {
        this.timeout(15000);
        await activateExtension(vscode);
    });

    test('does not flag a real built-in function call as unknown through the real installed extension', async function () {
        this.timeout(15000);
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: 'x = atof("1.5");\nreturn "";\n',
        });
        await new Promise((resolve) => setTimeout(resolve, 600));

        const diags = vscode.languages.getDiagnostics(doc.uri);
        const unknownFnErrors = diags.filter((d) => d.code === 'bml-unknown-function');
        assert.deepStrictEqual(
            unknownFnErrors.map((d) => d.message),
            [],
            'atof() is a real BML built-in and should not be flagged as unknown when common.json loads correctly'
        );
    });

    test('recognizes a real CPQ system variable through the real installed extension', async function () {
        this.timeout(15000);
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: '_user_name = "x";\nreturn "";\n',
        });
        await new Promise((resolve) => setTimeout(resolve, 600));

        const diags = vscode.languages.getDiagnostics(doc.uri);
        // If commonVariables.json failed to load, _user_name would be
        // completely unrecognized (vars.size === 0 short-circuits the whole
        // check) and this read-only-assignment warning would never fire.
        const readonlyWarning = diags.find((d) => d.code === 'bml-system-variable-readonly');
        assert.ok(
            readonlyWarning,
            '_user_name should be recognized as a read-only system variable when commonVariables.json loads correctly'
        );
    });
});
