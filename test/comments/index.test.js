const assert = require('assert');
const vscode = require('vscode');

suite('BML Better Comments - extension wiring', () => {
    suiteSetup(async () => {
        const ext = vscode.extensions.getExtension('vikram-n.cpq-bml');
        await ext.activate();
    });

    test('activation registers comments without throwing, and decorations/hover survive a real document', async function () {
        this.timeout(8000);
        const content = [
            '// Function Name : sample',
            '// Description: does a thing',
            '// TODO: handle the edge case',
            '// bml-lint-disable-next-line',
            'x = 5',
            '/* beautify ignore:start */',
            'y    =    6;',
            '/* beautify ignore:end */'
        ].join('\n');

        const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
        const editor = await vscode.window.showTextDocument(doc);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // No assertion possible on the private decoration arrays themselves
        // (VS Code doesn't expose applied decorations), so this is a smoke
        // test: showing the document and letting the debounced decorate
        // pass run must not throw or leave the editor in a broken state.
        assert.strictEqual(editor.document.languageId, 'bml');

        const hovers = await vscode.commands.executeCommand(
            'vscode.executeHoverProvider',
            doc.uri,
            doc.positionAt(content.indexOf('bml-lint-disable-next-line'))
        );
        assert.ok(Array.isArray(hovers) && hovers.length > 0, 'Hovering a directive comment should produce at least one hover');
    });

    test('toggling cpqBml.features.comments does not throw', async function () {
        this.timeout(8000);
        const config = vscode.workspace.getConfiguration('cpqBml');
        const original = config.get('features.comments');
        try {
            await config.update('features.comments', false, vscode.ConfigurationTarget.Global);
            await new Promise((resolve) => setTimeout(resolve, 400));
            await config.update('features.comments', true, vscode.ConfigurationTarget.Global);
            await new Promise((resolve) => setTimeout(resolve, 400));
        } finally {
            await config.update('features.comments', original, vscode.ConfigurationTarget.Global);
        }
    });

    test('split-pane comment decorations sync does not throw', async function () {
        this.timeout(8000);
        const content = '// TODO: verify split pane comment sync';
        const doc = await vscode.workspace.openTextDocument({ language: 'bml', content });
        const editor1 = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        const editor2 = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
        
        const edit = new vscode.WorkspaceEdit();
        edit.insert(doc.uri, new vscode.Position(0, doc.getText().length), '\n// FIXME: another tag');
        await vscode.workspace.applyEdit(edit);
        
        await new Promise((resolve) => setTimeout(resolve, 600));
        
        assert.strictEqual(editor1.document.languageId, 'bml');
        assert.strictEqual(editor2.document.languageId, 'bml');
    });
});
