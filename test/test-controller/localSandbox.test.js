const assert = require('assert');
const { runTestCase } = require('@/lang/test-controller/bmlTestRunner');

suite('Local BML Sandbox Runner - Unit Tests', () => {
  test('executes string and math BML script in sandbox successfully', () => {
    const code = `
      val = 10;
      msg = "Hello";
      print("Calculated: " + string(val * 2));
      return msg + " World";
    `;

    const res = runTestCase(code);
    assert.strictEqual(res.passed, true);
    assert.strictEqual(res.returnValue, 'Hello World');
    assert.ok(res.output.some(l => l.includes('Calculated: 20')));
    assert.ok(res.durationMs >= 0);
  });

  test('catches runtime syntax/logic errors gracefully', () => {
    const code = `
      val = undefinedVariable.nonExistent();
    `;

    const res = runTestCase(code);
    assert.strictEqual(res.passed, false);
    assert.ok(res.error);
  });
});
