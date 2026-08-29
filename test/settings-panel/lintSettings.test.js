const assert = require('assert');
const vscode = require('vscode');
const { activateExtension } = require('../extensionHelper');

suite('BML Linter cpqBml.features.lint setting', () => {
    suiteSetup(async () => {
        await activateExtension(vscode);
    });

    test('disabling the setting clears diagnostics; re-enabling relints', async function () {
        this.timeout(15000);
        const config = vscode.workspace.getConfiguration('cpqBml');
        const original = config.get('features.lint');

        try {
            const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = 5\n' });
            await new Promise((resolve) => setTimeout(resolve, 600));

            let diags = vscode.languages.getDiagnostics(doc.uri);
            assert.ok(diags.some((d) => d.message.includes('Missing semicolon')), 'Should lint by default (setting defaults to true)');

            await config.update('features.lint', false, vscode.ConfigurationTarget.Global);
            await new Promise((resolve) => setTimeout(resolve, 400));

            diags = vscode.languages.getDiagnostics(doc.uri);
            assert.strictEqual(diags.length, 0, 'Should clear diagnostics immediately when disabled');

            await config.update('features.lint', true, vscode.ConfigurationTarget.Global);
            await new Promise((resolve) => setTimeout(resolve, 600));

            diags = vscode.languages.getDiagnostics(doc.uri);
            assert.ok(diags.some((d) => d.message.includes('Missing semicolon')), 'Should lint again once re-enabled');
        } finally {
            await config.update('features.lint', original, vscode.ConfigurationTarget.Global);
        }
    });
});
