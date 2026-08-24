const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - String Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // ==========================================
    // 1. substring(str, start [, length])
    // ==========================================
    suite('substring() - Extract substring', () => {
        suite('Positive', () => {
            test('2 arguments: substring(str, start)', () => {
                const diags = lintText('s = substring("Hello World", 6); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: substring(str, start, length)', () => {
                const diags = lintText('s = substring("Hello World", 0, 5); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Variable and expression arguments', () => {
                const diags = lintText(`
                    text = "SampleText";
                    idx = 2;
                    s = substring(text, idx, idx + 4);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = substring(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('1 argument → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = substring("text"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = substring("text", 0, 2, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('s = substring("text", 0, ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty string handled gracefully', () => {
                const diags = lintText('s = substring("", 0, 0); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Illegal assignment to substring() invocation', () => {
                const diags = lintText('substring("text", 0, 2) = "val"; return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // ==========================================
    // 2. find(), rfind(), replace(), split(), join()
    // ==========================================
    suite('find(), rfind(), replace(), split(), join()', () => {
        suite('Positive', () => {
            test('find and rfind search index position', () => {
                const diags = lintText(`
                    idx1 = find("hello world", "world");
                    idx2 = rfind("hello world", "l");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('replace occurrences in string', () => {
                const diags = lintText('res = replace("aaa", "a", "b"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('split string into array and join array into string', () => {
                const diags = lintText(`
                    arr = split("apple,banana,orange", ",");
                    str = join(arr, " - ");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('replace with 2 arguments (missing new string) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = replace("text", "old"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('split with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('arr = split(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // ==========================================
    // 3. Transformations, Utilities & Conversions
    // ==========================================
    suite('Transformations, Utilities & Conversions', () => {
        suite('Positive', () => {
            test('len, lower, upper, trim, startswith, endswith', () => {
                const diags = lintText(`
                    l = len("sample");
                    low = lower("ABC");
                    up = upper("abc");
                    t = trim(" text ");
                    sw = startswith("hello", "he");
                    ew = endswith("world", "ld");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('atoi, atof, string, isnumber, html', () => {
                const diags = lintText(`
                    i = atoi("123");
                    f = atof("45.67");
                    s = string(100);
                    numCheck = isnumber("123");
                    escaped = html("<script>alert(1)</script>");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('encodebase64, decodebase64, makeurlparam, formatascurrency, getcurrencyvalue', () => {
                const diags = lintText(`
                    enc = encodebase64("secret");
                    dec = decodebase64(enc);
                    cur = formatascurrency(1500.50, "USD");
                    val = getcurrencyvalue("$1,500.50");
                    d = dict("string");
                    put(d, "param", "val");
                    q = makeurlparam(d);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('len with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('l = len(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('atoi with 2 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('i = atoi("123", "extra"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
