const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - deep nesting and print guard', () => {
    suite('bml-deep-nesting flags once per violating region', () => {
        test('a single depth-5 region yields exactly one diagnostic, not one per brace', () => {
            const diags = lintText(`
                if (a) {
                    if (b) {
                        if (c) {
                            if (d) {
                                if (e) {
                                    x = 1;
                                }
                            }
                        }
                    }
                }
                return "";
            `);
            const nesting = diags.filter(d => d.code === 'bml-deep-nesting');
            assert.strictEqual(nesting.length, 1, 'one deep region should produce one warning at its entry point');
        });

        test('two separate deep regions each get their own diagnostic', () => {
            const diags = lintText(`
                if (a) {
                    if (b) {
                        if (c) {
                            if (d) { x = 1; }
                        }
                    }
                }
                if (p) {
                    if (q) {
                        if (r) {
                            if (s) { y = 2; }
                        }
                    }
                }
                return "";
            `);
            const nesting = diags.filter(d => d.code === 'bml-deep-nesting');
            assert.strictEqual(nesting.length, 2, 'each violating region gets exactly one warning');
        });

        test('depth 3 stays clean', () => {
            const diags = lintText(`
                if (a) {
                    if (b) {
                        if (c) { x = 1; }
                    }
                }
                return "";
            `);
            const nesting = diags.filter(d => d.code === 'bml-deep-nesting');
            assert.strictEqual(nesting.length, 0);
        });
    });

    suite('bml-unguarded-print debug-block detection (forward pass)', () => {
        test('print inside if (debug) block is not flagged', () => {
            const diags = lintText(`
                debug = false;
                if (debug) {
                    print("trace");
                }
                return "";
            `);
            const prints = diags.filter(d => d.code === 'bml-unguarded-print');
            assert.strictEqual(prints.length, 0);
        });

        test('print nested deeper inside an if (debug) block is still guarded', () => {
            const diags = lintText(`
                debug = false;
                if (debug) {
                    if (x) {
                        print("trace");
                    }
                }
                return "";
            `);
            const prints = diags.filter(d => d.code === 'bml-unguarded-print');
            assert.strictEqual(prints.length, 0);
        });

        test('print after the debug block closes is flagged again', () => {
            const diags = lintText(`
                debug = false;
                if (debug) {
                    print("guarded");
                }
                print("unguarded");
                return "";
            `);
            const prints = diags.filter(d => d.code === 'bml-unguarded-print');
            assert.strictEqual(prints.length, 1, 'only the print outside the debug block is flagged');
        });

        test('bare print statement without parentheses is flagged too', () => {
            const diags = lintText(`
                print "hello";
                return "";
            `);
            const prints = diags.filter(d => d.code === 'bml-unguarded-print');
            assert.strictEqual(prints.length, 1);
        });
    });
});
