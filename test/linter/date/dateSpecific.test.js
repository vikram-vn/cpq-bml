const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - Date Exhaustive 3-Tier Suite (Positive, Negative, Destructive)', () => {
    // =========================================================================
    // 1. adddays(Date date, Integer num_of_days) -> Date
    // =========================================================================
    suite('adddays() - Add days to date', () => {
        suite('Positive', () => {
            test('Adds positive and negative days offset to date', () => {
                const diags = lintText(`
                    dt = getdate();
                    future = adddays(dt, 60);
                    past = adddays(dt, -15);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = adddays(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing days) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = adddays(getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = adddays(getdate(), 10, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Large boundary integer offsets in adddays', () => {
                const diags = lintText('dt = adddays(getdate(), 1000000); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 2. addmonths(Date date, Integer num_of_months) -> Date
    // =========================================================================
    suite('addmonths() - Add or subtract months with month-end and leap year handling', () => {
        suite('Positive', () => {
            test('Adds and subtracts months with leap year rollover handling', () => {
                const diags = lintText(`
                    dt = getdate();
                    renewalDate = addmonths(dt, 12);
                    priorDate = addmonths(dt, -6);
                    sameDate = addmonths(dt, 0);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = addmonths(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing months) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = addmonths(getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = addmonths(getdate(), 3, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative month rollover on month-end', () => {
                const diags = lintText('dt = strtojavadate("01/31/2024", "MM/dd/yyyy"); res = addmonths(dt, 1); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 3. comparedates(Date date1, Date date2) -> Integer
    // =========================================================================
    suite('comparedates() - Compare two dates considering date and time', () => {
        suite('Positive', () => {
            test('Compares two dates returning 0, -1, or 1', () => {
                const diags = lintText(`
                    d1 = getdate();
                    d2 = adddays(d1, 5);
                    cmpResult = comparedates(d1, d2);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('cmp = comparedates(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing second date) → flags bml-function-arg-count Error', () => {
                const diags = lintText('cmp = comparedates(getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('cmp = comparedates(getdate(), getdate(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Identical dates compare to 0', () => {
                const diags = lintText('d = getdate(); if (comparedates(d, d) == 0) { return "equal"; } return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 4. datetostr(Date date [, String dateFormat [, String timeZone]]) -> String
    // =========================================================================
    suite('datetostr() - Convert Date to formatted String with TimeZone support', () => {
        suite('Positive', () => {
            test('1 argument: default format (MM/dd/yyyy HH:mm:ss)', () => {
                const diags = lintText('dt = getdate(); s = datetostr(dt); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: compact, full-text, slash, and hyphen date format patterns', () => {
                const diags = lintText(`
                    dt = getdate();
                    s1 = datetostr(dt, "dMMMyyyy");
                    s2 = datetostr(dt, "EEEE, d MMMM yyyy");
                    s3 = datetostr(dt, "dd/MM/yyyy HH:mm:ss");
                    s4 = datetostr(dt, "yyyy-MM-dd HH:mm:ss Z");
                    s5 = datetostr(dt, "dd.MM.yyyy");
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: with official TimeZone IDs and GMT offsets', () => {
                const diags = lintText(`
                    dt = getdate();
                    sChicago = datetostr(dt, "yyyy-MM-dd HH:mm:ss", "America/Chicago");
                    sParis = datetostr(dt, "yyyy-MM-dd HH:mm:ss", "Europe/Paris");
                    sKolkata = datetostr(dt, "yyyy-MM-dd HH:mm:ss", "Asia/Calcutta");
                    sGmtOffset = datetostr(dt, "yyyy-MM-dd hh:mm:ss a", "GMT+4");
                    return "";
                `);
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

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
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
    // 5. getcurrenttimeinmillis() -> Integer
    // =========================================================================
    suite('getcurrenttimeinmillis() - Current epoch time in milliseconds', () => {
        suite('Positive', () => {
            test('0 arguments returns epoch milliseconds', () => {
                const diags = lintText('ms = getcurrenttimeinmillis(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('ms = getcurrenttimeinmillis("excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Calculates elapsed time difference', () => {
                const diags = lintText('t1 = getcurrenttimeinmillis(); t2 = getcurrenttimeinmillis(); elapsed = t2 - t1; return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 6. getdate([Boolean includeTime]) -> Date
    // =========================================================================
    suite('getdate() - Current date and datetime', () => {
        suite('Positive', () => {
            test('0 arguments (with time default) and 1 argument (includeTime boolean)', () => {
                const diags = lintText(`
                    d1 = getdate();
                    d2 = getdate(true);
                    d3 = getdate(false);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = getdate(true, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Keyword collision in getdate parameter', () => {
                const diags = lintText('dt = getdate(return); return "";');
                assert.ok(diags.length > 0);
            });
        });
    });

    // =========================================================================
    // 7. getdiffindays(Date date1, Date date2) -> Float
    // =========================================================================
    suite('getdiffindays() - Days difference between two dates', () => {
        suite('Positive', () => {
            test('Calculates float days difference between two dates', () => {
                const diags = lintText(`
                    d1 = strtojavadate("01/01/2024", "MM/dd/yyyy");
                    d2 = strtojavadate("01/15/2024", "MM/dd/yyyy");
                    diff = getdiffindays(d1, d2);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('diff = getdiffindays(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing date2) → flags bml-function-arg-count Error', () => {
                const diags = lintText('diff = getdiffindays(getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('diff = getdiffindays(getdate(), getdate(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Diff of same date returns 0.0', () => {
                const diags = lintText('d = getdate(); diff = getdiffindays(d, d); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 8. getstrdate() -> String
    // =========================================================================
    suite('getstrdate() - String representation of current date in server timezone', () => {
        suite('Positive', () => {
            test('0 arguments returns date string', () => {
                const diags = lintText('sd = getstrdate(); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('1 argument (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('sd = getstrdate("excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Direct return in commerce script', () => {
                const diags = lintText('return getstrdate();');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 9. isleap(Integer year_num) -> Boolean
    // =========================================================================
    suite('isleap() - Determine whether year is a leap year', () => {
        suite('Positive', () => {
            test('Validates leap year (2008 -> true, 2024 -> true)', () => {
                const diags = lintText('b = isleap(2008); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isleap(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('b = isleap(2024, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative year parameter in isleap', () => {
                const diags = lintText('b = isleap(-400); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 10. isweekend(Date date) -> Boolean
    // =========================================================================
    suite('isweekend() - Determine whether date falls on Saturday or Sunday', () => {
        suite('Positive', () => {
            test('Checks if date falls on weekend', () => {
                const diags = lintText('w = isweekend(getdate()); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('w = isweekend(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('2 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('w = isweekend(getdate(), "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Weekend check on future added dates', () => {
                const diags = lintText('dt = adddays(getdate(), 10); if (isweekend(dt)) { return "weekend"; } return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 11. minusdays(Date date, Integer num_of_days) -> Date
    // =========================================================================
    suite('minusdays() - Subtract days from base date', () => {
        suite('Positive', () => {
            test('Subtracts positive days from date', () => {
                const diags = lintText(`
                    dt = getdate();
                    pastDate = minusdays(dt, 30);
                    return "";
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = minusdays(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing days) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = minusdays(getdate()); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('3 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = minusdays(getdate(), 10, "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Negative days parameter in minusdays (acts as addition)', () => {
                const diags = lintText('dt = minusdays(getdate(), -30); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });

    // =========================================================================
    // 12. strtodate(String str, String format [, String timeZone]) -> Date [DEPRECATED]
    // =========================================================================
    suite('strtodate() - Deprecated string to date conversion', () => {
        suite('Positive', () => {
            test('Emits deprecation warning code bml-strtodate-fix', () => {
                const diags = lintText('dt = strtodate("2026-01-01", "yyyy-MM-dd"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-strtodate-fix'));
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtodate(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty date string in deprecated strtodate', () => {
                const diags = lintText('dt = strtodate("", ""); return "";');
                assert.ok(diags.find(d => d.code === 'bml-strtodate-fix'));
            });
        });
    });

    // =========================================================================
    // 13. strtojavadate(String str, String format [, String timeZone]) -> Date
    // =========================================================================
    suite('strtojavadate() - Converts String to Date replicating Java behavior', () => {
        suite('Positive', () => {
            test('2 arguments: US format (MM/dd/yyyy) -> February 12th, 2010', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010", "MM/dd/yyyy"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('2 arguments: European format (dd/MM/yyyy) -> 01 February 2010', () => {
                const diags = lintText('dt = strtojavadate("01/02/2010", "dd/MM/yyyy"); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });

            test('3 arguments: with TimeZone ID (Europe/Paris) rendered into Chicago timezone', () => {
                const diags = lintText(`
                    parisDate = strtojavadate("01/02/2010 16:30:40", "dd/MM/yyyy HH:mm:ss", "Europe/Paris");
                    chicagoStr = datetostr(parisDate, "dd/MM/yyyy HH:mm:ss", "America/Chicago");
                    return chicagoStr;
                `);
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });

        suite('Negative', () => {
            test('0 arguments → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtojavadate(); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('1 argument (missing format) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });

            test('4 arguments (excess) → flags bml-function-arg-count Error', () => {
                const diags = lintText('dt = strtojavadate("02/12/2010", "MM/dd/yyyy", "UTC", "excess"); return "";');
                assert.ok(diags.find(d => d.code === 'bml-function-arg-count'));
            });
        });

        suite('Destructive', () => {
            test('Empty date string and invalid format pattern', () => {
                const diags = lintText('dt = strtojavadate("", ""); return "";');
                assert.strictEqual(diags.find(d => d.code === 'bml-function-arg-count'), undefined);
            });
        });
    });
});
