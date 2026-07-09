const assert = require('assert');
const { describeLintDirective, describeBeautifyDirective, describeDirective } = require('../../app/lang/comments/directives');

suite('BML Better Comments - directives', () => {
    test('describeLintDirective recognizes every bml-lint-* variant', () => {
        assert.deepStrictEqual(describeLintDirective('// bml-lint-disable'), { type: 'disable', codes: [] });
        assert.deepStrictEqual(describeLintDirective('// bml-lint-disable-line'), { type: 'disable-line', codes: [] });
        assert.deepStrictEqual(describeLintDirective('// bml-lint-disable-next-line'), { type: 'disable-next-line', codes: [] });
        assert.deepStrictEqual(describeLintDirective('// bml-lint-disable-file'), { type: 'disable-file', codes: [] });
        assert.deepStrictEqual(describeLintDirective('// bml-lint-enable'), { type: 'enable', codes: [] });
    });

    test('describeLintDirective captures listed codes', () => {
        assert.deepStrictEqual(
            describeLintDirective('// bml-lint-disable-line bml-nan-fix bml-missing-semicolon'),
            { type: 'disable-line', codes: ['bml-nan-fix', 'bml-missing-semicolon'] }
        );
    });

    test('describeLintDirective returns null for ordinary comments', () => {
        assert.strictEqual(describeLintDirective('// just a comment'), null);
    });

    test('describeBeautifyDirective recognizes ignore:start and ignore:end', () => {
        assert.deepStrictEqual(describeBeautifyDirective('/* beautify ignore:start */'), { type: 'beautify-ignore', mode: 'start' });
        assert.deepStrictEqual(describeBeautifyDirective('/* beautify ignore:end */'), { type: 'beautify-ignore', mode: 'end' });
    });

    test('describeBeautifyDirective returns null for ordinary comments', () => {
        assert.strictEqual(describeBeautifyDirective('/* just a comment */'), null);
    });

    test('describeDirective dispatches to lint or beautify, or null', () => {
        assert.deepStrictEqual(describeDirective('// bml-lint-disable'), { kind: 'lint', type: 'disable', codes: [] });
        assert.deepStrictEqual(describeDirective('/* beautify ignore:start */'), { kind: 'beautify', type: 'beautify-ignore', mode: 'start' });
        assert.strictEqual(describeDirective('// TODO: fix this'), null);
    });
});
