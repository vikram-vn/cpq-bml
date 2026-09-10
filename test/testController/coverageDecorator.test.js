const assert = require('assert');
const { BmlTestRunner } = require('../../app/lang/test-controller/bmlTestRunner');

suite('BML Test Coverage Calculation - Unit Tests', () => {
  test('extracts executable statement lines and excludes comments & braces', () => {
    const code = [
      '/* Block comment',
      '   multi line */',
      '// Single line comment',
      'price = 100.0;',
      'discount = 0.1;',
      'if (price > 50) {',
      '  total = price * (1 - discount);',
      '}',
      'else {',
      '  total = price;',
      '}'
    ].join('\n');

    const execLines = BmlTestRunner.getExecutableLines(code);

    assert.ok(execLines.includes(4));
    assert.ok(execLines.includes(5));
    assert.ok(execLines.includes(6));
    assert.ok(execLines.includes(7));
    assert.ok(execLines.includes(10));
    assert.ok(!execLines.includes(1));
    assert.ok(!execLines.includes(2));
    assert.ok(!execLines.includes(3));
    assert.ok(!execLines.includes(8));
    assert.ok(!execLines.includes(9));
    assert.ok(!execLines.includes(11));
  });

  test('computes coverage percentage accurately', () => {
    const executable = [1, 2, 3, 4, 5];
    const executed = [1, 2, 3, 4]; // 4 out of 5 covered = 80%

    const res = BmlTestRunner.computeCoverage(executable, executed);
    assert.strictEqual(res.totalLines, 5);
    assert.strictEqual(res.percentage, 80);
    assert.deepStrictEqual(res.covered, [1, 2, 3, 4]);
    assert.deepStrictEqual(res.uncovered, [5]);
  });

  test('handles 100% and 0% coverage edge cases', () => {
    const full = BmlTestRunner.computeCoverage([1, 2], [1, 2]);
    assert.strictEqual(full.percentage, 100);
    assert.strictEqual(full.uncovered.length, 0);

    const none = BmlTestRunner.computeCoverage([1, 2], []);
    assert.strictEqual(none.percentage, 0);
    assert.strictEqual(none.covered.length, 0);
  });
});
