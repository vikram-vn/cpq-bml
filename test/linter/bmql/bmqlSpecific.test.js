const assert = require("assert");
const { lintText } = require("../fixtures");

suite("BML Linter Test Suite - BMQL specific tests", () => {
    suite('Dynamic query concatenation (bml-bmql-injection-risk)', () => {
        test('Flags string concatenation inside bmql()', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id FROM " + tableName);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-injection-risk');
            assert.ok(diag, 'Should flag + concatenation inside a BMQL query');
        });

        test('Does not flag a query using $variable substitution', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id FROM $table WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-injection-risk');
            assert.strictEqual(diag, undefined, '$variable substitution is the documented-safe idiom');
        });
    });

    suite('Full substitution - bare variable as the whole query (bml-bmql-full-substitution)', () => {
        test('Flags a bare variable passed directly as the query string', () => {
            const diagnostics = lintText(`
                x = bmql(queryStringVar);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-full-substitution');
            assert.ok(diag, 'DynamicBMQLVariables.md calls this out as "Incorrect: Full Substitution"');
        });

        test('Does not flag a string literal query', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id FROM my_table WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-full-substitution');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag string concatenation (that is the injection-risk case, not full substitution)', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id FROM " + tableName);
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-full-substitution');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag a bmql() call with no arguments', () => {
            const diagnostics = lintText(`
                x = bmql();
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-full-substitution');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('JOIN against a system-defined table (bml-bmql-join-system-table)', () => {
        test('Flags JOIN against a table prefixed with an underscore', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT a.id FROM my_table a JOIN _parts p ON a.id = p.id WHERE a.id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-join-system-table');
            assert.ok(diag, 'BMQL.md: JOIN is only supported for customer-defined tables, not system tables like _parts');
        });

        test('Does not flag JOIN against a customer-defined table', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT a.id FROM my_table a JOIN other_table b ON a.id = b.id WHERE a.id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-join-system-table');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag a query with no JOIN at all', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id FROM _parts WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-join-system-table');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('INSERT/UPDATE/MODIFY result never checked for records_error (bml-bmql-mutation-error-unchecked)', () => {
        test('Flags INSERT result never checked for records_error', () => {
            const diagnostics = lintText(`
                results = bmql("insert into table1 (column1) values ('value1')");
                return results;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-mutation-error-unchecked');
            assert.ok(diag, 'BMQL.md: a records_error entry can be added even when no exception is thrown');
        });

        test('Flags UPDATE result never checked for records_error', () => {
            const diagnostics = lintText(`
                results = bmql("update table1 set col1 = 'x' where id = $id");
                return results;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-mutation-error-unchecked');
            assert.ok(diag);
        });

        test('Flags MODIFY result never checked for records_error', () => {
            const diagnostics = lintText(`
                results = bmql("modify table1 set col1 = 'x' where id = $id");
                return results;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-mutation-error-unchecked');
            assert.ok(diag);
        });

        test('Does not flag when records_error is checked via get()', () => {
            const diagnostics = lintText(`
                results = bmql("insert into table1 (column1) values ('value1')");
                errorMsg = get(results, "records_error");
                return results;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-mutation-error-unchecked');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag DELETE - records_error is not documented for DELETE', () => {
            const diagnostics = lintText(`
                results = bmql("delete from table1 where id = $id");
                return results;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-mutation-error-unchecked');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag a plain SELECT', () => {
            const diagnostics = lintText(`
                results = bmql("select id from table1 where id = $id");
                return results;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-mutation-error-unchecked');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('SELECT * (bml-bmql-select-star)', () => {
        test('Flags SELECT * in BMQL', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT * FROM my_table WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-select-star');
            assert.ok(diag, 'Should flag SELECT *');
        });

        test('Does not flag an explicit column list', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id, name FROM my_table WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-select-star');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('UPDATE/MODIFY without WHERE (bml-bmql-unbounded-mutation)', () => {
        test('Flags UPDATE with no WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("UPDATE my_table SET status = 'done'");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-mutation');
            assert.ok(diag, 'Should flag UPDATE with no WHERE - per BMQL.md this updates every record');
        });

        test('Flags MODIFY with no WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("MODIFY my_table SET status = 'done'");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-mutation');
            assert.ok(diag, 'Should flag MODIFY with no WHERE');
        });

        test('Does not flag UPDATE with a WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("UPDATE my_table SET status = 'done' WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-mutation');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('DELETE without WHERE (bml-bmql-unbounded-delete)', () => {
        test('Flags DELETE with no WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("DELETE FROM my_table");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-delete');
            assert.ok(diag, 'Should flag DELETE with no WHERE - per BMQL.md this clears the whole table');
        });

        test('Does not flag DELETE with a WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("DELETE FROM my_table WHERE id = $id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-delete');
            assert.strictEqual(diag, undefined);
        });
    });

    suite('SELECT with DISTINCT/ORDER BY, no WHERE (bml-bmql-select-truncated)', () => {
        test('Flags SELECT DISTINCT with no WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT DISTINCT status FROM my_table");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-select-truncated');
            assert.ok(diag, 'DISTINCT/ORDER BY without WHERE is also capped at 1,000 records per BMQL.md');
        });

        test('Flags SELECT ORDER BY with no WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id FROM my_table ORDER BY id");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-select-truncated');
            assert.ok(diag, 'Should flag ORDER BY with no WHERE');
        });

        test('Does not flag SELECT DISTINCT with a WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT DISTINCT status FROM my_table WHERE active = 1");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-select-truncated');
            assert.strictEqual(diag, undefined);
        });

        test('Flags SELECT Name $Where FROM data_table as unbounded select (prefixed with $ is a variable, not SQL keyword WHERE)', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT Name $Where FROM data_table");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-select');
            assert.ok(diag, 'Should flag SELECT Name $Where FROM data_table as unbounded select');
        });
    });

    suite("Direct DB Access Functions - gettabledata, getpartsdata, etc.", () => {
        test("gettabledata() - triggers deprecation warning → bml-gettabledata-fix", () => {
            const diagnostics = lintText('x = gettabledata("my_table", string[1]); return "";');
            const err = diagnostics.find((d) => d.code === "bml-gettabledata-fix");
            assert.ok(err);
        });

        test("getpartsdata() - triggers deprecation warning → bml-getpartsdata-fix", () => {
            const diagnostics = lintText('x = getpartsdata(string[1], string[1], "USD"); return "";');
            const err = diagnostics.find((d) => d.code === "bml-getpartsdata-fix");
            assert.ok(err);
        });

        test("haserror() / getmessage() - require exactly 1 argument", () => {
            const diagnostics = lintText('x = haserror(); y = getmessage(); return "";');
            const errs = diagnostics.filter((d) => d.code === "bml-function-arg-count");
            assert.strictEqual(errs.length, 2);
        });

        test("getint(record, field) - correct 2 arguments → no error", () => {
            const diagnostics = lintText('rec = record(); x = getint(rec, "field"); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.strictEqual(err, undefined);
        });

        test("getint(record, field) - type mismatch for fieldName (expected String) → Warning", () => {
            const diagnostics = lintText('rec = record(); x = getint(rec, 123); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
            assert.ok(err);
        });

        test("recordset() - zero arguments → no error", () => {
            const diagnostics = lintText('x = recordset(); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.strictEqual(err, undefined);
        });

        test("recordset(123) - 1 argument → Error", () => {
            const diagnostics = lintText('x = recordset(123); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.ok(err);
        });

        test("bmql() - zero arguments → Error", () => {
            const diagnostics = lintText('x = bmql(); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.ok(err);
        });

        test("bmql(q, c, f, extra) - 4 arguments → Error", () => {
            const diagnostics = lintText('x = bmql("q", dict("string"), dict("string"), "extra"); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.ok(err);
        });

        test("bmql(123) - type mismatch → Warning", () => {
            const diagnostics = lintText('x = bmql(123); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-type");
            assert.ok(err);
        });

        test("gettransaction() - valid 1 to 3 arguments → no error", () => {
            const diagnostics = lintText('x = gettransaction(12345); return "";');
            const err = diagnostics.find((d) => d.code === "bml-function-arg-count");
            assert.strictEqual(err, undefined);
        });
    });

    suite('BMQL inside loop detection (bml-bmql-in-loop)', () => {
        test('Flags BMQL query inside a for loop', () => {
            const diagnostics = lintText(`
                items = string[]{"a", "b"};
                for item in items {
                    rs = bmql("SELECT price FROM parts WHERE id = $item");
                }
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-in-loop');
            assert.ok(diag, 'Should flag BMQL query executed inside a loop');
        });

        test('Does not flag BMQL query executed outside a loop', () => {
            const diagnostics = lintText(`
                rs = bmql("SELECT price FROM parts WHERE status = 'ACTIVE'");
                for rec in rs {
                    p = get(rec, "price");
                }
                return "";
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-in-loop');
            assert.strictEqual(diag, undefined);
        });
    });
});
