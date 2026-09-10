const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  extractBmltAssertions,
  executeRemoteBmltTest,
  formatTestRunReport
} = require('@/lang/test-controller/remoteTestRunner');

suite('Server-Side BMLT Test Runner - Unit Tests', () => {
  test('extractBmltAssertions identifies assert.equals, assert.isTrue, and assert.notNull', () => {
    const code = `
      // Sample test code
      val = 100 * 2;
      assert.equals(val, 200, "Should equal 200");
      assert.isTrue(val > 50, "Should be greater than 50");
      assert.notNull(val);
    `;

    const assertions = extractBmltAssertions(code);
    assert.strictEqual(assertions.length, 3);
    assert.strictEqual(assertions[0].type, 'equals');
    assert.strictEqual(assertions[0].actual, 'val');
    assert.strictEqual(assertions[0].expected, '200');
    assert.strictEqual(assertions[1].type, 'isTrue');
    assert.strictEqual(assertions[2].type, 'notNull');
  });

  test('executeRemoteBmltTest executes BMLT test file and reports assertions and status', async () => {
    const tempDir = path.join(__dirname, '..', 'fixtures');
    fs.mkdirSync(tempDir, { recursive: true });
    const bmltFile = path.join(tempDir, 'sample_runner_test.bmlt');

    const code = [
      '// @test "Sample Arithmetic Test"',
      'sum = 10 + 20;',
      'assert.equals(sum, 30);',
      'assert.isTrue(sum > 0);',
      '',
      '// @test "Sample String Test"',
      'str = "CPQ" + " BML";',
      'assert.equals(str, "CPQ BML");'
    ].join('\n');

    fs.writeFileSync(bmltFile, code, 'utf8');

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({ get: () => '' })
      }
    };

    const report = await executeRemoteBmltTest(bmltFile, mockVscode, {});
    assert.strictEqual(report.allPassed, true);
    assert.strictEqual(report.totalCount, 2);
    assert.strictEqual(report.passedCount, 2);
    assert.strictEqual(report.failedCount, 0);

    const formatted = formatTestRunReport(report);
    assert.ok(formatted.includes('[PASS] Sample Arithmetic Test'));
    assert.ok(formatted.includes('[PASS] Sample String Test'));
    assert.ok(formatted.includes('ALL TESTS PASSED'));

    // Clean up
    fs.unlinkSync(bmltFile);
  });
});
