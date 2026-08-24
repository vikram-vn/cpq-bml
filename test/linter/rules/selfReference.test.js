const assert = require('assert');
const { lintText } = require('../fixtures');

// No -meta.json sidecar exists at these fake paths, so readOwnFunctionName()
// falls back to inferring the function's own name from the filename - matching
// the real convention that a pulled function's .bml file is named after its
// own variableName.
suite('BML Linter Test Suite - self-reference (bml-self-reference)', () => {
    test('Flags a util function calling itself by name', () => {
        const diagnostics = lintText(`
            result = util.abo_apply(a, b);
            return result;
        `, '/mock/library/abo_apply.bml');
        const diag = diagnostics.find(d => d.code === 'bml-self-reference');
        assert.ok(diag, 'Should flag abo_apply.bml calling util.abo_apply');
        assert.ok(diag.message.includes('abo_apply'));
    });

    test('Flags a commerce function calling itself through a folder-namespaced path', () => {
        const diagnostics = lintText(`
            result = commerce.ORCL_ABO.abo_apply(a, b);
            return result;
        `, '/mock/library/abo_apply.bml');
        const diag = diagnostics.find(d => d.code === 'bml-self-reference');
        assert.ok(diag, 'Should flag self-reference even through a folder segment');
    });

    test('Does not flag a call to a different function', () => {
        const diagnostics = lintText(`
            result = util.someOtherFunction(a, b);
            return result;
        `, '/mock/library/abo_apply.bml');
        const diag = diagnostics.find(d => d.code === 'bml-self-reference');
        assert.strictEqual(diag, undefined, 'Calling a different function is not a self-reference');
    });

    test('Does not flag a bare (non-namespaced) call matching the function name', () => {
        const diagnostics = lintText(`
            result = abo_apply(a, b);
            return result;
        `, '/mock/library/abo_apply.bml');
        const diag = diagnostics.find(d => d.code === 'bml-self-reference');
        assert.strictEqual(diag, undefined, 'Only util./commerce.-prefixed calls are library-function calls');
    });
});
