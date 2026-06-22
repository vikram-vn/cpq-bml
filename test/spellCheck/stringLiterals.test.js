const assert = require('assert');
const { lintText } = require('../linter/fixtures');

suite('BML Linter Test Suite - Custom Spellchecker - string literal handling', () => {
    test('Ignores BMQL query string content', () => {
        const diagnostics = lintText(`
            result = bmql("SELECT custmer_id FROM ordrs WHERE status = 'active'");
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Ignores JSON-shaped string literals', () => {
        const diagnostics = lintText(`
            payload = '{"custmerId": "123", "qty": 5}';
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Ignores file paths and URLs inside string literals', () => {
        const diagnostics = lintText(`
            p = "C:\\\\Usrs\\\\confgi\\\\file.txt";
            u = "https://exmaple.com/api/v1/resourc";
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Flags a genuine misspelling inside an ordinary string literal', () => {
        const diagnostics = lintText(`
            message = "This functoin failed unexpectedly";
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.some(e => e.message.includes('functoin')), 'Should flag "functoin" inside the string');
    });

    test('Does not flag short (<=2 char) words inside string literals', () => {
        const diagnostics = lintText(`
            s = "ok go to it as is";
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });
});
