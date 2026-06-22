const assert = require('assert');
const { lintText } = require('./fixtures');

suite('BML Linter Test Suite - // bml-lint-disable comment directives', () => {
    test('bml-lint-disable-next-line suppresses every diagnostic on the next line', () => {
        const diags = lintText('// bml-lint-disable-next-line\nx = 5\ny = 6\n');
        const missingSemiLines = diags.filter(d => d.message.includes('Missing semicolon')).map(d => d.range.start.line);
        assert.deepStrictEqual(missingSemiLines, [2]);
    });

    test('bml-lint-disable-line suppresses every diagnostic on that line', () => {
        const diags = lintText('x = 5 // bml-lint-disable-line\ny = 6\n');
        const missingSemiLines = diags.filter(d => d.message.includes('Missing semicolon')).map(d => d.range.start.line);
        assert.deepStrictEqual(missingSemiLines, [1]);
    });

    test('bml-lint-disable-line with a specific code only suppresses that rule', () => {
        const diags = lintText('a = NaN // bml-lint-disable-line bml-nan-fix\nb = NaN\n');
        const nanLines = diags.filter(d => d.message.includes("constant 'NaN'")).map(d => d.range.start.line);
        assert.deepStrictEqual(nanLines, [1]);
    });

    test('bml-lint-disable / bml-lint-enable suppresses a block of lines', () => {
        const diags = lintText('a = 1\n// bml-lint-disable\nb = 2\nc = 3\n// bml-lint-enable\nd = 4\n');
        const missingSemiLines = diags.filter(d => d.message.includes('Missing semicolon')).map(d => d.range.start.line);
        assert.deepStrictEqual(missingSemiLines, [0, 5]);
    });

    test('bml-lint-disable-file suppresses every diagnostic in the file regardless of position', () => {
        const diags = lintText('a = 1\nb = 2\n// bml-lint-disable-file\nc = 3\n');
        const missingSemiDiags = diags.filter(d => d.message.includes('Missing semicolon'));
        assert.strictEqual(missingSemiDiags.length, 0);
    });

    test('a directive inside a string literal is not treated as a real directive', () => {
        const diags = lintText('msg = "bml-lint-disable-next-line";\nx = 5\n');
        const missingSemiLines = diags.filter(d => d.message.includes('Missing semicolon')).map(d => d.range.start.line);
        assert.deepStrictEqual(missingSemiLines, [1]);
    });

    test('describeLintDirective returns expected output', () => {
        const { describeLintDirective } = require('../../app/lang/lint/suppressions');
        assert.deepStrictEqual(describeLintDirective('// bml-lint-disable-line bml-nan-fix bml-missing-semicolon'), {
            type: 'disable-line',
            codes: ['bml-nan-fix', 'bml-missing-semicolon']
        });
        assert.deepStrictEqual(describeLintDirective('// bml-lint-disable'), {
            type: 'disable',
            codes: []
        });
        assert.strictEqual(describeLintDirective('// some other comment'), null);
    });

    test('bml-lint-disable with specific code only suppresses that rule in block', () => {
        const diags = lintText(`
            // bml-lint-disable bml-nan-fix
            a = NaN
            b = 5
            // bml-lint-enable bml-nan-fix
            c = NaN
        `);
        const nanLines = diags.filter(d => d.message.includes("constant 'NaN'")).map(d => d.range.start.line);
        assert.deepStrictEqual(nanLines, [5]); // line 2 is suppressed, line 5 is not

        const semiLines = diags.filter(d => d.message.includes('Missing semicolon')).map(d => d.range.start.line);
        // missing semicolon checks should NOT be suppressed since only bml-nan-fix was disabled
        assert.ok(semiLines.includes(2));
        assert.ok(semiLines.includes(3));
    });
});
