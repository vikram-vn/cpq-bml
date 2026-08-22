const assert = require('assert');
const { lintText } = require('../fixtures');

suite('Parameter Type Validation - CPQJS & Other Library Methods', () => {
    test('CPQJS.getTableInfo expects String (p1), flags Integer (p1)', () => {
        const diags = lintText('res = CPQJS.getTableInfo(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to CPQJS.getTableInfo() expecting String');
    });

    test('CPQJS.performAction expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); CPQJS.performAction(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to CPQJS.performAction() expecting String');
    });

    test('CPQJS.actionExists expects String (p1), flags Integer (p1)', () => {
        const diags = lintText('res = CPQJS.actionExists(123); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Integer to CPQJS.actionExists() expecting String');
    });

    test('CPQJS.attributeExists expects String (p1), flags Date (p1)', () => {
        const diags = lintText('dt = getdate(); res = CPQJS.attributeExists(dt); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Date to CPQJS.attributeExists() expecting String');
    });

    test('CPQJS.getAttributeVal expects String (p1), flags Float (p1)', () => {
        const diags = lintText('f = 12.34; res = CPQJS.getAttributeVal(f); return "";');
        const err = diags.find(d => d.code === 'bml-function-arg-type');
        assert.ok(err, 'Should flag passing Float to CPQJS.getAttributeVal() expecting String');
    });
});
