const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Date Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. getdate([Boolean includeTime])
    // =========================================================================
    suite('getdate() - Returns current system date / datetime', () => {
        suite('Positive', () => {
            test('0 arguments: returns current date', () => {
                const diags = lintText('dt = getdate(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('1 argument: getdate(true) with time included', () => {
                const diags = lintText('dt = getdate(true); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('1 argument: getdate(false) without time', () => {
                const diags = lintText('dt = getdate(false); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('2 arguments (excess parameter) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = getdate(true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('dt = getdate(true, ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Keyword collision as parameter identifier', () => {
                const diags = lintText('dt = getdate(return); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 2. datetostr(Date date [, String format [, String timezone]])
    // =========================================================================
    suite('datetostr() - Formats Date into String representation', () => {
        suite('Positive', () => {
            test('1 argument: default format string', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: custom date format (yyyy-MM-dd HH:mm:ss)', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt, "yyyy-MM-dd HH:mm:ss"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: custom format with timezone (America/Chicago)', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt, "MM/dd/yyyy", "America/Chicago"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('s = datetostr(); return "";');
                const err = diags.find(d => d.code === 'bml-function-arg-count');
                assert.ok(err);
                assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Error);
            });

            test('4 arguments (excess parameter) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt, "fmt", "tz", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('Trailing comma → flags bml-trailing-comma-error', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt, "fmt", ); return "";');
                assert.ok(diags.find(d => d.code === 'bml-trailing-comma-error'));
            });
        });

        suite('Destructive', () => {
            test('Empty format and timezone strings', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt, "", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. strtojavadate(String str, String format [, String timezone])
    // =========================================================================
    suite('strtojavadate() - Converts String to Java Date object', () => {
        suite('Positive', () => {
            test('2 arguments: US format (MM/dd/yyyy)', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010", "MM/dd/yyyy"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: European format (dd/MM/yyyy)', () => {
                const diags = lintText('dt = strtojavadate("01/02/2010", "dd/MM/yyyy"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: with timezone (Europe/Paris)', () => {
                const diags = lintText('dt = strtojavadate("01/02/2010 16:30:40", "dd/MM/yyyy HH:mm:ss", "Europe/Paris"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtojavadate(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing format) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtojavadate("2026-01-01"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess parameter) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtojavadate("2026-01-01", "yyyy-MM-dd", "UTC", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // =========================================================================
    // 4. Date Arithmetic & Comparison (adddays, addmonths, minusdays, comparedates, getdiffindays)
    // =========================================================================
    suite('Date Arithmetic & Comparisons (adddays, addmonths, minusdays, comparedates, getdiffindays)', () => {
        suite('Positive', () => {
            test('adddays with positive and negative integer offsets', () => {
                const diags = lintText(`
                    dt = getdate();
                    future = adddays(dt, 30);
                    past = adddays(dt, -15);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('addmonths and minusdays operations', () => {
                const diags = lintText(`
                    dt = getdate();
                    m = addmonths(dt, 6);
                    d = minusdays(dt, 10);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('comparedates and getdiffindays comparisons', () => {
                const diags = lintText(`
                    d1 = getdate();
                    d2 = adddays(d1, 5);
                    cmp = comparedates(d1, d2);
                    diff = getdiffindays(d1, d2);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('adddays with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = adddays(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('comparedates with 1 argument → flags bml-function-arg-count Error', () => {
                const diags = lintText('d = comparedates(getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });

    // =========================================================================
    // 5. Calendar & Timestamp Utilities (isleap, isweekend, getcurrenttimeinmillis, getstrdate, strtodate)
    // =========================================================================
    suite('Calendar & Timestamp Utilities (isleap, isweekend, getcurrenttimeinmillis, getstrdate, strtodate)', () => {
        suite('Positive', () => {
            test('isleap(year) with integer literal and expression', () => {
                const diags = lintText('leap = isleap(2024); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('isweekend(date) returns boolean', () => {
                const diags = lintText('w = isweekend(getdate()); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('getcurrenttimeinmillis() and getstrdate() with 0 arguments', () => {
                const diags = lintText('ms = getcurrenttimeinmillis(); sd = getstrdate(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative & Deprecation', () => {
            test('strtodate() flags deprecation fix warning bml-strtodate-fix', () => {
                const diags = lintText('dt = strtodate("2026-01-01", "yyyy-MM-dd"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-strtodate-fix'));
            });

            test('isleap with 0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('leap = isleap(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });
    });
});
