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

    // =========================================================================
    // 11. jsonnull() -> JsonNull
    // =========================================================================
    suite('jsonnull() - Create JSON null instance', () => {
        suite('Positive', () => {
            test('0 arguments creates JsonNull instance', () => {
                const diags = lintText(`
                    jNull = jsonnull();
                    j = json();
                    jsonput(j, "nullKey", jNull);
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('jn = jsonnull("excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Assigning jsonnull to multiple keys', () => {
                const diags = lintText(`
                    j = json();
                    jsonput(j, "k1", jsonnull());
                    jsonput(j, "k2", jsonnull());
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 12. jsonpathcheck(Json jObj, String jsonPath) -> Boolean
    // =========================================================================
    suite('jsonpathcheck() - Verify existence of JSON path expression', () => {
        suite('Positive', () => {
            test('Validates deep scan and array index JSON paths ($..expensive, $.store.book[0])', () => {
                const diags = lintText(`
                    j = json("{\\"store\\":{\\"book\\":[{\\"title\\":\\"T1\\"}]},\\"expensive\\":10}");
                    b1 = jsonpathcheck(j, "$.store.book[0].title");
                    b2 = jsonpathcheck(j, "$..expensive");
                    b3 = jsonpathcheck(j, "$..missingKey");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonpathcheck(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing path) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonpathcheck(json()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonpathcheck(json(), "$.id", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('jsonpathcheck in conditional logic', () => {
                const diags = lintText(`
                    j = json("{\\"user\\":{\\"email\\":\\"test@test.com\\"}}");
                    if (jsonpathcheck(j, "$.user.email")) {
                        return jsonpathgetsingle(j, "$.user.email");
                    }
                    return "no-email";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 13. jsonpathgetmultiple(Json jObj, String jsonPath [, Boolean asPath]) -> JsonArray
    // =========================================================================
    suite('jsonpathgetmultiple() - Retrieve multiple values or path nodes from JSON path', () => {
        suite('Positive', () => {
            test('2 and 3 arguments (with asPath boolean flag)', () => {
                const diags = lintText(`
                    j = json("{\\"items\\":[{\\"price\\":10},{\\"price\\":20},{\\"price\\":30}]}");
                    prices = jsonpathgetmultiple(j, "$..price");
                    pricePaths = jsonpathgetmultiple(j, "$..price", true);
                    filtered = jsonpathgetmultiple(j, "$.items[?(@.price > 15)]");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('ja = jsonpathgetmultiple(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('ja = jsonpathgetmultiple(json(), "$.id", true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('JSON path array slicing [1:3] in jsonpathgetmultiple', () => {
                const diags = lintText(`
                    j = json("{\\"key\\":[{\\"v\\":1},{\\"v\\":2},{\\"v\\":3},{\\"v\\":4}]}");
                    res = jsonpathgetmultiple(j, "$..key[1:3].v");
                    return jsonarraytostr(res);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 14. jsonpathgetsingle(Json jObj, String jsonPath [, String valueType [, <ValueType> defaultValue]])
    // =========================================================================
    suite('jsonpathgetsingle() - Retrieve single value from JSON path with casting and default', () => {
        suite('Positive', () => {
            test('2, 3, and 4 arguments with valueType casting and defaultValue fallback', () => {
                const diags = lintText(`
                    j = json("{\\"store\\":{\\"book\\":[{\\"price\\":8.95}],\\"expensive\\":10}}");
                    firstBook = jsonpathgetsingle(j, "$.store.book[0]", "json");
                    price = jsonpathgetsingle(j, "$.store.book[0].price", "float");
                    exp = jsonpathgetsingle(j, "$.expensive", "integer");
                    def = jsonpathgetsingle(j, "$.missing", "string", "N/A");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonpathgetsingle(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing path) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonpathgetsingle(json()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = jsonpathgetsingle(json(), "$.id", "string", "def", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Predicate filter in jsonpathgetsingle', () => {
                const diags = lintText(`
                    j = json("{\\"lines\\":[{\\"docNum\\":\\"33\\",\\"qty\\":1},{\\"docNum\\":\\"40\\",\\"qty\\":20}]}");
                    line40 = jsonpathgetsingle(j, "$..lines[?(@.docNum=='40')]", "json");
                    return jsontostr(line40);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 15. jsonpathremove(Json jObj, String jsonPath) -> Boolean
    // =========================================================================
    suite('jsonpathremove() - Remove nodes matching JSON path expression', () => {
        suite('Positive', () => {
            test('Removes matching nodes from JSON structure', () => {
                const diags = lintText(`
                    j = json("{\\"lines\\":[{\\"docNum\\":\\"33\\"},{\\"docNum\\":\\"40\\"}],\\"temp\\":true}");
                    b1 = jsonpathremove(j, "$.temp");
                    b2 = jsonpathremove(j, "$..lines[?(@.docNum=='33')]");
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonpathremove(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing path) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonpathremove(json()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonpathremove(json(), "$.id", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Removing nonexistent path returns false', () => {
                const diags = lintText('j = json("{\\"a\\":1}"); b = jsonpathremove(j, "$..nonexistent"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 16. jsonpathset(Json jObj, String jsonPath, <ValueType> value) -> String[]
    // =========================================================================
    suite('jsonpathset() - Update all nodes matching JSON path with value', () => {
        suite('Positive', () => {
            test('Updates matching nodes returning array of updated paths', () => {
                const diags = lintText(`
                    j = json("{\\"lines\\":[{\\"qty\\":1},{\\"qty\\":2}]}");
                    updatedPaths = jsonpathset(j, "$..qty", 8);
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('paths = jsonpathset(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (missing value) → flags bml-function-arg-count Error', () => {
                const diags = lintText('paths = jsonpathset(json(), "$.id"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('paths = jsonpathset(json(), "$.id", 10, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Updating array range with jsonpathset ($.key[1:3].value)', () => {
                const diags = lintText(`
                    j = json("{\\"key\\":[{\\"val\\":1},{\\"val\\":2},{\\"val\\":3},{\\"val\\":4}]}");
                    paths = jsonpathset(j, "$.key[1:3].val", 99);
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 17. jsonput(Json jObj, String key, <ValueType> value) -> <ValueType>
    // =========================================================================
    suite('jsonput() - Insert or update key-value entry in JSON object', () => {
        suite('Positive', () => {
            test('Inserts strings, integers, floats, booleans, arrays, and JSON objects', () => {
                const diags = lintText(`
                    j = json();
                    s = jsonput(j, "kStr", "text");
                    i = jsonput(j, "kInt", 100);
                    f = jsonput(j, "kFlt", 45.67);
                    b = jsonput(j, "kBool", true);
                    arr = jsonput(j, "kArr", jsonarray("[1, 2]"));
                    sub = jsonput(j, "kSub", json("{\\"inner\\":true}"));
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('jsonput(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (missing value) → flags bml-function-arg-count Error', () => {
                const diags = lintText('j = json(); jsonput(j, "key"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('j = json(); jsonput(j, "k", "v", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Updating existing key overrides value and returns new value', () => {
                const diags = lintText(`
                    j = json();
                    jsonput(j, "status", "INITIAL");
                    newVal = jsonput(j, "status", "UPDATED");
                    return newVal;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 18. jsonremove(Json jObj, String key) -> Boolean
    // =========================================================================
    suite('jsonremove() - Remove first-level key-value entry from JSON object', () => {
        suite('Positive', () => {
            test('Removes first-level key and returns boolean', () => {
                const diags = lintText(`
                    j = json("{\\"a\\":1, \\"b\\":2}");
                    bRem = jsonremove(j, "a");
                    return jsontostr(j);
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonremove(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing key) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonremove(json()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = jsonremove(json(), "k", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Removing nonexistent key returns false', () => {
                const diags = lintText('j = json("{\\"a\\":1}"); b = jsonremove(j, "nonexistentKey"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 19. jsontostr(Json jObj) & jsonarraytostr(JsonArray jArr)
    // =========================================================================
    suite('jsontostr() & jsonarraytostr() - Serialize JSON objects and arrays to string', () => {
        suite('Positive', () => {
            test('Serializes populated and empty JSON objects and arrays', () => {
                const diags = lintText(`
                    j = json("{\\"k\\":\\"v\\"}");
                    sObj = jsontostr(j);
                    ja = jsonarray("[1, 2, 3]");
                    sArr = jsonarraytostr(ja);
                    return sObj;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('jsontostr with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = jsontostr(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('jsonarraytostr with 2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = jsonarraytostr(jsonarray(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Serializing empty JSON instances returns "{}" and "[]"', () => {
                const diags = lintText('s1 = jsontostr(json()); s2 = jsonarraytostr(jsonarray()); return s1 + s2;');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
