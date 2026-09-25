const assert = require('assert');
const { synthesizeTestFixture } = require('@/lang/test-controller/testGenerator');

suite('BML Test Generator - Unit Tests', () => {
  test('synthesizes test cases for math calculation function with typed params', () => {
    const mockMeta = {
      variableName: 'calcDiscount',
      returnType: 'Float',
      parameters: [
        { name: 'listPrice', type: 'Float' },
        { name: 'discountPct', type: 'Float' },
        { name: 'customerTier', type: 'String' }
      ]
    };

    const fixture = synthesizeTestFixture('calcDiscount.bml', mockMeta);
    assert.strictEqual(fixture.targetFunction, 'calcDiscount');
    assert.strictEqual(fixture.testCases.length, 3);

    // Test case 1: Happy path
    const tc1 = fixture.testCases[0];
    assert.strictEqual(tc1.name, 'Happy Path - Valid Inputs');
    assert.strictEqual(typeof tc1.inputs.listPrice, 'number');
    assert.strictEqual(typeof tc1.inputs.discountPct, 'number');
    assert.strictEqual(typeof tc1.inputs.customerTier, 'string');
    assert.strictEqual(typeof tc1.expectedReturn, 'number');

    // Test case 2: Boundary/Zero case
    const tc2 = fixture.testCases[1];
    assert.strictEqual(tc2.name, 'Boundary Case - Zero / Min Inputs');
    assert.strictEqual(tc2.inputs.listPrice, 0.0);
    assert.strictEqual(tc2.inputs.discountPct, 0.0);
    assert.strictEqual(tc2.inputs.customerTier, '');
  });

  test('synthesizes test cases with default fallback when metadata is minimal', () => {
    const fixture = synthesizeTestFixture('myScript.bml', null);
    assert.strictEqual(fixture.targetFunction, 'myScript');
    assert.strictEqual(fixture.testCases.length, 3);
  });
});
