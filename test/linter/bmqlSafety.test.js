const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - BMQL safety and performance', () => {
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
    });

    suite('Plain SELECT with no WHERE (bml-bmql-unbounded-select)', () => {
        test('Flags a plain SELECT with no WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id, name FROM my_table");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-select');
            assert.ok(diag, 'A plain SELECT with no WHERE is unbounded (not capped, unlike DISTINCT/ORDER BY)');
        });

        test('Does not flag a plain SELECT with a WHERE clause', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT id, name FROM my_table WHERE active = 1");
                return x;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-bmql-unbounded-select');
            assert.strictEqual(diag, undefined);
        });

        test('Does not flag a SELECT with DISTINCT/ORDER BY twice (only the -select-truncated code should fire)', () => {
            const diagnostics = lintText(`
                x = bmql("SELECT DISTINCT id FROM my_table");
                return x;
            `);
            const unboundedSelect = diagnostics.find(d => d.code === 'bml-bmql-unbounded-select');
            const truncated = diagnostics.find(d => d.code === 'bml-bmql-select-truncated');
            assert.strictEqual(unboundedSelect, undefined, 'DISTINCT queries get the more specific -select-truncated code, not both');
            assert.ok(truncated);
        });
    });
});
