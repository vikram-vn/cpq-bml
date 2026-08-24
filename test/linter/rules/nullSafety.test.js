const assert = require('assert');
const { lintText } = require('../fixtures');

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
            result = val + " suffix";
            return result;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.ok(nullDiags.length > 0, 'Should flag unguarded get() result use');
    });

    test('does not flag non-bmql assignments', () => {
        const diags = lintText(`
            x = "hello";
            y = x + " world";
            return y;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.strictEqual(nullDiags.length, 0, 'Should not flag regular string assignments');
    });

    test('does not flag a bmql result consumed only via for-in iteration', () => {
        // BMQL.md's own examples consume results exactly this way - an empty
        // RecordSet simply never enters the loop, so no guard is needed.
        const diags = lintText(`
            results = bmql("SELECT id FROM table WHERE x = $x");
            for row in results {
                print(row);
            }
            return "";
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.strictEqual(nullDiags.length, 0, 'for-in iteration is the documented safe consumption pattern');
    });

    test('still flags a non-loop expression use even when a for-in also exists', () => {
        const diags = lintText(`
            results = bmql("SELECT id FROM table WHERE x = $x");
            summary = "got: " + results;
            for row in results {
                print(row);
            }
            return summary;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.ok(nullDiags.length > 0, 'expression use before the loop must still be flagged');
    });

    test('does not flag pre-initialized variable with fallback default value and contains guard', () => {
        const diags = lintText(`
            cur = 0;
            if (contains(somedic, "somekey")) {
                cur = get(somedic, "somekey");
            }
            test = cur + 10;
            return test;
        `);
        const nullDiags = diags.filter(d => d.code === 'bml-null-check-required');
        assert.strictEqual(nullDiags.length, 0, 'Should not flag pre-initialized variable with contains guard');
    });
});
