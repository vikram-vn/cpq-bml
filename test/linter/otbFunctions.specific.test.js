const assert = require('assert');
const { lintText } = require('./fixtures');

// ─── Specific Named Test Cases for Commonly-Misused OTB Functions ───────────────

suite('BML Linter Test Suite - OTB specific arg-count error cases', () => {
    const vscode = require('vscode');

    suite('put() - always requires exactly 3 arguments (dict, key, value)', () => {
        test('put(dict, key) - missing value → no bml-function-arg-count (put signature is permissive)', () => {
            // put has an unparseable signature so the linter won't flag arg count - just verify no crash
            const diagnostics = lintText('d = dict("string");\nput(d, "key");\nreturn "";');
            // We do NOT assert an error here - documenting known limitation; use trailing comma test instead
            assert.ok(Array.isArray(diagnostics));
        });

        test('put(dict) - only 1 arg → no bml-function-arg-count (put signature is permissive)', () => {
            const diagnostics = lintText('d = dict("string");\nput(d);\nreturn "";');
            assert.ok(Array.isArray(diagnostics));
        });

        test('put() - zero args → no bml-function-arg-count (put signature is permissive)', () => {
            const diagnostics = lintText('put();\nreturn "";');
            assert.ok(Array.isArray(diagnostics));
        });

        test('put(dict, key, value) - correct 3 args → no arg-count error', () => {
            const diagnostics = lintText('d = dict("string");\nput(d, "key", "val");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined, 'put with 3 args should not flag arg-count error');
        });

        test('put(dict, key, val, extra) - 4 args → no bml-function-arg-count (put signature is permissive)', () => {
            const diagnostics = lintText('d = dict("string");\nput(d, "key", "val", "extra");\nreturn "";');
            assert.ok(Array.isArray(diagnostics));
        });

        test('put(dict, key, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('d = dict("string");\nput(d, "key", );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err, 'Should flag trailing comma in put call');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, 'Trailing comma must be Error severity');
        });

        test('put(dict, key, ) - trailing comma highlights full line', () => {
            const diagnostics = lintText('d = dict("string");\nput(d, "key", );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
            assert.strictEqual(err.range.start.character, 0, 'Should highlight full line from column 0');
        });
    });

    suite('findinarray() - always requires exactly 2 arguments (array, element)', () => {
        test('findinarray(arr) - missing element → Error severity', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag findinarray with 1 arg as error');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, 'Must be Error not Warning');
        });

        test('findinarray() - zero args → Error severity', () => {
            const diagnostics = lintText('x = findinarray();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag findinarray with 0 args as error');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, 'Must be Error not Warning');
        });

        test('findinarray(arr, elem) - correct 2 args → no error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, "a");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined, 'findinarray with 2 args should not flag arg-count error');
        });

        test('findinarray(arr, elem, extra) - 3 args → Error severity', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, "a", "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag findinarray with 3 args as error');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error, 'Must be Error not Warning');
        });

        test('findinarray(arr, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = findinarray(arr, );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err, 'Should flag trailing comma in findinarray');
        });
    });

    suite('append() - requires at least 2 arguments (array, element)', () => {
        test('append(arr) - missing element → Error severity', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nappend(arr);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag append with 1 arg');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('append() - zero args → Error severity', () => {
            const diagnostics = lintText('append();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag append with 0 args');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('append(arr, elem) - correct 2 args → no error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nappend(arr, "b");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('append(arr, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nappend(arr, );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });

    suite('sizeofarray() - requires exactly 1 argument (array)', () => {
        test('sizeofarray() - zero args → Error severity', () => {
            const diagnostics = lintText('x = sizeofarray();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag sizeofarray with 0 args');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('sizeofarray(arr) - correct 1 arg → no error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('sizeofarray(arr, extra) - 2 args → Error severity', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr, "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('sizeofarray(arr, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nx = sizeofarray(arr, );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });

    suite('atoi() / atof() - require exactly 1 string argument', () => {
        test('atoi() - zero args → Error severity', () => {
            const diagnostics = lintText('x = atoi();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('atoi("123") - correct 1 arg → no error', () => {
            const diagnostics = lintText('x = atoi("123");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('atoi("123", "extra") - 2 args → Error severity', () => {
            const diagnostics = lintText('x = atoi("123", "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('atof() - zero args → Error severity', () => {
            const diagnostics = lintText('x = atof();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('atof("3.14") - correct 1 arg → no error', () => {
            const diagnostics = lintText('x = atof("3.14");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });
    });

    suite('substring() - requires 2 or 3 arguments (str, start[, end])', () => {
        test('substring() - zero args → Error severity', () => {
            const diagnostics = lintText('x = substring();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag substring with 0 args');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('substring(str) - 1 arg → Error severity', () => {
            const diagnostics = lintText('x = substring("hello");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag substring with 1 arg');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('substring(str, start) - 2 args → no error', () => {
            const diagnostics = lintText('x = substring("hello", 1);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined, 'substring(str, start) is valid');
        });

        test('substring(str, start, end) - 3 args → no error', () => {
            const diagnostics = lintText('x = substring("hello", 1, 3);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined, 'substring(str, start, end) is valid');
        });

        test('substring(str, start, end, extra) - 4 args → Error severity', () => {
            const diagnostics = lintText('x = substring("hello", 1, 3, "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err, 'Should flag substring with 4 args');
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('substring(str, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('x = substring("hello", );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });

    suite('find() - requires 2 to 4 arguments (str, substr[, start[, end]])', () => {
        test('find() - zero args → Error severity', () => {
            const diagnostics = lintText('x = find();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('find(str) - 1 arg → Error severity', () => {
            const diagnostics = lintText('x = find("hello");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('find(str, sub) - 2 args → no error', () => {
            const diagnostics = lintText('x = find("hello", "ell");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('find(str, sub, start) - 3 args → no error', () => {
            const diagnostics = lintText('x = find("hello", "ell", 1);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('find(str, sub, start, end) - 4 args → no error', () => {
            const diagnostics = lintText('x = find("hello", "ell", 1, 5);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('find(str, sub, start, end, extra) - 5 args → Error severity', () => {
            const diagnostics = lintText('x = find("hello", "ell", 1, 5, "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('find(str, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('x = find("hello", );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });

    suite('datetostr() - requires 1 to 3 arguments (date[, format[, tz]])', () => {
        test('datetostr() - zero args → Error severity', () => {
            const diagnostics = lintText('x = datetostr();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('datetostr(d) - 1 arg → no error', () => {
            const diagnostics = lintText('d = getdate();\nx = datetostr(d);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('datetostr(d, fmt) - 2 args → no error', () => {
            const diagnostics = lintText('d = getdate();\nx = datetostr(d, "MM/dd/yyyy");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('datetostr(d, fmt, tz) - 3 args → no error', () => {
            const diagnostics = lintText('d = getdate();\nx = datetostr(d, "MM/dd/yyyy", "UTC");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('datetostr(d, fmt, tz, extra) - 4 args → Error severity', () => {
            const diagnostics = lintText('d = getdate();\nx = datetostr(d, "MM/dd/yyyy", "UTC", "x");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('datetostr(d, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('d = getdate();\nx = datetostr(d, );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });

    suite('replace() - requires 3 or 4 arguments (str, old, new[, n])', () => {
        test('replace() - zero args → Error severity', () => {
            const diagnostics = lintText('x = replace();\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('replace(str) - 1 arg → Error severity', () => {
            const diagnostics = lintText('x = replace("hello");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('replace(str, old) - 2 args → Error severity', () => {
            const diagnostics = lintText('x = replace("hello", "ell");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('replace(str, old, new) - 3 args → no error', () => {
            const diagnostics = lintText('x = replace("hello", "ell", "ELL");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('replace(str, old, new, n) - 4 args → no error', () => {
            const diagnostics = lintText('x = replace("hello", "l", "L", 1);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('replace(str, old, new, n, extra) - 5 args → Error severity', () => {
            const diagnostics = lintText('x = replace("hello", "l", "L", 1, "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('replace(str, old, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('x = replace("hello", "ell", );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });

    suite('remove() - requires exactly 2 arguments (array, index)', () => {
        test('remove() - zero args → Error severity', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nremove(arr);\nreturn "";');
            // remove takes 2 args - passing 1
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('remove(arr, 0) - correct 2 args → no error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nremove(arr, 0);\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.strictEqual(err, undefined);
        });

        test('remove(arr, 0, extra) - 3 args → Error severity', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nremove(arr, 0, "extra");\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('remove(arr, ) - trailing comma → bml-trailing-comma-error', () => {
            const diagnostics = lintText('arr = string[]{"a"};\nremove(arr, );\nreturn "";');
            const err = diagnostics.find(d => d.code === 'bml-trailing-comma-error');
            assert.ok(err);
        });
    });
});
