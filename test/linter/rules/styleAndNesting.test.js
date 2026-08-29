const assert = require('assert');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - deep nesting and print guard', () => {
    suite('bml-deep-nesting flags once per violating region', () => {
        test('a single depth-7 region yields exactly one diagnostic, not one per brace', () => {
            const diags = lintText(`
                if (a) {
                    if (b) {
                        if (c) {
                            if (d) {
                                if (e) {
                                    if (f) {
                                        if (g) {
                                            x = 1;
                                        }
                                    }
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
                            if (d) {
                                if (e) {
                                    if (f) { x = 1; }
                                }
                            }
                        }
                    }
                }
                if (p) {
                    if (q) {
                        if (r) {
                            if (s) {
                                if (t) {
                                    if (u) { y = 2; }
                                }
                            }
                        }
                    }
                }
                return "";
            `);
            const nesting = diags.filter(d => d.code === 'bml-deep-nesting');
            assert.strictEqual(nesting.length, 2, 'each violating region gets exactly one warning');
        });

        test('depth 5 stays clean', () => {
            const diags = lintText(`
                if (a) {
                    if (b) {
                        if (c) {
                            if (d) {
                                if (e) { x = 1; }
                            }
                        }
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

    suite('bml-nested-loop flags loops exceeding recommended limit of 3', () => {
        test('up to 3 nested for-loops stay clean without warnings', () => {
            const diags = lintText(`
                for a in arr1 {
                    for b in arr2 {
                        for c in arr3 {
                            x = 1;
                        }
                    }
                }
                return "";
            `);
            const loopDiags = diags.filter(d => d.code === 'bml-nested-loop');
            assert.strictEqual(loopDiags.length, 0);
        });

        test('4 nested for-loops flag the 4th loop exceeding max depth 3', () => {
            const diags = lintText(`
                for a in arr1 {
                    for b in arr2 {
                        for c in arr3 {
                            for d in arr4 {
                                x = 1;
                            }
                        }
                    }
                }
                return "";
            `);
            const loopDiags = diags.filter(d => d.code === 'bml-nested-loop');
            assert.strictEqual(loopDiags.length, 1);
            assert.ok(loopDiags[0].message.includes('Loop nesting depth of 4 exceeds recommended limit of 3'));
        });
    });

    suite('bml-for-in-function-call flags direct function calls in for-in loops', () => {
        test('flags for key in jsonkeys(jsonVar) with error', () => {
            const diags = lintText(`
                j = json();
                for key in jsonkeys(j) {
                    val = jsonget(j, key);
                }
                return "";
            `);
            const err = diags.find(d => d.code === 'bml-for-in-function-call');
            assert.ok(err, 'expected bml-for-in-function-call error');
            assert.match(err.message, /jsonkeys/i);
        });

        test('flags for k in getkeys(dictVar) with error', () => {
            const diags = lintText(`
                d = dict("string");
                for k in getkeys(d) {
                    v = get(d, k);
                }
                return "";
            `);
            const err = diags.find(d => d.code === 'bml-for-in-function-call');
            assert.ok(err, 'expected bml-for-in-function-call error');
            assert.match(err.message, /getkeys/i);
        });

        test('allows for i in range(0, 10) loop', () => {
            const diags = lintText(`
                for i in range(0, 10) {
                    print(i);
                }
                return "";
            `);
            const err = diags.find(d => d.code === 'bml-for-in-function-call');
            assert.strictEqual(err, undefined, 'range() is a valid loop generator');
        });

        test('allows variable iteration: keys = jsonkeys(j); for key in keys', () => {
            const diags = lintText(`
                j = json();
                keys = jsonkeys(j);
                for key in keys {
                    val = jsonget(j, key);
                }
                return "";
            `);
            const err = diags.find(d => d.code === 'bml-for-in-function-call');
            assert.strictEqual(err, undefined, 'variable iteration should be clean');
        });
    });
});

