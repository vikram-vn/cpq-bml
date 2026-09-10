const assert = require('assert');
const { ActionSimulator } = require('../../app/lang/rest/apiActionSimulator');

suite('Commerce Action Simulator & Delta Inspector - Unit Tests', () => {
  test('computes attribute delta between before and after states', () => {
    const before = {
      header: {
        totalAmount_t: 1000.0,
        discount_percent_t: 0.1,
        status_t: 'DRAFT'
      },
      lines: [{ _part_number: 'P1' }]
    };

    const after = {
      header: {
        totalAmount_t: 800.0, // Changed
        discount_percent_t: 0.2, // Changed
        status_t: 'DRAFT', // Unchanged
        is_recalculated: true // Added
      },
      lines: [{ _part_number: 'P1' }, { _part_number: 'P2' }] // Line added
    };

    const delta = ActionSimulator.computeAttributeDelta(before, after);

    assert.strictEqual(delta.headerChanges.length, 3);
    const totalChange = delta.headerChanges.find(c => c.attribute === 'totalAmount_t');
    assert.strictEqual(totalChange.before, 1000.0);
    assert.strictEqual(totalChange.after, 800.0);

    const addedChange = delta.headerChanges.find(c => c.attribute === 'is_recalculated');
    assert.strictEqual(addedChange.before, '(none)');
    assert.strictEqual(addedChange.after, true);

    assert.strictEqual(delta.lineDiff.beforeCount, 1);
    assert.strictEqual(delta.lineDiff.afterCount, 2);
    assert.strictEqual(delta.lineDiff.countChanged, true);
  });

  test('formats human-readable delta report accurately', () => {
    const result = {
      actionName: '_recalculate',
      transactionId: '54321',
      delta: {
        headerChanges: [
          { attribute: 'totalAmount_t', before: 100, after: 90 }
        ],
        lineDiff: { beforeCount: 1, afterCount: 1, countChanged: false }
      }
    };

    const report = ActionSimulator.formatDeltaReport(result);
    assert.ok(report.includes('_recalculate'));
    assert.ok(report.includes('Quote #54321'));
    assert.ok(report.includes('totalAmount_t'));
    assert.ok(report.includes('100'));
    assert.ok(report.includes('90'));
  });
});
