const assert = require('assert');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - JSON Functions Exhaustive Part 2', () => {
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
