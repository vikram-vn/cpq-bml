const assert = require('assert');
const { BmlReplSession } = require('../../app/lang/repl/bmlReplSession');

suite('Interactive BML REPL - Unit Tests', () => {
  test('persists stateful variables across evaluations', () => {
    const session = new BmlReplSession();

    const res1 = session.execute('basePrice = 100;');
    assert.strictEqual(res1.type, 'result');

    const res2 = session.execute('discount = 0.2;');
    assert.strictEqual(res2.type, 'result');

    const res3 = session.execute('basePrice * (1.0 - discount)');
    assert.strictEqual(res3.type, 'result');
    assert.strictEqual(res3.value, 80);
    assert.ok(res3.formatted.includes('80'));
  });

  test('executes built-in dictionary operations and returns values', () => {
    const session = new BmlReplSession();

    session.execute('d = dict("string");');
    session.execute('put(d, "currency", "USD");');

    const res = session.execute('get(d, "currency")');
    assert.strictEqual(res.type, 'result');
    assert.strictEqual(res.value, 'USD');
    assert.strictEqual(res.formatted, '"USD" (String)');
  });

  test('captures print() statements and returns them in evaluation payload', () => {
    const session = new BmlReplSession();

    const res = session.execute('print("Hello from CPQ BML");');
    assert.strictEqual(res.type, 'result');
    assert.strictEqual(res.prints.length, 1);
    assert.strictEqual(res.prints[0], 'Hello from CPQ BML');
  });

  test('handles meta-command .vars listing active user variables', () => {
    const session = new BmlReplSession();
    session.execute('quantity = 5;');
    session.execute('item = "SKU-99";');

    const meta = session.execute('.vars');
    assert.strictEqual(meta.type, 'system');
    assert.ok(meta.text.includes('quantity: 5 [Integer]'));
    assert.ok(meta.text.includes('item: "SKU-99" [String]'));
  });

  test('handles meta-command .clear resetting in-memory state', () => {
    const session = new BmlReplSession();
    session.execute('count = 42;');

    const clearRes = session.execute('.clear');
    assert.strictEqual(clearRes.type, 'system');

    const varsRes = session.execute('.vars');
    assert.strictEqual(varsRes.type, 'system');
    assert.ok(varsRes.text.includes('No active variables defined'));
  });

  test('returns graceful error payload on invalid syntax', () => {
    const session = new BmlReplSession();
    const res = session.execute('for (i in');
    assert.strictEqual(res.type, 'error');
    assert.ok(res.error.length > 0);
  });
});
