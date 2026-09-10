const assert = require('assert');
const { BmlTestRunner } = require('@/lang/test-controller/bmlTestRunner');

suite('BML Test Runner & Assertions', () => {
    test('extracts test cases from @test annotations', () => {
        const content = `
            // @test "Calculate Tier 1 Discount"
            res = 100 * 0.15;
            assert.equals(res, 15);

            // @test "Calculate Tier 2 Discount"
            res = 100 * 0.25;
            assert.equals(res, 25);
        `;

        const testCases = BmlTestRunner.extractTestCases(content);
        assert.strictEqual(testCases.length, 2);
        assert.strictEqual(testCases[0].name, 'Calculate Tier 1 Discount');
        assert.strictEqual(testCases[1].name, 'Calculate Tier 2 Discount');
    });

    test('executes passing assertions successfully', () => {
        const code = `
            total = 50 + 50;
            assert.equals(total, 100);
            assert.isTrue(total > 0);
            assert.notNull(total);
        `;

        const res = BmlTestRunner.runTestCase(code);
        assert.strictEqual(res.passed, true);
        assert.ok(res.durationMs >= 0);
    });

    test('fails when assert.equals condition is violated', () => {
        const code = `
            total = 50 + 50;
            assert.equals(total, 999, "Total should equal 999");
        `;

        const res = BmlTestRunner.runTestCase(code);
        assert.strictEqual(res.passed, false);
        assert.ok(res.error.includes('Total should equal 999'));
    });

    test('fails when assert.isTrue condition is false', () => {
        const code = `
            assert.isTrue(1 > 10, "1 is not greater than 10");
        `;

        const res = BmlTestRunner.runTestCase(code);
        assert.strictEqual(res.passed, false);
        assert.ok(res.error.includes('1 is not greater than 10'));
    });
});
