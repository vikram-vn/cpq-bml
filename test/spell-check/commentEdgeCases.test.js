const assert = require('assert');
const { lintText } = require('../linter/fixtures');

suite('BML Linter Test Suite - Custom Spellchecker - comment text edge cases', () => {
    test('Does not flag numbers, percentages, or dates mentioned in comments', () => {
        const diagnostics = lintText(`
            // Discount is capped at 15% for Q1 2026, effective 01/15/2026
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag plural and possessive forms in comments', () => {
        const diagnostics = lintText(`
            // Loop through all the lines' attributes and the customer's orders
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Does not flag a block comment spanning multiple lines', () => {
        const diagnostics = lintText(`
            /*
             * Name: getEncodedDict
             * Description: Encodes a dictionary into a query string
             * Returns: String
             */
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Flags a genuine misspelling inside a block comment', () => {
        const diagnostics = lintText(`
            /*
             * This functoin encodes a dictionary
             */
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.some(e => e.message.includes('functoin')));
    });
});
