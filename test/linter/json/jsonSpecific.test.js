const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - JSON Functions Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. isjsonnull(jsonIdentifier, key | jsonArrayIdentifier, index) -> Boolean
    // =========================================================================
    suite('isjsonnull() - Check for null values in JSON object or JSON array', () => {
        suite('Positive', () => {
            test('Checks null value for object key and array index', () => {
                const diags = lintText(`
                    jObj = json("{\\"k1\\":null, \\"k2\\":\\"val\\"}");
                    b1 = isjsonnull(jObj, "k1");
                    jArr = jsonarray("[null, 45, \\"str\\"]");
                    b2 = isjsonnull(jArr, 0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isjsonnull(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing key/index) → flags bml-function-arg-count Error', () => {
                const diags = lintText('j = json(); b = isjsonnull(j); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('j = json(); b = isjsonnull(j, "k", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('isjsonnull in conditional statement with jsonput fallback', () => {
                const diags = lintText(`
                    j = json("{\\"finalDate\\":null}");
                    if (isjsonnull(j, "finalDate")) {
                        jsonput(j, "finalDate", "2026-01-01");
                    }
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. json([String jsonFormatStr]) -> Json
    // =========================================================================
    suite('json() - Create JSON object from formatted string or empty instance', () => {
        suite('Positive', () => {
            test('0 arguments (empty object) and 1 argument (JSON string)', () => {
                const diags = lintText(`
                    jEmpty = json();
                    jPop = json("{\\"key1\\":\\"value1\\", \\"key2\\":100}");
                    return jsontostr(jPop);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('j = json("{}", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Malformed JSON string parsing handled gracefully by linter', () => {
                const diags = lintText('j = json("{unclosed json string"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. jsonarray([String jsonArrStr]) -> JsonArray
    // =========================================================================
    suite('jsonarray() - Create JSON array object from string or empty instance', () => {
        suite('Positive', () => {
            test('0 arguments (empty array) and 1 argument (JSON array string)', () => {
                const diags = lintText(`
                    jArrEmpty = jsonarray();
                    jArrPop = jsonarray("[1, \\"val1\\", {\\"key1\\":10}]");
                    return jsonarraytostr(jArrPop);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('ja = jsonarray("[]", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty JSON array instantiation', () => {
                const diags = lintText('ja = jsonarray(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. jsonarrayappend(JsonArray jArr, <ValueType> value) -> <ValueType>
    // =========================================================================
    suite('jsonarrayappend() - Append value to end of JSON array', () => {
        suite('Positive', () => {
            test('Appends integers, strings, floats, booleans, and JSON objects', () => {
                const diags = lintText(`
                    ja = jsonarray();
                    v1 = jsonarrayappend(ja, 100);
                    v2 = jsonarrayappend(ja, "Sample");
                    v3 = jsonarrayappend(ja, json("{\\"nested\\":true}"));
                    return jsonarraytostr(ja);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('jsonarrayappend(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing value) → flags bml-function-arg-count Error', () => {
                const diags = lintText('ja = jsonarray(); jsonarrayappend(ja); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('ja = jsonarray(); jsonarrayappend(ja, "val", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Append jsonnull() instance to array', () => {
                const diags = lintText('ja = jsonarray(); jsonarrayappend(ja, jsonnull()); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. jsonarraycopy(JsonArray jArr) & jsoncopy(Json jObj)
    // =========================================================================
    suite('jsonarraycopy() & jsoncopy() - Deep clone JSON array and JSON object', () => {
        suite('Positive', () => {
            test('Clones JSON array and JSON object maintaining independent copies', () => {
                const diags = lintText(`
                    jaOrig = jsonarray("[1, 2, 3]");
                    jaCopy = jsonarraycopy(jaOrig);
                    jOrig = json("{\\"k\\":\\"v\\"}");
                    jCopy = jsoncopy(jOrig);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('jsoncopy with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('j = jsoncopy(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('jsonarraycopy with 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('ja = jsonarraycopy(jsonarray(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Deep copy of deeply nested complex JSON hierarchy', () => {
                const diags = lintText(`
                    j = json("{\\"asset\\":{\\"lines\\":[{\\"id\\":1},{\\"id\\":2}]}}");
                    c = jsoncopy(j);
                    jsonremove(j, "asset");
                    return jsontostr(c);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. jsonarrayget(JsonArray jArr, Integer index [, String valueType]) -> <ValueType>
    // =========================================================================
    suite('jsonarrayget() - Retrieve element from JSON array with typed casting', () => {
        suite('Positive', () => {
            test('Gets string, integer, float, boolean, json, jsonarray from array', () => {
                const diags = lintText(`
                    ja = jsonarray("[\\"text\\", 10, 2.9, true, [1, 2], {\\"k\\":\\"v\\"}]");
                    s = jsonarrayget(ja, 0);
                    i = jsonarrayget(ja, 1, "integer");
                    f = jsonarrayget(ja, 2, "float");
                    b = jsonarrayget(ja, 3, "boolean");
                    subArr = jsonarrayget(ja, 4, "jsonarray");
                    subObj = jsonarrayget(ja, 5, "json");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonarrayget(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing index) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonarrayget(jsonarray()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonarrayget(jsonarray(), 0, "string", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Index expression in jsonarrayget', () => {
                const diags = lintText('ja = jsonarray("[10, 20, 30]"); val = jsonarrayget(ja, jsonarraysize(ja) - 1, "integer"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 7. jsonarrayrefid(JsonArray jArr) -> String
    // =========================================================================
    suite('jsonarrayrefid() - Return unique reference ID to update Commerce array sets', () => {
        suite('Positive', () => {
            test('Generates reference ID string for Commerce array sets', () => {
                const diags = lintText(`
                    feeJsonArray = jsonarray();
                    ref = "1~feeArraySet~" + jsonarrayrefid(feeJsonArray);
                    return ref;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = jsonarrayrefid(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('r = jsonarrayrefid(jsonarray(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Modifications to JSON array after reference ID generation', () => {
                const diags = lintText(`
                    feeArray = jsonarray("[{\\"id\\":1}]");
                    res = "1~feeArraySet~" + jsonarrayrefid(feeArray);
                    jsonarrayremove(feeArray, 0);
                    return res;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 8. jsonarrayremove(JsonArray jArr, Integer index) & jsonarraysize(JsonArray jArr)
    // =========================================================================
    suite('jsonarrayremove() & jsonarraysize() - Array size inspection and removal', () => {
        suite('Positive', () => {
            test('Inspects size and removes element returning new size', () => {
                const diags = lintText(`
                    ja = jsonarray("[1, 2, 3]");
                    sz1 = jsonarraysize(ja);
                    remSize = jsonarrayremove(ja, 1);
                    sz2 = jsonarraysize(ja);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('jsonarraysize with 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('sz = jsonarraysize(jsonarray(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('jsonarrayremove with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('rem = jsonarrayremove(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('jsonarraysize on empty JSON array returns 0', () => {
                const diags = lintText('ja = jsonarray(); if (jsonarraysize(ja) == 0) { return "empty"; } return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 9. jsonget(Json jObj, String key [, String valueType [, <ValueType> defaultValue]])
    // =========================================================================
    suite('jsonget() - Retrieve value from JSON object with type casting and default fallback', () => {
        suite('Positive', () => {
            test('2, 3, and 4 arguments with types and fallback values', () => {
                const diags = lintText(`
                    j = json("{\\"name\\":\\"CPQ\\", \\"price\\":99.5, \\"qty\\":5, \\"active\\":true}");
                    s = jsonget(j, "name");
                    p = jsonget(j, "price", "float");
                    q = jsonget(j, "qty", "integer");
                    a = jsonget(j, "active", "boolean");
                    def = jsonget(j, "missingKey", "string", "DefaultVal");
                    return s;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonget(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing key) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonget(json()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonget(json(), "k", "string", "def", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('jsonget on unpopulated keys with default integer fallback', () => {
                const diags = lintText('j = json(); count = jsonget(j, "count", "integer", 0); return string(count);');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 10. jsonkeys(Json jObj [, Boolean ignoreNullValues]) -> String[]
    // =========================================================================
    suite('jsonkeys() - Retrieve first-level keys array with optional null filtering', () => {
        suite('Positive', () => {
            test('1 and 2 arguments (with ignoreNullValues boolean)', () => {
                const diags = lintText(`
                    j = json("{\\"k1\\":\\"v1\\", \\"k2\\":null, \\"k3\\":10}");
                    allKeys = jsonkeys(j);
                    nonNullKeys = jsonkeys(j, true);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('k = jsonkeys(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('k = jsonkeys(json(), true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Iterate over jsonkeys with for...in loop', () => {
                const diags = lintText(`
                    j = json("{\\"a\\":1, \\"b\\":2}");
                    for k in jsonkeys(j) {
                        print(k + ": " + jsonget(j, k));
                    }
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});

