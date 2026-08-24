const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - URL Access Specific & Edge Tests', () => {
    suite('urldata() parameter validation & overloads', () => {
        test('urldata(url, "GET") - valid 2 args', () => {
            const diags = lintText('res = urldata("https://example.com", "GET"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('urldata(url, "POST", headers, payload) - valid 4 args', () => {
            const diags = lintText(`
                h = dict("string");
                put(h, "Content-Type", "application/json");
                res = urldata("https://example.com/api", "POST", h, "{\\"k\\":\\"v\\"}");
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('urldata() with 0 args flags bml-function-arg-count', () => {
            const diags = lintText('res = urldata(); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });
    });

    suite('urldatabypost() & urldatabyget() helper methods', () => {
        test('urldatabyget(url, params, headers) - valid 3 args', () => {
            const diags = lintText(`
                p = dict("string");
                h = dict("string");
                res = urldatabyget("https://example.com", p, h);
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('urldatabypost(url, payload, headers) - valid 3 args', () => {
            const diags = lintText(`
                h = dict("string");
                res = urldatabypost("https://example.com", "body_data", h);
                return "";
            `);
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });
});
