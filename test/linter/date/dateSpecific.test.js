const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Date Specific & Edge Tests', () => {
    suite('getdate() & datetostr() parameter validation', () => {
        test('getdate() - 0 args → no error', () => {
            const diags = lintText('dt = getdate(); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('datetostr(dt) - 1 arg → no error', () => {
            const diags = lintText('dt = getdate(); s = datetostr(dt); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('datetostr(dt, "yyyy-MM-dd") - 2 args → no error', () => {
            const diags = lintText('dt = getdate(); s = datetostr(dt, "yyyy-MM-dd"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('datetostr(dt, "yyyy-MM-dd", "UTC") - 3 args → no error', () => {
            const diags = lintText('dt = getdate(); s = datetostr(dt, "yyyy-MM-dd", "UTC"); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('datetostr() - 0 args → flags bml-function-arg-count', () => {
            const diags = lintText('s = datetostr(); return "";');
            const err = diags.find(d => d.code === 'bml-function-arg-count');
            assert.ok(err);
            assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
        });

        test('datetostr(dt, "fmt", "tz", "excess") - 4 args → flags bml-function-arg-count', () => {
            const diags = lintText('dt = getdate(); s = datetostr(dt, "fmt", "tz", "excess"); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });
    });

    suite('comparedates() & getdiffindays()', () => {
        test('comparedates(dt1, dt2) - 2 args → no error', () => {
            const diags = lintText('dt1 = getdate(); dt2 = getdate(); res = comparedates(dt1, dt2); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('getdiffindays(dt1, dt2) - 2 args → no error', () => {
            const diags = lintText('dt1 = getdate(); dt2 = getdate(); diff = getdiffindays(dt1, dt2); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('comparedates(dt1) - 1 arg → flags bml-function-arg-count', () => {
            const diags = lintText('dt1 = getdate(); res = comparedates(dt1); return "";');
            assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
        });
    });

    suite('Date offset arithmetic functions (adddays, addmonths, minusdays)', () => {
        test('adddays(dt, 5) - positive offset → no error', () => {
            const diags = lintText('dt = getdate(); res = adddays(dt, 5); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('adddays(dt, -10) - negative offset → no error', () => {
            const diags = lintText('dt = getdate(); res = adddays(dt, -10); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('addmonths(dt, 1) & minusdays(dt, 3) - valid 2 args', () => {
            const diags = lintText('dt = getdate(); m = addmonths(dt, 1); d = minusdays(dt, 3); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });

    suite('Deprecated date functions (strtodate)', () => {
        test('strtodate() flags deprecation warning recommending strtojavadate()', () => {
            const diags = lintText('dt = strtodate("2026-01-01", "yyyy-MM-dd"); return "";');
            const warn = diags.find(d => d.code === 'bml-strtodate-fix');
            assert.ok(warn, 'Should flag strtodate as deprecated');
        });
    });

    suite('isleap() & isweekend() helper functions', () => {
        test('isleap(2024) - integer year → no error', () => {
            const diags = lintText('res = isleap(2024); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });

        test('isweekend(dt) - Date argument → no error', () => {
            const diags = lintText('dt = getdate(); res = isweekend(dt); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });
});
