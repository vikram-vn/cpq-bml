const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Dictionary Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // ==========================================
    // 1. put(dict, key, value)
    // ==========================================
    suite('put() - Put key-value pair into dictionary', () => {
        suite('Positive', () => {
            test('put with String key and String value', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "name", "Oracle");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('put with Integer key and Float key', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, 100, "val1");
                    put(d, 99.9, "val2");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('put with expressions and nested dict', () => {
                const diags = lintText(`
                    d = dict("dict<string>");
                    sub = dict("string");
                    put(sub, "k", "v");
                    put(d, "subKey", sub);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('put(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('1 argument → Error', () => {
                const diags = lintText('d = dict("string"); put(d); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (missing value) → Error', () => {
                const diags = lintText('d = dict("string"); put(d, "k"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess parameter) → Error', () => {
                const diags = lintText('d = dict("string"); put(d, "k", "v", "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → bml-trailing-comma-error', () => {
                const diags = lintText('d = dict("string"); put(d, "k", "v", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty key and empty value strings handled without crash', () => {
                const diags = lintText('d = dict("string"); put(d, "", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Keyword collision as parameter identifiers', () => {
                const diags = lintText('put(return, break, continue); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // ==========================================
    // 2. dict(dictType) & dict<anytype>
    // ==========================================
    suite('dict() - Create Dictionary instance', () => {
        suite('Positive', () => {
            test('Valid primitive and array types: string, integer, float, date, boolean, string[]', () => {
                const diags = lintText(`
                    d1 = dict("string");
                    d2 = dict("integer");
                    d3 = dict("float");
                    d4 = dict("date");
                    d5 = dict("boolean");
                    d6 = dict("string[]");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-dict-invalid-type'), undefined);
            });

            test('Valid complex types: anytype, dict<string>, dict<anytype>, json, jsonarray, bytearray', () => {
                const diags = lintText(`
                    d1 = dict("anytype");
                    d2 = dict("dict<string>");
                    d3 = dict("dict<anytype>");
                    d4 = dict("json");
                    d5 = dict("jsonarray");
                    d6 = dict("bytearray");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-dict-invalid-type'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-dict-missing-type', () => {
                const diags = lintText('d = dict(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-dict-missing-type'));
            });

            test('Invalid type argument → flags bml-dict-invalid-type', () => {
                const diags = lintText('d = dict("unknown_type"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-dict-invalid-type'));
            });
        });
    });

    // ==========================================
    // 3. get, containskey, keys, values, remove
    // ==========================================
    suite('get(), containskey(), keys(), values(), remove()', () => {
        suite('Positive', () => {
            test('get() with 2 and 3 arguments', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "k", "v");
                    v1 = get(d, "k");
                    v2 = get(d, "k", "string");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('containskey() returns boolean check', () => {
                const diags = lintText(`
                    d = dict("string");
                    exists = containskey(d, "k");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('keys() returns string[] and values() returns array', () => {
                const diags = lintText(`
                    d = dict("string");
                    allKeys = keys(d);
                    allVals = values(d);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('remove() deletes key from dictionary', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "k", "v");
                    remove(d, "k");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('containskey() with non-dictionary target → flags bml-function-arg-type Warning', () => {
                const diags = lintText('res = containskey("not_a_dict", "k"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('get() with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = get(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
