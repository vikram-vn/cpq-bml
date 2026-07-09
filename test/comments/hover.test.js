const assert = require('assert');
const { getHoverMarkdown } = require('../../app/lang/comments/hover');

suite('BML Better Comments - hover', () => {
    test('explains a bml-lint-disable-line directive with explicit codes', () => {
        const text = 'x = NaN // bml-lint-disable-line bml-nan-fix\n';
        const offset = text.indexOf('bml-lint-disable-line');
        const markdown = getHoverMarkdown(text, offset);
        assert.ok(markdown.includes('bml-lint-disable-line'));
        assert.ok(markdown.includes('bml-nan-fix'));
    });

    test('explains a bare bml-lint-disable as applying to every diagnostic', () => {
        const text = '// bml-lint-disable\nx = 1\n';
        const markdown = getHoverMarkdown(text, text.indexOf('bml-lint-disable'));
        assert.ok(markdown.includes('every diagnostic'));
    });

    test('explains a beautify ignore:start marker', () => {
        const text = '/* beautify ignore:start */\nx    =    1;\n/* beautify ignore:end */\n';
        const markdown = getHoverMarkdown(text, text.indexOf('beautify ignore:start'));
        assert.ok(markdown.includes('beautify ignore:start'));
        assert.ok(markdown.toLowerCase().includes('untouched'));
    });

    test('returns null when hovering an ordinary tagged comment', () => {
        const text = '// TODO: fix this later\n';
        assert.strictEqual(getHoverMarkdown(text, text.indexOf('TODO')), null);
    });

    test('returns null when the offset is not inside any comment', () => {
        const text = 'x = 1;\n// bml-lint-disable\n';
        assert.strictEqual(getHoverMarkdown(text, 0), null);
    });
});
