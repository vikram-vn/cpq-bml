const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - Variable Naming Styles', () => {
    test('camelCase vs constants', () => {
        // Valid camelCase and Constants should not flag
        const diags1 = lintText(`
            myVariable = 1;
            ITEM_DELIM = "*";
            isAwesome = true;
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-variable-camelcase').length, 0);

        // Invalid camelCase: contains underscores
        const diags2 = lintText(`
            my_variable = 1;
            return "";
        `);
        const camelcaseErrors1 = diags2.filter(d => d.code === 'bml-variable-camelcase');
        assert.strictEqual(camelcaseErrors1.length, 1);
        assert.ok(camelcaseErrors1[0].message.includes('camelCase and not contain underscores'));

        // Invalid camelCase: starts with uppercase (but not a constant)
        const diags3 = lintText(`
            MyVariable = 1;
            return "";
        `);
        const camelcaseErrors2 = diags3.filter(d => d.code === 'bml-variable-camelcase');
        assert.strictEqual(camelcaseErrors2.length, 1);
        assert.ok(camelcaseErrors2[0].message.includes('start with a lowercase letter'));
    });

    test('Array suffix checks', () => {
        // Valid array names
        const diags1 = lintText(`
            namesList = string[]{"A"};
            numbersArr = integer[]{1};
            valuesArray = float[]{1.0};
            table2D = string[][]{{"A"}};
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-array-naming-suffix').length, 0);

        // Invalid array names
        const diags2 = lintText(`
            names = string[]{"A"};
            return "";
        `);
        const arrayErrors = diags2.filter(d => d.code === 'bml-array-naming-suffix');
        assert.strictEqual(arrayErrors.length, 1);
        assert.ok(arrayErrors[0].message.includes("suffix of 'List', 'Arr', 'Array', or '2D'"));
    });

    test('Dictionary suffix checks', () => {
        // Valid dict names
        const diags1 = lintText(`
            myDict = dict("string");
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-dict-naming-suffix').length, 0);

        // Invalid dict names
        const diags2 = lintText(`
            myDictionary = dict("string");
            return "";
        `);
        const dictErrors = diags2.filter(d => d.code === 'bml-dict-naming-suffix');
        assert.strictEqual(dictErrors.length, 1);
        assert.ok(dictErrors[0].message.includes("should have a 'Dict' suffix"));
    });

    test('RecordSet suffix checks', () => {
        // Valid recordset names (ending with Records or RecordSet)
        const diags1 = lintText(`
            userRecords = bmql("SELECT username FROM users");
            bmqlQueryResultSetRecordSet = bmql("SELECT username FROM users");
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-recordset-naming-suffix').length, 0);

        // Invalid recordset names
        const diags2 = lintText(`
            userRes = bmql("SELECT username FROM users");
            return "";
        `);
        const recordsetErrors = diags2.filter(d => d.code === 'bml-recordset-naming-suffix');
        assert.strictEqual(recordsetErrors.length, 1);
        assert.ok(recordsetErrors[0].message.includes("should have a 'Records' suffix"));
    });

    test('Boolean prefix checks', () => {
        // Valid boolean prefixes and exceptions
        const diags1 = lintText(`
            isAwesome = true;
            hasErrors = false;
            debug = true;
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-boolean-naming-prefix').length, 0);

        // Invalid boolean prefixes
        const diags2 = lintText(`
            awesome = true;
            return "";
        `);
        const booleanErrors = diags2.filter(d => d.code === 'bml-boolean-naming-prefix');
        assert.strictEqual(booleanErrors.length, 1);
        assert.ok(booleanErrors[0].message.includes("should have an 'is' or 'has' prefix"));
    });
});
