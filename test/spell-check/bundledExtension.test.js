const assert = require('assert');
const vscode = require('vscode');
const { activateExtension } = require('../extensionHelper');

// Regression guard for a real bug: loadDictionaries() in spelling.js used to
// resolve bml-words.txt/english-words.txt relative to __dirname. That's
// correct when the module is required directly (every other spell-check test
// does this, bypassing esbuild entirely), but esbuild bundles this module
// into a single dist/extension.js, and __dirname for bundled code resolves
// to dist/ - where those .txt files don't exist. The real installed
// extension (package.json's "main": "./dist/extension.js") therefore loaded
// an almost-empty dictionary and flagged ordinary words like "String".
//
// Every other test in this suite requires app/lang/spell-check/spelling.js
// directly, so __dirname is always correct there and none of them could
// have caught this - only activating the real extension through its real
// entry point (as this file does) exercises the actual bundled code path.
suite('BML Linter Test Suite - Custom Spellchecker - real bundled extension', () => {
    suiteSetup(async function () {
        this.timeout(15000);
        await activateExtension(vscode);
    });

    test('does not flag ordinary English words/BML type names through the real installed extension', async function () {
        this.timeout(15000);
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: '// list of step variable names\nlistOfSteps = String[] {"start_step"};\nreturn "";\n',
        });
        await new Promise((resolve) => setTimeout(resolve, 600));

        const diags = vscode.languages.getDiagnostics(doc.uri);
        const spellingErrors = diags.filter((d) => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(
            spellingErrors.map((d) => d.message),
            [],
            'Ordinary words and the built-in String type should not be flagged when the dictionary loads correctly'
        );
    });

    test('still flags a genuine misspelling through the real installed extension', async function () {
        this.timeout(15000);
        const doc = await vscode.workspace.openTextDocument({
            language: 'bml',
            content: '// this contains a mispelled word\nreturn "";\n',
        });
        await new Promise((resolve) => setTimeout(resolve, 600));

        const diags = vscode.languages.getDiagnostics(doc.uri);
        const spellingErrors = diags.filter((d) => d.code === 'bml-spelling-error');
        assert.ok(
            spellingErrors.some((d) => d.message.includes('mispelled')),
            'A genuine misspelling should still be flagged - the dictionary must have loaded real content, not just become silent'
        );
    });
});
