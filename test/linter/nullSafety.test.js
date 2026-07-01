const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - Null Safety', () => {
    test('flags unguarded use of bmql result variable', () => {
        const diags = lintText(`
            rows = bmql("SELECT id FROM table");
            x = rows[0];
            return x;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.ok(nullDiags.length > 0, 'Should flag unguarded bmql result use');
    });

    test('does not flag when isnull guard is present', () => {
        const diags = lintText(`
            rows = bmql("SELECT id FROM table");
            if (isnull(rows)) {
                return "";
            }
            x = rows[0];
            return x;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.strictEqual(nullDiags.length, 0, 'Should not flag when isnull guard precedes use');
    });

    test('does not flag when sizeofarray guard is present', () => {
        const diags = lintText(`
            rows = bmql("SELECT id FROM table");
            if (sizeofarray(rows) > 0) {
                x = rows[0];
            }
            return "";
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.strictEqual(nullDiags.length, 0, 'Should not flag when sizeofarray guard precedes use');
    });

    test('flags unguarded use of get() result', () => {
        const diags = lintText(`
            val = get(myDict, "key");
            result = val ~ " suffix";
            return result;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.ok(nullDiags.length > 0, 'Should flag unguarded get() result use');
    });

    test('does not flag non-bmql assignments', () => {
        const diags = lintText(`
            x = "hello";
            y = x ~ " world";
            return y;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.strictEqual(nullDiags.length, 0, 'Should not flag regular string assignments');
    });
});
