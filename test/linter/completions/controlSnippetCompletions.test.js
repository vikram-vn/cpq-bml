const assert = require('assert');
const { getBmlApiData } = require('../../../app/lang/intellisense/apiData');

suite('BML IntelliSense - Control Flow Snippets & Completion Verification', () => {
    test('if snippet syntax has clean condition placeholders and proper block indentation', () => {
        const apiData = getBmlApiData();
        const ifEntry = apiData['if...'] || apiData['if'];
        assert.ok(ifEntry, "Should contain 'if' entry in API data");
        assert.ok(ifEntry.syntax.includes('if (${1:condition})'), "Should have 'if (${1:condition})' syntax");
        assert.ok(!ifEntry.syntax.includes('statement;'), "Should NOT contain dummy 'statement;' literal text");
        assert.ok(!ifEntry.syntax.includes('((condition))'), "Should NOT have double parentheses");
    });

    test('if...else and if...else...if snippets are clean with no dummy text', () => {
        const apiData = getBmlApiData();
        const ifElse = apiData['if...else'];
        const ifElseIf = apiData['if...else...if'];

        assert.ok(ifElse, "Should contain 'if...else' entry");
        assert.ok(ifElse.syntax.includes('else'), "Should contain else branch");
        assert.ok(!ifElse.syntax.includes('statement;'), "Should NOT contain literal dummy text");

        assert.ok(ifElseIf, "Should contain 'if...else...if' entry");
        assert.ok(ifElseIf.syntax.includes('elif'), "Should contain elif branch");
        assert.ok(!ifElseIf.syntax.includes('statement(s);'), "Should NOT contain literal dummy text");
    });

    test('for...loop snippet syntax is clean', () => {
        const apiData = getBmlApiData();
        const forLoop = apiData['for...loop'];
        assert.ok(forLoop, "Should contain 'for...loop' entry");
        assert.ok(forLoop.syntax.includes('for'), "Should have for loop syntax");
        assert.ok(!forLoop.syntax.includes('statement(s)'), "Should NOT contain dummy text");
    });

    test('custom-snippets provides rich dictionary, json, bmql, and commerce snippets', () => {
        const apiData = getBmlApiData();
        assert.ok(apiData['dict'], "Should have 'dict' snippet");
        assert.ok(apiData['dict-iter'], "Should have 'dict-iter' snippet");
        assert.ok(apiData['dict-get-default'], "Should have 'dict-get-default' snippet");
        assert.ok(apiData['json-new'], "Should have 'json-new' snippet");
        assert.ok(apiData['json-iter'], "Should have 'json-iter' snippet");
        assert.ok(apiData['jsonpath-get'], "Should have 'jsonpath-get' snippet");
        assert.ok(apiData['jsonarray-new'], "Should have 'jsonarray-new' snippet");
        assert.ok(apiData['bmql-select'], "Should have 'bmql-select' snippet");
        assert.ok(apiData['bmql-select-in'], "Should have 'bmql-select-in' snippet");
        assert.ok(apiData['bmql-update'], "Should have 'bmql-update' snippet");
        assert.ok(apiData['urldata-get'], "Should have 'urldata-get' snippet");
        assert.ok(apiData['urldata-post'], "Should have 'urldata-post' snippet");
        assert.ok(apiData['urldata-auth-bearer'], "Should have 'urldata-auth-bearer' snippet");
        assert.ok(apiData['xml-read'], "Should have 'xml-read' snippet");
        assert.ok(apiData['xml-transform'], "Should have 'xml-transform' snippet");
        assert.ok(apiData['commerce-return'], "Should have 'commerce-return' snippet");
        assert.ok(apiData['commerce-line-iter'], "Should have 'commerce-line-iter' snippet");
        assert.ok(apiData['date-format'], "Should have 'date-format' snippet");
        assert.ok(apiData['date-parse'], "Should have 'date-parse' snippet");
        assert.ok(apiData['doc-func'], "Should have 'doc-func' snippet");
        assert.ok(apiData['doc-file'], "Should have 'doc-file' snippet");
    });
});
