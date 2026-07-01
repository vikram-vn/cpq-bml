const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - Type Coercion / Concat Mismatch', () => {
    test('flags string literal + numeric literal', () => {
        const diags = lintText(`
            result = "value: " + 42;
            return result;
        `);
        const coerceDiags = diags.filter(d => d.code === 'bml-concat-type-mismatch');
        assert.ok(coerceDiags.length > 0, 'Should flag "string" + number');
    });

    test('flags numeric literal + string literal', () => {
        const diags = lintText(`
            result = 100 + " items";
            return result;
        `);
        const coerceDiags = diags.filter(d => d.code === 'bml-concat-type-mismatch');
        assert.ok(coerceDiags.length > 0, 'Should flag number + "string"');
    });

    test('does not flag tilde concatenation', () => {
        const diags = lintText(`
            result = "value: " ~ 42;
            return result;
        `);
        const coerceDiags = diags.filter(d => d.code === 'bml-concat-type-mismatch');
        assert.strictEqual(coerceDiags.length, 0, 'Tilde concat should not be flagged');
    });

    test('does not flag two string literals concatenated with +', () => {
        const diags = lintText(`
            result = "hello" + " world";
            return result;
        `);
        const coerceDiags = diags.filter(d => d.code === 'bml-concat-type-mismatch');
        assert.strictEqual(coerceDiags.length, 0, 'Two strings + is ambiguous, not flagged');
    });

    test('does not flag numeric + numeric', () => {
        const diags = lintText(`
            x = 1 + 2;
            return x;
        `);
        const coerceDiags = diags.filter(d => d.code === 'bml-concat-type-mismatch');
        assert.strictEqual(coerceDiags.length, 0, 'Numeric + numeric should not be flagged');
    });
});
