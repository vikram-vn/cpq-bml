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

        test('formats escaped JSON object string literals with clean spacing and escaped quotes', () => {
            const source = 'payload = "{\\"name\\":\\"Widget\\",\\"id\\":123,\\"active\\":true}";';
            const expected = 'payload = "{\\"name\\": \\"Widget\\", \\"id\\": 123, \\"active\\": true}";';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('formats nested escaped JSON arrays and objects in string literals', () => {
            const source = 'arr = "[{\\"sku\\":\\"A\\",\\"qty\\":2},{\\"sku\\":\\"B\\",\\"qty\\":5}]";';
            const expected = 'arr = "[{\\"sku\\": \\"A\\", \\"qty\\": 2}, {\\"sku\\": \\"B\\", \\"qty\\": 5}]";';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('formats JSON strings passed directly to json() constructor', () => {
            const source = 'j = json("{\\"code\\":200,\\"message\\":\\"OK\\"}");';
            const expected = 'j = json("{\\"code\\": 200, \\"message\\": \\"OK\\"}");';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('leaves non-JSON escaped strings untouched', () => {
            const source = 'text = "He said \\"Hello, world!\\", then walked away.";';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, source);
        });

        test('formats multi-line logical chains with clean continuation indentation (Prettier binaryish)', () => {
            const source = 'if ((status == "ACTIVE" AND totalAmount > 1000.0)\nOR (isVip AND NOT(hasPendingReview))) {\nprint("approved");\n}';
            const expected = 'if ((status == "ACTIVE" AND totalAmount > 1000.0)\n\tOR (isVip AND NOT(hasPendingReview))) {\n\tprint("approved");\n}';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('formats multi-line function call argument lists cleanly (Prettier call-arguments)', () => {
            const source = 'res = urldata(\n"https://api.example.com",\n"POST",\nheaders,\nbody\n);';
            const expected = 'res = urldata(\n\t"https://api.example.com",\n\t"POST",\n\theaders,\n\tbody\n);';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('preserves trailing inline comments with exact single space separation (Prettier comments)', () => {
            const source = 'x = 10; // set initial counter\ny = 20; // set upper limit';
            const expected = 'x = 10; // set initial counter\ny = 20; // set upper limit';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('formats Commerce line item attribute dot references without unwanted spaces', () => {
            const source = 'qty = line.quantity_c;\namount = line.amount_c;';
            const expected = 'qty = line.quantity_c;\namount = line.amount_c;';
            const result = bml_beautify(source, opts);
            assert.strictEqual(result, expected);
        });

        test('wraps long if conditions across multiple lines when wrap_line_length is exceeded', () => {
            const source = 'if (totalDaysContract <> 364 AND totalDaysContract <> 365 AND totalDaysContract <> 366) {\n\ttotalYear = totalDaysContract / 365;\n}';
            const expected = 'if (totalDaysContract <> 364\n\tAND totalDaysContract <> 365\n\tAND totalDaysContract <> 366) {\n\ttotalYear = totalDaysContract / 365;\n}';
            const result = bml_beautify(source, { indent_char: '\t', indent_size: 1, wrap_line_length: 50 });
            assert.strictEqual(result, expected);
        });
    });
});
