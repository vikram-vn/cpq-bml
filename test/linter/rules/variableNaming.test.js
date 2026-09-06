const assert = require('assert');
const { lintText } = require('../fixtures');

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
            lineItems = string[]{"SKU-1"};
            logEntries = string[]{"LOG-1"};
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
        assert.ok(arrayErrors[0].message.includes("suffix of 'List', 'Arr', 'Array', '2D', 'Items', or 'Entries'"));
    });

    test('Dictionary suffix checks', () => {
        // Valid dict names (Dict, Map, Set)
        const diags1 = lintText(`
            myDict = dict("string");
            priceMap = dict("float");
            idSet = dict("boolean");
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
        assert.ok(dictErrors[0].message.includes("suffix of 'Dict', 'Map', or 'Set'"));
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

    test('JSON object suffix checks', () => {
        // Valid JSON object names (Json, Obj, Payload, Response, Request, Body)
        const diags1 = lintText(`
            resultJson = json();
            userObj = json();
            requestPayload = json();
            serverRespResponse = json();
            authRequest = json();
            reqBody = json();
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-json-naming-suffix').length, 0);

        // Invalid JSON object name
        const diags2 = lintText(`
            userData = json();
            return "";
        `);
        const jsonErrors = diags2.filter(d => d.code === 'bml-json-naming-suffix');
        assert.strictEqual(jsonErrors.length, 1);
        assert.ok(jsonErrors[0].message.includes("suffix of 'Json', 'Obj', 'Payload', 'Response', 'Request', or 'Body'"));
    });

    test('JsonArray suffix checks', () => {
        // Valid JsonArray names (JsonArray, JsonArr, List, Arr, Array, Items, Entries)
        const diags1 = lintText(`
            dataJsonArray = jsonarray();
            itemJsonArr = jsonarray();
            partsList = jsonarray();
            lineArr = jsonarray();
            valuesArray = jsonarray();
            orderItems = jsonarray();
            logEntries = jsonarray();
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-jsonarray-naming-suffix').length, 0);

        // Invalid JsonArray name
        const diags2 = lintText(`
            itemsData = jsonarray();
            return "";
        `);
        const jsonArrayErrors = diags2.filter(d => d.code === 'bml-jsonarray-naming-suffix');
        assert.strictEqual(jsonArrayErrors.length, 1);
        assert.ok(jsonArrayErrors[0].message.includes("suffix of 'JsonArray', 'JsonArr', 'List', 'Arr', 'Array', 'Items', or 'Entries'"));
    });

    test('Date suffix checks', () => {
        // Valid Date names (Date, Time, Timestamp, Dt)
        const diags1 = lintText(`
            createdDate = getdate();
            expiryTime = getdate();
            eventTimestamp = getdate();
            startDt = getdate();
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-date-naming-suffix').length, 0);

        // Invalid Date name
        const diags2 = lintText(`
            today = getdate();
            return "";
        `);
        const dateErrors = diags2.filter(d => d.code === 'bml-date-naming-suffix');
        assert.strictEqual(dateErrors.length, 1);
        assert.ok(dateErrors[0].message.includes("suffix of 'Date', 'Time', 'Timestamp', or 'Dt'"));
    });

    test('StringBuilder suffix checks', () => {
        // Valid StringBuilder names (Sb, Builder)
        const diags1 = lintText(`
            bufferSb = stringbuilder();
            queryBuilder = stringbuilder();
            return "";
        `);
        assert.strictEqual(diags1.filter(d => d.code === 'bml-stringbuilder-naming-suffix').length, 0);

        // Invalid StringBuilder name
        const diags2 = lintText(`
            queryBuffer = stringbuilder();
            return "";
        `);
        const sbErrors = diags2.filter(d => d.code === 'bml-stringbuilder-naming-suffix');
        assert.strictEqual(sbErrors.length, 1);
        assert.ok(sbErrors[0].message.includes("suffix of 'Sb' or 'Builder'"));
    });
});
