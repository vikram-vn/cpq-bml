const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - URL Access Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // ==========================================
    // 1. urldata(url, method [, headers [, data [, timeout [, returnErrorResponse [, enableLoopback]]]]])
    // ==========================================
    suite('urldata() - Universal HTTP REST Access', () => {
        suite('Positive', () => {
            test('2 arguments: urldata(url, method)', () => {
                const diags = lintText('res = urldata("https://example.com/api", "GET"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: urldata(url, method, headers)', () => {
                const diags = lintText(`
                    h = dict("string");
                    put(h, "Authorization", "Bearer token");
                    res = urldata("https://example.com/api", "POST", h);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('4 arguments: urldata(url, method, headers, payload)', () => {
                const diags = lintText(`
                    h = dict("string");
                    res = urldata("https://example.com/api", "POST", h, "{\\"k\\":\\"v\\"}");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('5..7 arguments: with timeout, returnErrorResponse, enableLoopback', () => {
                const diags = lintText(`
                    h = dict("string");
                    res5 = urldata("https://example.com", "GET", h, "", 5000);
                    res6 = urldata("https://example.com", "GET", h, "", 5000, true);
                    res7 = urldata("https://example.com", "GET", h, "", 5000, true, false);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldata(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing method) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldata("https://example.com"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('8 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText(`
                    h = dict("string");
                    res = urldata("https://example.com", "GET", h, "", 5000, true, false, "excess");
                    return "";
                `);
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('res = urldata("https://example.com", "GET", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });
    });

    // ==========================================
    // 2. urldatabyget(), urldatabypost(), urlmultipartbypost()
    // ==========================================
    suite('urldatabyget(), urldatabypost(), urlmultipartbypost()', () => {
        suite('Positive', () => {
            test('urldatabyget(url, params, defaultVal) - 3 args', () => {
                const diags = lintText('res = urldatabyget("https://example.com", "q=test", "default"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('urldatabypost(url, params, defaultVal) - 3 args', () => {
                const diags = lintText('res = urldatabypost("https://example.com", "q=test", "default"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('urlmultipartbypost(url, dictData, defaultVal) - 3 args', () => {
                const diags = lintText(`
                    d = dict("string");
                    put(d, "part", "data");
                    res = urlmultipartbypost("https://example.com", d, "default");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('urldatabypostasync(url, params, defaultVal, cbAction) - 4 args', () => {
                const diags = lintText('id = urldatabypostasync("https://example.com", "q=test", "default", "onComplete"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('urldatabyget with 2 args (missing defaultVal) → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabyget("https://example.com", "q=test"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('urldatabypostasync with 2 args → flags bml-function-arg-count Error', () => {
                const diags = lintText('res = urldatabypostasync("https://example.com", "q=test"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
