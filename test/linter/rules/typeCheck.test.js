const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');
const { inferLiteralType, getAssignmentRhsText, checkAssignmentTypeConsistency } = require('../../../app/lang/lint/rules/typeCheck');

suite('BML Linter Test Suite - variable type consistency', () => {
    test('Flags reassigning an Integer-typed variable to a String literal', () => {
        const diagnostics = lintText(`
            test = 1;
            test = "2";
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag the type mismatch');
        assert.ok(diag.message.includes('Integer') && diag.message.includes('String'));
        assert.strictEqual(diag.range.start.line, 2);
        assert.strictEqual(diag.severity, vscode.DiagnosticSeverity.Error);
    });

    test('Flags reassigning a String-typed variable to a Boolean literal', () => {
        const diagnostics = lintText(`
            flag = "yes";
            flag = true;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag String -> Boolean mismatch');
    });

    test('Does not flag repeated assignment of the same type', () => {
        const diagnostics = lintText(`
            count = 1;
            count = 2;
            count = 3;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined, 'Same-type reassignment is normal and should not be flagged');
    });

    test('Does not flag when the later assignment is not a plain literal', () => {
        const diagnostics = lintText(`
            value = 1;
            value = atoi(someInput);
            value = value + 1;
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined, 'Function calls and expressions are not type-inferred - conservatively skipped');
    });

    test('Does not flag a comparison that looks like assignment from behind', () => {
        const diagnostics = lintText(`
            x = 1;
            if (x <= "2") {
                return "";
            }
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined, '<= should never be mistaken for an assignment');
    });

    test('inferLiteralType returns null for anything that is not a bare literal', () => {
        assert.strictEqual(inferLiteralType('atoi(x)'), null);
        assert.strictEqual(inferLiteralType('x + 1'), null);
        assert.strictEqual(inferLiteralType('"a" + "b"'), null);
        assert.strictEqual(inferLiteralType('someVar'), null);
    });

    test('inferLiteralType correctly identifies each literal type', () => {
        assert.strictEqual(inferLiteralType('"hello"'), 'String');
        assert.strictEqual(inferLiteralType("'hello'"), 'String');
        assert.strictEqual(inferLiteralType('true'), 'Boolean');
        assert.strictEqual(inferLiteralType('FALSE'), 'Boolean');
        assert.strictEqual(inferLiteralType('42'), 'Integer');
        assert.strictEqual(inferLiteralType('-7'), 'Integer');
        assert.strictEqual(inferLiteralType('3.14'), 'Float');
    });

    test('inferLiteralType identifies typed array literals and bare declarations', () => {
        assert.strictEqual(inferLiteralType('string[]{"a", "b"}'), 'string[]');
        assert.strictEqual(inferLiteralType('Integer[]{1, 2, 3}'), 'integer[]');
        assert.strictEqual(inferLiteralType('string[][]{{"a"}, {"b"}}'), 'string[][]');
        assert.strictEqual(inferLiteralType('boolean[]'), 'boolean[]');
        assert.strictEqual(inferLiteralType('Date[]'), 'date[]');
    });

    test('inferLiteralType identifies type-named constructor calls', () => {
        assert.strictEqual(inferLiteralType('dict()'), 'Dictionary');
        assert.strictEqual(inferLiteralType('json()'), 'Json');
        assert.strictEqual(inferLiteralType('jsonarray()'), 'JsonArray');
        assert.strictEqual(inferLiteralType('bytearray()'), 'ByteArray');
        assert.strictEqual(inferLiteralType('stringbuilder()'), 'StringBuilder');
        assert.strictEqual(inferLiteralType('recordset()'), 'RecordSet');
        // Constructor calls with nested calls as arguments are not "unambiguous" - skipped.
        assert.strictEqual(inferLiteralType('dict("a", lookupSomething())'), null);
    });

    test('Flags reassigning a typed-array variable to a different element type', () => {
        const diagnostics = lintText(`
            list = string[]{"a", "b"};
            list = integer[]{1, 2};
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag string[] -> integer[] mismatch');
        assert.ok(diag.message.includes('string[]') && diag.message.includes('integer[]'));
    });

    test('Flags reassigning a Dictionary-typed variable to a Json literal', () => {
        const diagnostics = lintText(`
            data = dict();
            data = json();
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.ok(diag, 'Should flag Dictionary -> Json mismatch');
    });

    test('Does not flag repeated same-shape array or constructor reassignment', () => {
        const diagnostics = lintText(`
            list = string[]{"a"};
            list = string[]{"b", "c"};
            data = dict();
            data = dict("k", "v");
            return "";
        `);

        const diag = diagnostics.find(d => d.code === 'bml-type-mismatch');
        assert.strictEqual(diag, undefined);
    });

    test('getAssignmentRhsText parses single-line assignment terminated by semicolon', () => {
        const res = getAssignmentRhsText('x = 42; y = 10;', 4);
        assert.deepStrictEqual(res, { text: '42', endIndex: 6 });
    });

    test('getAssignmentRhsText returns null for multi-line without nesting', () => {
        const res = getAssignmentRhsText('x = 42\ny = 10;', 4);
        assert.strictEqual(res, null);
    });

    test('getAssignmentRhsText skips escaped characters inside strings', () => {
        const res = getAssignmentRhsText('x = "hello \\" world;"; y = 10;', 4);
        assert.deepStrictEqual(res, { text: '"hello \\" world;"', endIndex: 21 });
    });

    test('getAssignmentRhsText tracks nested parentheses and braces', () => {
        const res1 = getAssignmentRhsText('x = dict("k", jsonarray(1, 2, 3)); y = 10;', 4);
        assert.deepStrictEqual(res1, { text: 'dict("k", jsonarray(1, 2, 3))', endIndex: 33 });

        const res2 = getAssignmentRhsText('x = string[][]{{"a"}, {"b"}}; y = 10;', 4);
        assert.deepStrictEqual(res2, { text: 'string[][]{{"a"}, {"b"}}', endIndex: 28 });
    });

    test('inferLiteralType returns correct types for various constructor edge cases', () => {
        assert.strictEqual(inferLiteralType('jsonnull()'), 'JsonNull');
        assert.strictEqual(inferLiteralType('recordset()'), 'RecordSet');
        // Unrecognized constructor name returns null
        assert.strictEqual(inferLiteralType('nonexistentctor()'), null);
    });

    suite('Generalized Binary and Comparison Type Checking', () => {
        test('Flags combining Boolean and String with +', () => {
            const diagnostics = lintText(`
                x = true + "1";
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag Boolean + String');
        });

        test('Flags combining Integer and Boolean with +', () => {
            const diagnostics = lintText(`
                x = 1 + true;
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag Integer + Boolean');
        });

        test('Flags comparison of String and Integer with ==', () => {
            const diagnostics = lintText(`
                x = "hello" == 123;
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag String == Integer');
        });

        test('Flags comparison of String and Integer with <', () => {
            const diagnostics = lintText(`
                x = "hello" < 123;
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag String < Integer');
        });

        test('Does not flag comparison with null', () => {
            const diagnostics = lintText(`
                x = "hello" == null;
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(diag, undefined, 'Should not flag String == null');
        });

        test('Does not flag standard string and numeric comparison operations', () => {
            const diagnostics = lintText(`
                x = 10 <= 20;
                y = "a" >= "b";
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(diag, undefined, 'Should not flag valid comparisons');
        });

        // Regression: getLeftOperandType/getRightOperandType only recognized
        // literals and plain variables - a function call operand like atoi(100)
        // resolved to null (unknown), which short-circuited the whole check
        // ("if (!leftType || !rightType) continue;"), silently letting
        // `"test" + atoi(100)` (String + Integer) through uncaught.
        test('Flags combining a String literal and a function call\'s Integer return type with +', () => {
            const diagnostics = lintText(`
                finalStr = "test" + atoi(100) + 100;
                return finalStr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag String + atoi(...) (Integer)');
            assert.match(diag.message, /Cannot combine 'String' and 'Integer'/);
        });

        test('Flags combining a function call\'s Integer return type and a String literal with + (function call on the left)', () => {
            const diagnostics = lintText(`
                finalStr = atoi(100) + "test";
                return finalStr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag atoi(...) (Integer) + String');
            assert.match(diag.message, /Cannot combine 'String' and 'Integer'/);
        });

        test('Does not flag two numeric-returning function calls combined with +', () => {
            const diagnostics = lintText(`
                total = atoi("1") + atoi("2");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(diag, undefined, 'atoi(...) + atoi(...) is Integer + Integer - should not be flagged');
        });

        test('Does not flag a function call combined with a variable of unknown type (e.g. a bare parameter)', () => {
            const diagnostics = lintText(`
                x = atoi("1") + someUndeclaredThing;
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(diag, undefined, 'Should stay conservative when the other operand\'s type is unknown, not guess a mismatch');
        });

        // Regression: the operand-type lookup only checked FUNCTION_RETURN_TYPES
        // (regular functions), not TYPE_CONSTRUCTORS (dict/json/jsonarray/... -
        // calls whose name IS the type they build), so `"test" + dict("float")`
        // silently passed. Fixed by switching to bml-functions-api-usage.json's
        // "returnType" field, generated from the real CPQ REST API data, which
        // already unifies both categories (dict -> Dictionary, json -> Json,
        // etc.) - verified this is a strict superset of the old hardcoded map.
        test('Flags combining a String literal and dict()\'s Dictionary return type with +', () => {
            const diagnostics = lintText(`
                finalStr = "test" + "test" + dict("float");
                return finalStr;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag String + dict(...) (Dictionary)');
            assert.match(diag.message, /'String' and 'Dictionary'/);
        });

        test('Does not flag dict() combined with another Dictionary-typed value', () => {
            const diagnostics = lintText(`
                x = dict("float") == dict("float");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(diag, undefined, 'Comparing two Dictionary constructor calls should not be flagged as a type mismatch');
        });

        test('Does not flag array elements indexed with [] combined with String literals (string[] indexing)', () => {
            const diagnostics = lintText(`
                lineNoConfigArray = split("a.b", ".");
                lineNoConfig = lineNoConfigArray[0] + "." + lineNoConfigArray[1];
                return lineNoConfig;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(diag, undefined, 'Indexing string[] returns String, not string[] - should not flag binary mismatch');
        });

        test('Flags combining an Integer array element and a String literal with +', () => {
            const diagnostics = lintText(`
                numArr = integer[]{1, 2, 3};
                val = numArr[0] + "hello";
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag Integer + String when array element is indexed');
        });

        test('Infers Integer from arithmetic expression like atoi(...) - 1 and flags string concatenation without string()', () => {
            const diagnostics = lintText(`
                activeCycleEndDate = "2026-09-06";
                priorYear = atoi(datetostr(activeCycleEndDate, "yyyy", "America/Chicago")) - 1;
                lowerLimitJavaDate = strtojavadate(priorYear + "-" + "02-28", "yyyy-MM-dd", "America/Chicago");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-binary-type-mismatch');
            assert.ok(diag, 'Should flag priorYear + "-" as type mismatch');
            assert.ok(diag.message.includes("Convert Integer to String using 'string()'"), 'Message should specifically guide converting Integer to String');
        });

        test('Does not flag comparisons (<>, ==, !=, <, >, <=, >=) or arithmetic between Number, Float, and Integer', () => {
            const declaredTypes = new Map();
            declaredTypes.set('totaldayscontract', 'Number');
            declaredTypes.set('price', 'Float');

            const text = `
                if (totalDaysContract <> 364 AND totalDaysContract <> 365) {
                    totalYear = totalDaysContract / 365;
                }
                if (price > 100 AND price == 200.5) {
                    diff = price - 50;
                }
                return "";
            `;
            const doc = {
                positionAt: (idx) => {
                    const lines = text.slice(0, idx).split(/\r?\n/);
                    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
                }
            };
            const diagnostics = checkAssignmentTypeConsistency(text, doc, vscode, declaredTypes);
            const binaryDiags = diagnostics.filter(d => d.code === 'bml-binary-type-mismatch');
            assert.strictEqual(binaryDiags.length, 0, 'Comparing Number/Float with Integer should not be flagged as a type mismatch');
        });
    });

    suite('Typed Dictionary Static Value Type Checking', () => {
        test('Flags inserting String literal into dict("integer")', () => {
            const diagnostics = lintText(`
                intMap = dict("integer");
                put(intMap, "k1", "not_an_int");
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-put-type-mismatch');
            assert.ok(diag, 'Should flag invalid String value inserted into integer dictionary');
            assert.ok(diag.message.includes('intMap') && diag.message.includes('integer') && diag.message.includes('String'));
        });

        test('Flags inserting Date object into dict("string")', () => {
            const diagnostics = lintText(`
                strMap = dict("string");
                put(strMap, "dateKey", getdate());
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-put-type-mismatch');
            assert.ok(diag, 'Should flag Date value inserted into string dictionary');
        });

        test('Allows inserting Integer into dict("float") (numeric widening)', () => {
            const diagnostics = lintText(`
                floatMap = dict("float");
                put(floatMap, "price", 100);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-put-type-mismatch');
            assert.strictEqual(diag, undefined, 'Integer widening into float dictionary should be allowed');
        });

        test('Allows inserting any type into dict("anytype")', () => {
            const diagnostics = lintText(`
                anyMap = dict("anytype");
                put(anyMap, "k1", "val");
                put(anyMap, "k2", 123);
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-dict-put-type-mismatch');
            assert.strictEqual(diag, undefined, 'anytype dictionary should accept any value');
        });
    });

    suite('Array Bounds Static Checking', () => {
        test('Flags out-of-bounds constant indexing on sized array constructor', () => {
            const diagnostics = lintText(`
                myArr = string[2];
                val = myArr[2];
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-array-bounds-error');
            assert.ok(diag, 'Should flag index 2 on array of size 2 (valid indices: 0, 1)');
            assert.ok(diag.message.includes('Index 2') && diag.message.includes('size of 2'));
        });

        test('Flags out-of-bounds constant indexing on literal array initializer', () => {
            const diagnostics = lintText(`
                items = string[]{"first", "second"};
                outVal = items[5];
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-array-bounds-error');
            assert.ok(diag, 'Should flag index 5 on array of size 2');
        });

        test('Does not flag in-bounds indexing', () => {
            const diagnostics = lintText(`
                items = string[]{"first", "second"};
                inVal = items[1];
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-array-bounds-error');
            assert.strictEqual(diag, undefined, 'In-bounds indexing should not be flagged');
        });
    });
});

