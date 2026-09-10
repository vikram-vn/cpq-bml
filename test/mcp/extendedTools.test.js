const assert = require('assert');
const { generateBmlUnitTestTool, executeBmlTestSuiteTool } = require('@/lang/mcp/tools/testTools');
const { introspectCpqSchemaTool } = require('@/lang/mcp/tools/schemaTools');

describe('Extended MCP Tools', () => {

    it('generate_bml_unit_test scaffolds unit test structure', async () => {
        const res = await generateBmlUnitTestTool.handler({
            functionName: 'computeDiscount',
            returnType: 'Float',
            description: 'Computes tier volume discount',
        });
        const text = res.content[0].text;
        assert.ok(text.includes('Unit Test: computeDiscount'));
        assert.ok(text.includes('@test'));
        assert.ok(text.includes('assert.equals'));
    });

    it('execute_bml_test_suite runs test suite via MCP', async () => {
        const testCode = `
            // @test "Sample Passing Test"
            x = 10 * 2;
            assert.equals(x, 20);
        `;
        const res = await executeBmlTestSuiteTool.handler({ testCode });
        const parsed = JSON.parse(res.content[0].text);
        assert.strictEqual(parsed.success, true);
        assert.strictEqual(parsed.passed, 1);
        assert.strictEqual(parsed.failed, 0);
    });

    it('introspect_cpq_schema returns cached schema and attributes', async () => {
        const res = await introspectCpqSchemaTool.handler();
        const parsed = JSON.parse(res.content[0].text);
        assert.ok(Array.isArray(parsed.transactionAttributes));
        assert.ok(Array.isArray(parsed.lineItemAttributes));
        assert.ok(Array.isArray(parsed.dataTables));
    });
});
