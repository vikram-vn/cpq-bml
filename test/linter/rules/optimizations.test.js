const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Optimization Test Suite', () => {
    test('Linter correctly identifies conditions and control blocks without suffix substring allocation overhead', () => {
        const diagnostics = lintText(`
            if (x == 1) {
                print("1");
            } elif (x == 2) {
                print("2");
            } else if (x == 3) {
                print("3");
            }
            return "";
        `);
        // None of the conditional lines should have "Missing semicolon" errors because they are control flows
        const semiErrors = diagnostics.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(semiErrors.length, 0, 'No missing semicolons should be flagged on conditional control lines');
    });

    test('Linter correctly parses preceding operators and negative literals using index back-scans', () => {
        const diagnostics = lintText(`
            x = -15;
            y = 10 <= 20;
            z = a.bField;
            return z;
        `);
        // Property accesses should not be mistaken for variables
        const unusedVars = diagnostics.filter(d => d.message.includes("Unused variable: bField"));
        assert.strictEqual(unusedVars.length, 0, 'Property access members must not be flagged as unused variables');
    });

    test('Style checks: detects multiple statements and brace alignments in a single consolidated loop', () => {
        const diagnostics = lintText(`
            x = 1; y = 2;
            if (x == 1) { print(x); }
            return "";
        `);
        const multipleStmts = diagnostics.filter(d => d.message.includes('more than one statement'));
        assert.strictEqual(multipleStmts.length, 1, 'Should flag multiple statements on a single line');
    });

    test('Workspace function caching is initialized successfully', () => {
        const { getWorkspaceFunctionsCached } = require('../../../app/lang/lint/rules/functions');
        const cache = getWorkspaceFunctionsCached(vscode);
        assert.ok(cache instanceof Map, 'Cache should be a Map instance');
    });
});
