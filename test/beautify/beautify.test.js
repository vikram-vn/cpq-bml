const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bml_beautify = require('../../app/lang/beautify/bml/index');

suite('BML Beautifier Unit & Fixture Tests', () => {
    test('BML Beautifier formats standard assignments and code', () => {
        const source = 'test="hi";';
        const expected = 'test = "hi";';
        const result = bml_beautify(source, { indent_char: '\t', indent_size: 1 });
        assert.strictEqual(result, expected);
    });

    const testDir = path.join(__dirname, 'fixtures');
    if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir);
        const inputFiles = files.filter(f => f.endsWith('.bml') && !f.endsWith('.expected.bml'));

        for (const file of inputFiles) {
            const testName = path.basename(file, '.bml');
            test(`BML Beautifier fixture: ${testName}`, () => {
                const inputPath = path.join(testDir, file);
                const expectedPath = path.join(testDir, `${testName}.expected.bml`);
                const optionsPath = path.join(testDir, `${testName}.options.json`);

                const source = fs.readFileSync(inputPath, 'utf8');
                const expected = fs.readFileSync(expectedPath, 'utf8');

                let options = { indent_char: '\t', indent_size: 1 };
                if (fs.existsSync(optionsPath)) {
                    options = { ...options, ...JSON.parse(fs.readFileSync(optionsPath, 'utf8')) };
                }

                const result = bml_beautify(source, options);
                assert.strictEqual(result.replace(/\r\n/g, '\n').trim(), expected.replace(/\r\n/g, '\n').trim());
            });

            test(`BML Beautifier is idempotent: ${testName}`, () => {
                const inputPath = path.join(testDir, file);
                const optionsPath = path.join(testDir, `${testName}.options.json`);

                const source = fs.readFileSync(inputPath, 'utf8');
                let options = { indent_char: '\t', indent_size: 1 };
                if (fs.existsSync(optionsPath)) {
                    options = { ...options, ...JSON.parse(fs.readFileSync(optionsPath, 'utf8')) };
                }

                const once = bml_beautify(source, options);
                const twice = bml_beautify(once, options);
                assert.strictEqual(twice, once);
            });
        }
    }

    suite('BML Beautifier enhanced knowledge-base tests', () => {
        const opts = { indent_char: '\t', indent_size: 1 };

        test('formats BMQL SQL keywords to uppercase in bmql() query strings', () => {
            const source = 'rs = bmql("select part_number, price from parts where model = $currModel and price > 0 order by price asc");';
            const expected = 'rs = bmql("SELECT part_number, price FROM parts WHERE model = $currModel AND price > 0 ORDER BY price ASC");';
            const result = bml_beautify(source, { ...opts, format_bmql_strings: true });
            assert.strictEqual(result, expected);
        });

        test('formats BMQL modify and update statements', () => {
            const source = 'bmql("modify live_table set status = $newStatus where id = $id");';
            const expected = 'bmql("MODIFY live_table SET status = $newStatus WHERE id = $id");';
            const result = bml_beautify(source, { ...opts, format_bmql_strings: true });
            assert.strictEqual(result, expected);
        });

        test('formats 2D array literals with typed declarator', () => {
            const source = 'matrix = String[][]{{"a","b"},{"c","d"}};';
            const expected = 'matrix = String[][] {{"a", "b"}, {"c", "d"}};';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('supports logical_operator_casing: lowercase', () => {
            const source = 'if (x > 0 AND y < 10) {\nprint("ok");\n}';
            const expected = 'if (x > 0 and y < 10) {\n\tprint("ok");\n}';
            const result = bml_beautify(source, { ...opts, logical_operator_casing: 'lowercase' });
            assert.strictEqual(result, expected);
        });

        test('supports logical_operator_casing: uppercase', () => {
            const source = 'if (x > 0 and y < 10) {\nprint("ok");\n}';
            const expected = 'if (x > 0 AND y < 10) {\n\tprint("ok");\n}';
            const result = bml_beautify(source, { ...opts, logical_operator_casing: 'uppercase' });
            assert.strictEqual(result, expected);
        });

        test('preserves dynamic BMQL variable names with $ prefix', () => {
            const source = 'col = $columnName;\nrs = bmql("SELECT " + $col + " FROM my_table");';
            const result = bml_beautify(source, opts);
            assert.ok(result.includes('$columnName'));
            assert.ok(result.includes('$col'));
        });
    });
});
