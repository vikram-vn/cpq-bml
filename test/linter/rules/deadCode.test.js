const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - constant conditions (no-constant-condition / no-self-compare)', () => {
    test('Flags an always-true if condition', () => {
        const diagnostics = lintText(`
            if (true) {
                return "x";
            }
            return "y";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-constant-condition');
        assert.ok(diag, 'Should flag if (true)');
        assert.ok(diag.message.includes('always true'));
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Flags an always-false elif condition', () => {
        const diagnostics = lintText(`
            if (x == 1) {
                return "a";
            } elif (false) {
                return "b";
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-constant-condition' && d.message.includes('always false'));
        assert.ok(diag, 'Should flag elif (false)');
    });

    test('Flags a self-comparison condition', () => {
        const diagnostics = lintText(`
            if (count == count) {
                return "a";
            }
            return "b";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-constant-condition');
        assert.ok(diag, 'Should flag count == count');
        assert.ok(diag.message.includes("'count'") && diag.message.includes('always true'));
    });

    test('Does not flag a normal condition comparing two different variables', () => {
        const diagnostics = lintText(`
            if (status == "DELETED") {
                return "a";
            }
            return "b";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-constant-condition');
        assert.strictEqual(diag, undefined);
    });

    test('Does not flag a self-comparison involving a function call', () => {
        const diagnostics = lintText(`
            if (getdate() == getdate()) {
                return "a";
            }
            return "b";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-constant-condition');
        assert.strictEqual(diag, undefined, 'Function-call self-comparisons are not flagged - results may differ between calls');
    });
});

suite('BML Linter Test Suite - unreachable code (no-unreachable)', () => {
    test('Flags code after a top-level unconditional return', () => {
        const diagnostics = lintText(`
            result = "a";
            return result;
            log("this never runs");
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.ok(diag, 'Should flag code after the top-level return');
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Flags code after return inside an if-block, but not code after the block', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
                log("dead");
            }
            return "b";
        `);
        const diags = diagnostics.filter(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diags.length, 1, 'Should flag exactly the dead log() call, once');
    });

    test('Does not flag code after a return inside one if-branch that runs in a sibling branch', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            }
            return "b";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diag, undefined, "'return b' is reachable when x is false");
    });

    test('Does not double-report nested dead code already covered by an outer dead zone', () => {
        const diagnostics = lintText(`
            return "a";
            if (x) {
                return "b";
                log("dead");
            }
        `);
        const diags = diagnostics.filter(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diags.length, 1, 'The whole if-block is already part of the outer dead zone - only one diagnostic');
    });

    test('Flags code after break and continue inside a loop', () => {
        const diagnostics = lintText(`
            for x in list {
                if (x == 1) {
                    break;
                    log("dead after break");
                }
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.ok(diag, 'Should flag code after break');
    });

    test('Does not flag a clean script with a single trailing return', () => {
        const diagnostics = lintText(`
            x = 1;
            y = 2;
            return x + y;
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diag, undefined);
    });

    test('Flags code after an exhaustive if/else where both branches return', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } else {
                return "b";
            }
            log("dead - every branch already returned");
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.ok(diag, 'Should flag code after an exhaustive if/else chain');
        assert.ok(diag.message.includes('if/elif/else chain'));
    });

    test('Flags code after an exhaustive if/elif/else chain with mixed terminators', () => {
        const diagnostics = lintText(`
            for item in list {
                if (x) {
                    break;
                } elif (y) {
                    continue;
                } else {
                    break;
                }
                log("dead - every branch of the chain terminates the loop");
            }
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.ok(diag, 'Should flag code after a chain where every branch breaks/continues');
    });

    test('Does not flag code after if/elif with no final else', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } elif (y) {
                return "b";
            }
            log("reachable - x and y might both be false");
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diag, undefined, 'A chain without a catch-all else is not exhaustive');
    });

    test('Does not flag code after if/else where one branch does not terminate', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } else {
                log("no return here");
            }
            log("reachable - the else branch falls through to here");
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diag, undefined, 'Not exhaustive - the else branch does not terminate');
    });

    test('Does not double-report an exhaustive chain that already ends its enclosing block', () => {
        const diagnostics = lintText(`
            if (x) {
                return "a";
            } else {
                return "b";
            }
        `);
        const diags = diagnostics.filter(d => d.code === 'bml-unreachable-code');
        assert.strictEqual(diags.length, 0, 'Nothing follows the chain, so there is nothing to flag');
    });
});

suite('BML Linter Test Suite - duplicate if/elif branch conditions (no-dupe-else-if)', () => {
    test('Flags a duplicate condition later in the same if/elif chain', () => {
        const diagnostics = lintText(`
            if (status == "CREATED") {
                return "a";
            } elif (status == "DELETED") {
                return "b";
            } elif (status == "DELETED") {
                return "c";
            } else {
                return "d";
            }
        `);
        const diag = diagnostics.find(d => d.code === 'bml-duplicate-branch-condition');
        assert.ok(diag, 'Should flag the second status == "DELETED" branch');
        assert.ok(diag.message.includes('DELETED'));
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Warning);
    });

    test('Does not flag branches comparing against different string literals', () => {
        const diagnostics = lintText(`
            if (status == "CREATED") {
                return "a";
            } elif (status == "DELETED") {
                return "b";
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-duplicate-branch-condition');
        assert.strictEqual(diag, undefined, 'Different string literals must never be confused for the same condition');
    });

    test('Does not flag identical conditions in two separate, unrelated if chains', () => {
        const diagnostics = lintText(`
            if (x == 1) {
                return "a";
            }
            y = 2;
            if (x == 1) {
                return "b";
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-duplicate-branch-condition');
        assert.strictEqual(diag, undefined, 'Two separate if statements are not the same chain');
    });

    test('Flags code after throwerror', () => {
        const diagnostics = lintText(`
            throwerror("Something went wrong");
            print("unreachable");
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code');
        assert.ok(diag, 'Should flag code after throwerror');
        assert.ok(diag.message.includes('throwerror'));
    });

    test('findStatementSemicolon utility parses statement semicolons correctly', () => {
        const { findStatementSemicolon } = require('../../../app/lang/lint/rules/unreachable');
        assert.strictEqual(findStatementSemicolon('x = 5; y = 6;', 5), 5);
        assert.strictEqual(findStatementSemicolon('x =          ; y = 6;', 5), 13);
        assert.strictEqual(findStatementSemicolon('x = func(1, 2);', 5), 14);
        assert.strictEqual(findStatementSemicolon('x = (5', 5), -1);
    });

    test('findBlocks parses braces and handles implicit file block', () => {
        const { findBlocks } = require('../../../app/lang/lint/rules/unreachable');
        const text = 'if (x) { y = 1; }';
        const blocks = findBlocks(text);
        assert.strictEqual(blocks.length, 2); // file-level block and if-body block
        assert.ok(blocks.some(b => b.start === 0 && b.end === text.length));
        assert.ok(blocks.some(b => b.start === 7 && b.end === 16));
    });

    test('Flags unreachable block inside if (false)', () => {
        const diagnostics = lintText(`
            if (false) {
                x = 5;
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code' && d.message.includes('always-false'));
        assert.ok(diag, 'Should flag code block inside if (false)');
    });

    test('Flags unreachable block inside elif (false)', () => {
        const diagnostics = lintText(`
            if (x == 1) {
                return "a";
            } elif (false) {
                return "b";
            }
            return "c";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code' && d.message.includes('always-false'));
        assert.ok(diag, 'Should flag code block inside elif (false)');
    });

    test('Flags unreachable block inside if (x != x)', () => {
        const diagnostics = lintText(`
            if (x != x) {
                y = 1;
            }
            return "";
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code' && d.message.includes('always-false'));
        assert.ok(diag, 'Should flag code block inside if (x != x)');
    });

    test('Flags sibling branches following if (true) as unreachable', () => {
        const diagnostics = lintText(`
            if (true) {
                return "a";
            } else {
                return "b";
            }
        `);
        const diag = diagnostics.find(d => d.code === 'bml-unreachable-code' && d.message.includes('always-true'));
        assert.ok(diag, 'Should flag else branch following if (true)');
    });
});
