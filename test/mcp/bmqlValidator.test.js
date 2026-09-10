const assert = require('assert');
const { validateBmqlQuery } = require('@/lang/mcp/tools/bmqlValidator');

describe('BMQL Validator Tool', () => {
    it('validates a correct parameterized BMQL query', () => {
        const result = validateBmqlQuery({
            query: 'SELECT partNumber, price FROM PricingTable WHERE model = $currentModel AND region = $userRegion'
        });

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.tableName, 'PricingTable');
        assert.deepStrictEqual(result.columns, ['partNumber', 'price']);
        assert.deepStrictEqual(result.parameters, ['currentModel', 'userRegion']);
        assert.strictEqual(result.issues.length, 0);
    });

    it('warns on SELECT * in BMQL', () => {
        const result = validateBmqlQuery({
            query: 'SELECT * FROM Products WHERE active = $isActive'
        });

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.columns.includes('*'), true);
        const warning = result.issues.find(i => i.rule === 'SELECT_STAR_ADVISORY');
        assert.ok(warning);
    });

    it('flags BMQL injection risks from string concatenation', () => {
        const result = validateBmqlQuery({
            query: "SELECT id FROM Users WHERE username = '\" + adminVar + \"'"
        });

        const injection = result.issues.find(i => i.rule === 'BMQL_INJECTION_RISK');
        assert.ok(injection);
        assert.strictEqual(injection.severity, 'critical');
    });

    it('rejects unsupported SQL keywords like JOIN and GROUP BY', () => {
        const result = validateBmqlQuery({
            query: 'SELECT a.col, b.col FROM TableA a JOIN TableB b ON a.id = b.id'
        });

        assert.strictEqual(result.isValid, false);
        const joinIssue = result.issues.find(i => i.keyword === 'JOIN');
        assert.ok(joinIssue);
    });

    it('warns on queries with missing WHERE clause', () => {
        const result = validateBmqlQuery({
            query: 'SELECT sku FROM Catalog'
        });

        assert.strictEqual(result.isValid, true);
        const unbounded = result.issues.find(i => i.rule === 'UNBOUNDED_QUERY');
        assert.ok(unbounded);
    });
});
