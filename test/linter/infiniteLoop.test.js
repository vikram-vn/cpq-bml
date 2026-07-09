const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - Empty Loop Detection', () => {
    test('flags for-loop over empty array literal', () => {
        const diags = lintText(`
            arr = string[]{};
            for item in arr {
                print(item);
            }
            return "";
        `);
        const loopDiags = diags.filter(d => d.code === 'bml-empty-loop');
        assert.ok(loopDiags.length > 0, 'Should flag loop over empty string[] array');
    });

    test('flags for-loop over empty integer array', () => {
        const diags = lintText(`
            nums = integer[]{};
            for n in nums {
                print(n);
            }
            return "";
        `);
        const loopDiags = diags.filter(d => d.code === 'bml-empty-loop');
        assert.ok(loopDiags.length > 0, 'Should flag loop over empty integer[] array');
    });

    test('does not flag loop if array is populated before the loop', () => {
        const diags = lintText(`
            arr = string[]{};
            arr = split("a,b,c", ",");
            for item in arr {
                print(item);
            }
            return "";
        `);
        const loopDiags = diags.filter(d => d.code === 'bml-empty-loop');
        assert.strictEqual(loopDiags.length, 0, 'Should not flag when array is repopulated before loop');
    });

    test('does not flag loop over non-empty array literal', () => {
        const diags = lintText(`
            arr = split("a,b", ",");
            for item in arr {
                print(item);
            }
            return "";
        `);
        const loopDiags = diags.filter(d => d.code === 'bml-empty-loop');
        assert.strictEqual(loopDiags.length, 0, 'Should not flag loop over populated array');
    });
});
