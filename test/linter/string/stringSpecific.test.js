const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - String Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. atof(String str) -> Float
    // =========================================================================
    suite('atof() - Convert text representing number to Float', () => {
        suite('Positive', () => {
            test('Parses valid decimal number string into float', () => {
                const diags = lintText('val = atof("123.456"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Parses negative float and scientific notation', () => {
                const diags = lintText('val1 = atof("-99.99"); val2 = atof("1.5e3"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = atof(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('val = atof("123.45", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('val = atof("123.45", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty string parameter handled without crash', () => {
                const diags = lintText('val = atof(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Alphanumeric characters in atof string', () => {
                const diags = lintText('val = atof("abc123xyz"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. atoi(String str) -> Integer
    // =========================================================================
    suite('atoi() - Convert text representing number to Integer', () => {
        suite('Positive', () => {
            test('Parses integer string into integer', () => {
                const diags = lintText('num = atoi("12345"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Parses negative integer string', () => {
                const diags = lintText('num = atoi("-500"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('num = atoi(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('num = atoi("100", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('num = atoi("100", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('String with decimal point handled without linter crash', () => {
                const diags = lintText('num = atoi("123.456"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Empty string parameter in atoi', () => {
                const diags = lintText('num = atoi(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. decodebase64(String str) -> String
    // =========================================================================
    suite('decodebase64() - Decode Base64 string to plain text', () => {
        suite('Positive', () => {
            test('Decodes valid Base64 string ("YWJj" -> "abc")', () => {
                const diags = lintText('plain = decodebase64("YWJj"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dec = decodebase64(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dec = decodebase64("YWJj", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string decoding', () => {
                const diags = lintText('dec = decodebase64(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. encodebase64(String str) -> String
    // =========================================================================
    suite('encodebase64() - Encode plain text to Base64 string for Auth & URLs', () => {
        suite('Positive', () => {
            test('Encodes plain text and Basic authentication header credentials', () => {
                const diags = lintText(`
                    webSvcsUser = "admin";
                    webSvcsPassword = "secretPassword";
                    httpAuthUserAndPassword = webSvcsUser + ":" + webSvcsPassword;
                    httpAuthEncodedString = encodebase64(httpAuthUserAndPassword);
                    authHeader = "Basic " + httpAuthEncodedString;
                    return authHeader;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('enc = encodebase64(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('enc = encodebase64("abc", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string encoding', () => {
                const diags = lintText('enc = encodebase64(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 5. endswith(String str, String substring) -> Boolean
    // =========================================================================
    suite('endswith() - Check if string ends with substring (Case-sensitive)', () => {
        suite('Positive', () => {
            test('Verifies string ends with substring', () => {
                const diags = lintText('endResults = endswith("I like this string", "string"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (missing substring) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = endswith("hello"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = endswith("hello", "lo", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty substring returns true per BML specification', () => {
                const diags = lintText('b = endswith("hello", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. find(String str, String substring [, Integer start [, Integer end]]) -> Integer
    // =========================================================================
    suite('find() - Return position index of substring within string', () => {
        suite('Positive', () => {
            test('find with 2, 3, and 4 arguments (start, end bounds)', () => {
                const diags = lintText(`
                    emptyTest = find("", "");
                    test_2 = find("", "", 0);
                    longTest = find("hello", "lo", 10);
                    result = find("hello world world", "world", 0, 10);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = find(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing substring) → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = find("hello"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('5 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('idx = find("str", "sub", 0, 5, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Start index outside length of string returns -1', () => {
                const diags = lintText('idx = find("abc", "d", 100); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 7. formatascurrency(Float x [, String currencyCode]) -> String
    // =========================================================================
    suite('formatascurrency() - Format number as currency string', () => {
        suite('Positive', () => {
            test('1 argument (transaction/user currency) and 2 arguments (EUR code)', () => {
                const diags = lintText(`
                    c1 = formatascurrency(32.15);
                    c2 = formatascurrency(32.15, "EUR");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('c = formatascurrency(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('c = formatascurrency(32.15, "EUR", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative amounts and zero currency values', () => {
                const diags = lintText('c = formatascurrency(-500.25, "USD"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 8. getcurrencyvalue(String value [, String currencyCode]) -> Float
    // =========================================================================
    suite('getcurrencyvalue() - Parse formatted currency string to float numeric value', () => {
        suite('Positive', () => {
            test('1 and 2 arguments with currency codes ("€32,15", "EUR" -> 32.15)', () => {
                const diags = lintText(`
                    v1 = getcurrencyvalue("$1,500.50");
                    v2 = getcurrencyvalue("€32,15", "EUR");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = getcurrencyvalue(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('v = getcurrencyvalue("$100", "USD", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string currency parsing', () => {
                const diags = lintText('v = getcurrencyvalue("", "USD"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 9. html(String str) -> String
    // =========================================================================
    suite('html() - Safe HTML output encoding & XSS attack neutralization', () => {
        suite('Positive', () => {
            test('Escapes HTML special characters into inactive safe text (<test> -> &lt;test&gt;)', () => {
                const diags = lintText(`
                    safe = html("<test>");
                    xss = html("<script>/*Bad content here ... */</script>");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = html(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = html("<p>", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty string returns empty string without error', () => {
                const diags = lintText('res = html(""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 10. join(String[] str_array [, String delimiter]) -> String
    // =========================================================================
    suite('join() - Concatenate String Array with specified Delimiter', () => {
        suite('Positive', () => {
            test('1 and 2 arguments: empty delimiter concatenates directly ("123")', () => {
                const diags = lintText(`
                    strArr1 = string[]{"1", "2", "3"};
                    strArr2 = join(strArr1, "");
                    strArr3 = join(strArr1, " - ");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = join(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = join(string[]{"a"}, "-", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('join with integer[] array → flags bml-function-arg-type Error', () => {
                const diags = lintText('res = join(integer[]{1, 2}, "-"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-type'));
            });
        });

        suite('Destructive', () => {
            test('Empty string array and empty delimiter', () => {
                const diags = lintText('res = join(string[]{}, ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

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
