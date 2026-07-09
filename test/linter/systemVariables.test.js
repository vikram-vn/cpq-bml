const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('./fixtures');
const { findClosestSystemVariable, loadSystemVariables } = require('../../app/lang/lint/systemVariables');

suite('BML Linter Test Suite - CPQ system variables', () => {
    test('Flags assignment to a known read-only system variable', () => {
        const diagnostics = lintText(`
            _user_name = "override";
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-system-variable-readonly');
        assert.ok(diag, 'Should flag assignment to _user_name');
        assert.ok(diag.message.includes("'_user_name'"));
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Does not flag reading a known system variable', () => {
        const diagnostics = lintText(`
            x = _user_name;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-system-variable-readonly');
        assert.strictEqual(diag, undefined, 'Reading (not assigning) a system variable should not be flagged');
    });

    test('Does not flag dotted attribute access even if it matches a system variable name', () => {
        const diagnostics = lintText(`
            line._user_name = "x";
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-system-variable-readonly');
        assert.strictEqual(diag, undefined, 'line._user_name is attribute access, not the global system variable');
    });

    test('Suggests the closest system variable for a near-exact typo', () => {
        const diagnostics = lintText(`
            x = _user_nam;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-system-variable-typo');
        assert.ok(diag, 'Should suggest a close match for _user_nam');
        assert.ok(diag.message.includes('_user_name'));
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Information);
    });

    test('Does not suggest a typo for unrelated commerce attribute names', () => {
        const diagnostics = lintText(`
            x = line._document_number;
            y = _system_selected_document_number;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-system-variable-typo');
        assert.strictEqual(diag, undefined, 'Unrelated underscore-prefixed identifiers should not trigger typo suggestions');
    });

    test('findClosestSystemVariable returns null for an exact match', () => {
        const vars = loadSystemVariables();
        assert.ok(vars.size > 0, 'common-variables.json should have loaded at least one entry');
        assert.strictEqual(findClosestSystemVariable('_user_name'), null);
    });

    test('findClosestSystemVariable returns null for an unrelated name', () => {
        assert.strictEqual(findClosestSystemVariable('_completely_unrelated_identifier'), null);
    });
});
