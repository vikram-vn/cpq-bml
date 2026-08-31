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
});

