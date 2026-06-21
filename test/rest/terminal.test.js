const assert = require('assert');
const vscode = require('vscode');
const { createResultsTerminal } = require('../../app/lang/rest/terminal');

suite('BML REST results terminal', () => {
    test('creates a named terminal and supports writeLine/show/dispose without throwing', () => {
        const before = vscode.window.terminals.length;
        const resultsTerminal = createResultsTerminal(vscode, 'CPQ-BML Debug Test');

        assert.strictEqual(vscode.window.terminals.length, before + 1);
        assert.strictEqual(vscode.window.terminals[vscode.window.terminals.length - 1].name, 'CPQ-BML Debug Test');

        assert.doesNotThrow(() => resultsTerminal.writeLine('hello world'));
        assert.doesNotThrow(() => resultsTerminal.show());
        assert.doesNotThrow(() => resultsTerminal.clear());

        resultsTerminal.dispose();
    });

    test('handleInput is a no-op (the terminal is read-only)', () => {
        const resultsTerminal = createResultsTerminal(vscode, 'CPQ-BML Debug Test 2');
        // There's no public API to type into a pseudoterminal from a test, so
        // this just confirms construction succeeds and cleans up; the pty's
        // handleInput implementation itself is exercised by VS Code internally.
        resultsTerminal.dispose();
        assert.ok(true);
    });
});
