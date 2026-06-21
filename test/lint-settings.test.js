const assert = require('assert');
const vscode = require('vscode');

suite('BML Linter cpqBml.lint.enable setting', () => {
    suiteSetup(async () => {
        const ext = vscode.extensions.getExtension('vikram-n.cpq-bml');
        await ext.activate();
    });

    test('disabling the setting clears diagnostics; re-enabling relints', async function () {
        this.timeout(8000);
        const config = vscode.workspace.getConfiguration('cpqBml');
        const original = config.get('lint.enable');

        try {
            const doc = await vscode.workspace.openTextDocument({ language: 'bml', content: 'x = 5\n' });
            await new Promise((resolve) => setTimeout(resolve, 600));

            let diags = vscode.languages.getDiagnostics(doc.uri);
            assert.ok(diags.some((d) => d.message.includes('Missing semicolon')), 'Should lint by default (setting defaults to true)');

            await config.update('lint.enable', false, vscode.ConfigurationTarget.Global);
            await new Promise((resolve) => setTimeout(resolve, 400));

            diags = vscode.languages.getDiagnostics(doc.uri);
            assert.strictEqual(diags.length, 0, 'Should clear diagnostics immediately when disabled');

            await config.update('lint.enable', true, vscode.ConfigurationTarget.Global);
            await new Promise((resolve) => setTimeout(resolve, 600));

            diags = vscode.languages.getDiagnostics(doc.uri);
            assert.ok(diags.some((d) => d.message.includes('Missing semicolon')), 'Should lint again once re-enabled');
        } finally {
            await config.update('lint.enable', original, vscode.ConfigurationTarget.Global);
        }
    });
});
