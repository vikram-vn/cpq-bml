const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - mixed AND/OR operators (no-mixedOperators)', () => {
    test('Flags AND and OR mixed without grouping parens', () => {
        const diagnostics = lintText(`
            if (a AND b OR c) {
                return "1";
            }
            return "2";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-mixedOperators');
        assert.ok(diag, 'Should flag the unguarded AND/OR mix');
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Does not flag when OR is grouped in its own parens', () => {
        const diagnostics = lintText(`
            if (a AND (b OR c)) {
                return "1";
            }
            return "2";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-mixedOperators');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag a condition using only AND or only OR', () => {
        const diagnostics = lintText(`
            if (a AND b AND c) {
                return "1";
            }
            return "2";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-mixedOperators');
        assert.strictEqual(diag, undefined);
    });
});

suite('BML Linter Test Suite - lonely if (no-lonelyIf)', () => {
    test('Flags an else whose entire body is a single if statement', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } else {
                if (y) {
                    return "b";
                }
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-lonelyIf');
        assert.ok(diag, 'Should flag the lonely if');
        assert.ok(diag.message.includes('elif'));
    });

    test('Does not flag a proper elif chain', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } elif (y) {
                return "b";
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-lonelyIf');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag an else with an extra statement besides the if', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } else {
                log("checking y");
                if (y) {
                    return "b";
                }
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-lonelyIf');
        assert.strictEqual(diag, undefined);
    });
});

suite('BML Linter Test Suite - unused expression statements (no-unusedExpressions)', () => {
    test('Flags a bare comparison statement (likely a typo for assignment)', () => {
        const diagnostics = lintText(`
            x == 5;
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unused-expression');
        assert.ok(diag, 'Should flag the bare comparison');
    });

    test('Does not flag a normal assignment', () => {
        const diagnostics = lintText(`
            x = 5;
            return x;
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unused-expression');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag a normal function call statement', () => {
        const diagnostics = lintText(`
            print(x);
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unused-expression');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag a comparison inside an if condition', () => {
        const diagnostics = lintText(`
            if (x == 5) {
                return "a";
            }
            return "b";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unused-expression');
        assert.strictEqual(diag, undefined);
    });
});

suite('BML Linter Test Suite - use before define (no-undef-ish, util functions only)', () => {
    test('Flags a variable read before its own later assignment', () => {
        const diagnostics = lintText(`
            if (x == "a") {
                return "1";
            }
            x = "b";
            return "2";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-useBeforeDefine');
        assert.ok(diag, 'Should flag x read before its later assignment');
    });

    test('Does not flag normal sequential assign-then-use', () => {
        const diagnostics = lintText(`
            x = "a";
            return x;
        `);
        const diag = diagnostics.find(d => d.code === 'bml-useBeforeDefine');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag a loop variable used inside its own loop', () => {
        const diagnostics = lintText(`
            for item in list {
                print(item);
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-useBeforeDefine');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag a variable that is never assigned anywhere (out of scope by design)', () => {
        const diagnostics = lintText(`
            return totallyUndeclaredThing;
        `);
        const diag = diagnostics.find(d => d.code === 'bml-useBeforeDefine');
        assert.strictEqual(diag, undefined);
    });

    test('hasMixedAndOrAtTopLevel correctly identifies mixed AND and OR', () => {
        const { hasMixedAndOrAtTopLevel } = require('../../../app/lang/lint/mixedOperators');
        assert.strictEqual(hasMixedAndOrAtTopLevel('a AND b OR c'), true);
        assert.strictEqual(hasMixedAndOrAtTopLevel('a AND (b OR c)'), false);
        assert.strictEqual(hasMixedAndOrAtTopLevel('a OR (b AND c)'), false);
        assert.strictEqual(hasMixedAndOrAtTopLevel('a AND b AND c'), false);
        assert.strictEqual(hasMixedAndOrAtTopLevel('a OR b OR c'), false);
        assert.strictEqual(hasMixedAndOrAtTopLevel('(a AND b) OR (c AND d)'), false);
    });

    test('isCommerceFunction correctly identifies commerce vs utility metadata', () => {
        const { isCommerceFunction } = require('../../../app/lang/lint/useBeforeDefine');
        assert.strictEqual(isCommerceFunction({ commerceDocument: 'transaction' }), true);
        assert.strictEqual(isCommerceFunction({ libraryFunctions: [] }), false);
        assert.strictEqual(isCommerceFunction(null), false);
    });

    test('Does not flag an else block containing an if and then another statement', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } else {
                if (y) {
                    return "b";
                }
                print("done");
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-lonelyIf');
        assert.strictEqual(diag, undefined);
    });
});
