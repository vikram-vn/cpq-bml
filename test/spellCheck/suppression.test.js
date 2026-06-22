const assert = require('assert');
const { lintText } = require('../linter/fixtures');

suite('BML Linter Test Suite - Custom Spellchecker - suppression directive integration', () => {
    test('// bml-lint-disable-line bml-spelling-error suppresses a spelling diagnostic on that line', () => {
        const diagnostics = lintText(`
            mispelledVar = 1; // bml-lint-disable-line bml-spelling-error
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('// bml-lint-disable-next-line bml-spelling-error suppresses the following line only', () => {
        const diagnostics = lintText(`
            // bml-lint-disable-next-line bml-spelling-error
            mispelledVar = 1;
            anotherMispelledVar = 2;
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.strictEqual(spellingErrors.length, 1, 'Only the un-suppressed line should still be flagged');
        assert.ok(spellingErrors[0].message.includes('Mispelled') || spellingErrors[0].message.includes('mispelled'));
    });

    test('A targeted disable for a different code does not suppress spelling diagnostics', () => {
        const diagnostics = lintText(`
            mispelledVar = 1; // bml-lint-disable-line bml-unused-expression
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.length > 0, 'Spelling diagnostic should still surface since only a different code was disabled');
    });
});
