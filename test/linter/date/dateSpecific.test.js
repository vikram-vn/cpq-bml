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

        test('getcurrenttimeinmillis() & getstrdate() - 0 args → no error', () => {
            const diags = lintText('t = getcurrenttimeinmillis(); s = getstrdate(); return "";');
            assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
        });
    });

    suite('strtojavadate() - Full Positive, Negative, and Destructive Tests', () => {
        suite('1. Positive Test Cases (Standard & Overload Permutations)', () => {
            test('US Date Format: MM/dd/yyyy', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010", "MM/dd/yyyy"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('European Date Format: dd/MM/yyyy', () => {
                const diags = lintText('dt = strtojavadate("01/02/2010", "dd/MM/yyyy"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('European Date with Paris time zone: dd/MM/yyyy HH:mm:ss, Europe/Paris', () => {
                const diags = lintText(`
                    parisdate = strtojavadate("01/02/2010 16:30:40", "dd/MM/yyyy HH:mm:ss", "Europe/Paris");
                    res = datetostr(parisdate, "dd/MM/yyyy HH:mm:ss", "America/Chicago");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('12-hour AM/PM format: MM/dd/yyyy hh:mm:ss a', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010 04:30:00 PM", "MM/dd/yyyy hh:mm:ss a"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Variable inputs & expressions', () => {
                const diags = lintText(`
                    dateStr = "2026-08-24";
                    fmt = "yyyy-MM-dd";
                    tz = "UTC";
                    dt = strtojavadate(dateStr, fmt, tz);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('2. Negative Test Cases (Arg Counts, Types, Trailing Commas)', () => {
            test('0 arguments → Error', () => {
                const diags = lintText('dt = strtojavadate(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('1 argument (missing format) → Error', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010"); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('4 arguments (excess parameter) → Error', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010", "MM/dd/yyyy", "UTC", "excess"); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
            });

            test('Trailing comma → bml-trailing-comma-error', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010", "MM/dd/yyyy", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });

            test('Type mismatch (Integer passed as first arg) → Warning', () => {
                const diags = lintText('dt = strtojavadate(12345, "MM/dd/yyyy"); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-type');
                assert.ok(err);
            });
        });

        suite('3. Destructive / Robustness Edge Cases', () => {
            test('Empty string values do not crash linter', () => {
                const diags = lintText('dt = strtojavadate("", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('Keyword collision as parameter identifiers handled gracefully', () => {
                const diags = lintText('dt = strtojavadate(return, break); return "";');
                assert.ok(diags.length > 0);
            });

            test('Semicolon separated parameters handled without crash', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010"; "MM/dd/yyyy"); return "";');
                assert.ok(diags.length > 0);
            });

            test('Assignment to function invocation handled gracefully', () => {
                const diags = lintText('strtojavadate("02/12/2010", "MM/dd/yyyy") = "val"; return "";');
                assert.ok(diags.length > 0);
            });
        });
    });
});
