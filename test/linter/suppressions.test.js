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

    test('suppression directives with trailing explanations/comments work correctly', () => {
        const diags = lintText(`
            // bml-lint-disable-next-line (some explanation about dividing by zero)
            x = 10 / 0;
            
            y = 10 / 0; // bml-lint-disable-line (disable on current line)
            
            // bml-lint-disable-file (entire file disable)
            z = 10 / 0;
        `);
        assert.strictEqual(diags.length, 0, 'All diagnostics should be successfully suppressed');
    });

    test('suppression edge cases: multi-line block comments, no-space, commas, and multiple codes', () => {
        // 1. Single-line block comment with disable-next-line
        const diags1 = lintText(`
            /* bml-lint-disable-next-line */
            x = 10 / 0;
        `);
        assert.strictEqual(diags1.length, 0, 'Should suppress next line after block comment');

        // 2. No-space directive
        const diags2 = lintText(`
            y = 10 / 0; //bml-lint-disable-line
        `);
        assert.strictEqual(diags2.length, 0, 'Should suppress with no-space directive');

        // 3. Multiple codes separated by space and comma
        const diags3 = lintText(`
            // bml-lint-disable-next-line bml-operator-fix, bml-spelling-error (with explanation)
            z = 10 / 0;
        `);
        const divDiags = diags3.filter(d => d.message.includes("Division by literal zero"));
        assert.strictEqual(divDiags.length, 1, 'Should NOT suppress division by zero because only operator and spelling were disabled');
    });

    test('suppression edge cases: mixed casing, whitespaces/tabs, same-line block comments, and code prefix filtering', () => {
        // 1. Mixed casing
        const diags1 = lintText(`
            // Bml-Lint-Disable-Next-Line
            x = 10 / 0;
        `);
        assert.strictEqual(diags1.length, 0, 'Should suppress with mixed-case directive');

        // 2. Tabs and extra whitespaces
        const diags2 = lintText(`
            y = 10 / 0; // \t  bml-lint-disable-line  \t
        `);
        assert.strictEqual(diags2.length, 0, 'Should suppress with tabs and trailing whitespaces');

        // 3. Same-line block comment
        const diags3 = lintText(`
            z = 10 / 0; /* bml-lint-disable-line */
        `);
        assert.strictEqual(diags3.length, 0, 'Should suppress with same-line block comment');

        // 4. Invalid bml- prefixed code vs non-bml- prefixed explanation
        const diags4 = lintText(`
            a = 10 / 0; // bml-lint-disable-line bml-some-other-code
        `);
        assert.strictEqual(diags4.filter(d => d.message.includes("Division by literal zero")).length, 1, 'Should NOT suppress when an invalid bml- prefixed code is specified');

        const diags5 = lintText(`
            b = 10 / 0; // bml-lint-disable-line some-other-code
        `);
        assert.strictEqual(diags5.filter(d => d.message.includes("Division by literal zero")).length, 0, 'Should suppress when a non-bml- prefixed explanation is specified');
    });
});
