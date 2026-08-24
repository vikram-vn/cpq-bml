const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Dictionary Functions Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. dict(String dictType) -> Dictionary
    // =========================================================================
    suite('dict() - Create typed dictionary and dict<anytype>', () => {
        suite('Positive', () => {
            test('Initializes typed dictionaries (string, integer, float, date, boolean, array types, anytype)', () => {
                const diags = lintText(`
                    dStr = dict("string");
                    dInt = dict("integer");
                    dFlt = dict("float");
                    dDate = dict("date");
                    dBool = dict("boolean");
                    dArr = dict("string[]");
                    dAny = dict("anytype");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('Trailing comma in dict constructor → flags bml-trailing-comma-error', () => {
                const diags = lintText('d = dict("string", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Nested anytype dictionary declaration', () => {
                const diags = lintText(`
                    d = dict("anytype");
                    put(d, "subDict", dict("string"));
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. put(Dictionary dictID, key, value) -> Boolean
    // =========================================================================
    suite('put() - Insert or update key-value pair in dictionary', () => {
        suite('Positive', () => {
            test('Puts key-value entries into typed dictionary and dict<anytype>', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "key1", "value1");
                    put(d, 100, "valueWithIntKey");

                    dFloat = dict("float");
                    put(dFloat, "k1", 12.34);
                    put(dFloat, "k2", 50);

                    dArr1 = dict("string[]");
                    put(dArr1, "k1", string[]{"a", "b"});

                    dArr2 = dict("string[][]");
                    put(dArr2, "k1", string[][]{string[]{"a"}});

                    dDateArr = dict("date[]");
                    arrDate = date[]{getdate()};
                    put(dDateArr, "k1", arrDate);

                    dAny = dict("anytype");
                    put(dAny, "strKey", "text");
                    put(dAny, "jsonKey", json("{\\"k\\":\\"v\\"}"));
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-type'), undefined);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('put(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (missing value) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); put(d, "key"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); put(d, "k", "v", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('dict("string") with integer value → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("string"); put(d, "k", 123); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('dict("float") with string value → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("float"); put(d, "k", "notAFloat"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('dict("string[]") with scalar string → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("string[]"); put(d, "k", "scalarText"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('dict("string[][]") with 1D array → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("string[][]"); put(d, "k", string[]{"a"}); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('dict("date[]") with scalar date → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("date[]"); put(d, "k", getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('Empty key and value strings in put', () => {
                const diags = lintText('d = dict("string"); put(d, "", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. get(Dictionary dictID, key) -> Value
    // =========================================================================
    suite('get() - Retrieve value of key from dictionary', () => {
        suite('Positive', () => {
            test('Retrieves value with string and integer keys', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "SKU-01", "Server Blade");
                    val1 = get(d, "SKU-01");
                    val2 = get(d, "MISSING_KEY");
                    return val1;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = get(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing key) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); val = get(d); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); val = get(d, "k", "default", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('get on dict("anytype") with only 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dAny = dict("anytype"); val = get(dAny, "k1"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('get on empty unpopulated dictionary', () => {
                const diags = lintText('d = dict("string"); val = get(d, "nonexistent"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. containskey(Dictionary dictID, key) -> Boolean
    // =========================================================================
    suite('containskey() - Check if key exists in dictionary', () => {
        suite('Positive', () => {
            test('Verifies presence of string and numeric keys in dictionary', () => {
                const diags = lintText(`
                    d = dict("integer");
                    put(d, "itemCount", 50);
                    b1 = containskey(d, "itemCount");
                    b2 = containskey(d, "unknown");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = containskey(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing key) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); b = containskey(d); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); b = containskey(d, "k", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('containskey in conditional expressions', () => {
                const diags = lintText(`
                    d = dict("string");
                    if (containskey(d, "promoCode")) {
                        return get(d, "promoCode");
                    }
                    return "NO_CODE";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. keys(Dictionary dictID) -> String[]
    // =========================================================================
    suite('keys() - Retrieve unordered String Array of all dictionary keys', () => {
        suite('Positive', () => {
            test('Retrieves keys array and iterates with for...in loop', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "k1", "v1");
                    put(d, "k2", "v2");
                    allKeys = keys(d);
                    for k in allKeys {
                        print(k + ": " + get(d, k));
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('k = keys(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); k = keys(d, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('keys on empty dictionary returns empty array string[]{}', () => {
                const diags = lintText('d = dict("string"); k = keys(d); sz = sizeofarray(k); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. values(Dictionary dictID) -> Array
    // =========================================================================
    suite('values() - Retrieve typed array of all dictionary values', () => {
        suite('Positive', () => {
            test('Retrieves array of values from string, integer, float, date dictionaries', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "key1", "string1");
                    put(d, "key2", "string2");
                    allVals = values(d);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = values(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = dict("string"); v = values(d, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('values() on dict("boolean") → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("boolean"); v = values(d); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });

            test('values() on dict("anytype") → flags bml-function-arg-type Error', () => {
                const diags = lintText('d = dict("anytype"); v = values(d); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('values on empty dictionary returns empty array', () => {
                const diags = lintText('d = dict("string"); v = values(d); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
