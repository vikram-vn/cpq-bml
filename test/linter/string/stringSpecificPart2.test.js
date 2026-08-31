const assert = require('assert');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - String Exhaustive Part 2', () => {
    // =========================================================================
    // 11. isnumber(String str) -> Boolean
    // =========================================================================
    suite('isnumber() - Validate if string contains a number', () => {
        suite('Positive', () => {
            test('Validates integer, float, and non-numeric string values', () => {
                const diags = lintText(`
                    b1 = isnumber("123");
                    b2 = isnumber("45.67");
                    b3 = isnumber("ABC");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isnumber(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isnumber("123", "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns false in BML without error', () => {
                const diags = lintText('b = isnumber(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 12. len(String str) -> Integer
    // =========================================================================
    suite('len() - Return string character count', () => {
        suite('Positive', () => {
            test('Returns character count', () => {
                const diags = lintText('l = len("sample text"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('l = len(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('l = len("text", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns 0 in BML', () => {
                const diags = lintText('l = len(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 13. lower(String str) -> String
    // =========================================================================
    suite('lower() - Convert all characters to lowercase', () => {
        suite('Positive', () => {
            test('Converts uppercase text to lowercase', () => {
                const diags = lintText('low = lower("ORACLE CPQ"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('low = lower(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('low = lower("ABC", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns empty string', () => {
                const diags = lintText('low = lower(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 14. replace(String str, String old, String new [, Integer n]) -> String
    // =========================================================================
    suite('replace() - Return copy of string with occurrences replaced', () => {
        suite('Positive', () => {
            test('3 arguments (replace all) and 4 arguments (first n occurrences)', () => {
                const diags = lintText(`
                    r1 = replace("aaa", "a", "b");
                    r2 = replace("aaa", "a", "b", 2);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('2 arguments (missing new substring) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = replace("text", "old"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = replace("a", "b", "c", 1, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty target string', () => {
                const diags = lintText('res = replace("", "a", "b"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 15. find(String str, String substring [, Integer start [, Integer end]]) -> Integer
    // =========================================================================
    suite('find() - Search for substring position index with optional range', () => {
        suite('Positive', () => {
            test('Finds occurrence position index with start and end boundaries', () => {
                const diags = lintText('idx = find("hello world world", "world", 5, 20); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = find(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = find("str", "sub", 0, 10, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string search in find', () => {
                const diags = lintText('idx = find("", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 16. split(String str, String separator) -> String[]
    // =========================================================================
    suite('split() - Split string into string array at separator', () => {
        suite('Positive', () => {
            test('Splits with separator string and empty separator (splits every char)', () => {
                const diags = lintText(`
                    arr1 = split("apple,banana,orange", ",");
                    arr2 = split("a.b.c", "");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('arr = split(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing separator) → flags bml-function-arg-count Error', () => {
                const diags = lintText('arr = split("a,b,c"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('arr = split("a,b", ",", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns array of size 1', () => {
                const diags = lintText('arr = split("", ","); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 17. startswith(String str, String substring) -> Boolean
    // =========================================================================
    suite('startswith() - Check if string starts with substring (Case-sensitive)', () => {
        suite('Positive', () => {
            test('Verifies string begins with substring', () => {
                const diags = lintText('b = startswith("I like this string", "I like"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (missing substring) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = startswith("hello"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = startswith("hello", "he", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty substring returns true in BML', () => {
                const diags = lintText('b = startswith("hello", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 18. string(val) -> String
    // =========================================================================
    suite('string() - Convert Float, Integer, or Boolean to String', () => {
        suite('Positive', () => {
            test('Converts Integer, Float, and Boolean to String', () => {
                const diags = lintText(`
                    s1 = string(100);
                    s2 = string(45.67);
                    s3 = string(true);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = string(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = string(100, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Arithmetic expressions inside string conversion', () => {
                const diags = lintText('s = string(10 + 20 * 3); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 19. substring(String str, Integer start [, Integer end]) -> String
    // =========================================================================
    suite('substring() - Return part of text from larger text', () => {
        suite('Positive', () => {
            test('2 and 3 arguments with start and end indices', () => {
                const diags = lintText(`
                    subStr = substring("Hello World", 0, 5);
                    test_1 = find(subStr, "Hello");
                    negIndResults = substring("abcdef", -4, -1);
                    longStartInd = substring("short", 100);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = substring(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing start) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = substring("text"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = substring("text", 0, 2, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string parsing and start greater than length', () => {
                const diags = lintText('s = substring("", 0, 0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 20. trim(String str) -> String
    // =========================================================================
    suite('trim() - Remove whitespace from both edges of strings', () => {
        suite('Positive', () => {
            test('Trims white space from both edges', () => {
                const diags = lintText('t = trim("   padded text   "); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('t = trim(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('t = trim("text", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns empty string in BML', () => {
                const diags = lintText('t = trim(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 21. upper(String str) -> String
    // =========================================================================
    suite('upper() - Convert all characters in text to uppercase', () => {
        suite('Positive', () => {
            test('Converts lowercase text to uppercase', () => {
                const diags = lintText('up = upper("oracle cpq"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('up = upper(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('up = upper("abc", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns empty string in BML', () => {
                const diags = lintText('up = upper(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
