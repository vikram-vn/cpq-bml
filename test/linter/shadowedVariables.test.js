const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - Shadowed Variables', () => {
    test('flags loop variable that shadows outer assignment', () => {
        const diags = lintText(`
            item = "outer";
            for item in myArray {
                print(item);
            }
            return item;
        `);
        const shadowDiags = diags.filter(d => d.code === 'bml-shadowed-variable');
        assert.ok(shadowDiags.length > 0, 'Should flag loop var shadowing outer variable');
    });

    test('does not flag loop variable that is new (not previously declared)', () => {
        const diags = lintText(`
            for freshVar in myArray {
                print(freshVar);
            }
            return "";
        `);
        const shadowDiags = diags.filter(d => d.code === 'bml-shadowed-variable');
        assert.strictEqual(shadowDiags.length, 0, 'Should not flag brand-new loop variable');
    });

    test('flags only the variable that shadows, not others', () => {
        const diags = lintText(`
            x = "outer x";
            y = "outer y";
            for x in arr1 {
                print(x);
            }
            for z in arr2 {
                print(z);
            }
            return x;
        `);
        const shadowDiags = diags.filter(d => d.code === 'bml-shadowed-variable');
        assert.strictEqual(shadowDiags.length, 1, 'Should flag only x, not z');
    });
});
