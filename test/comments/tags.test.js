const assert = require('assert');
const { matchTag } = require('../../app/lang/comments/tags');

suite('BML Better Comments - tags', () => {
    test('matches symbol tags right after the comment marker', () => {
        assert.strictEqual(matchTag(' ! careful here', true), '!');
        assert.strictEqual(matchTag(' ? why does this work', true), '?');
        assert.strictEqual(matchTag(' * highlighted note', true), '*');
    });

    test('matches word tags case-insensitively', () => {
        assert.strictEqual(matchTag(' TODO: fix this', true), 'todo');
        assert.strictEqual(matchTag(' todo fix this', true), 'todo');
        assert.strictEqual(matchTag(' FIXME later', true), 'fixme');
        assert.strictEqual(matchTag(' hack: temporary workaround', true), 'hack');
        assert.strictEqual(matchTag(' XXX revisit', true), 'xxx');
        assert.strictEqual(matchTag(' Note: see caller', true), 'note');
    });

    test('// (commented-out code) only matches in line comments, not block comments', () => {
        assert.strictEqual(matchTag('//old code', true), '//');
        assert.strictEqual(matchTag('//old code', false), null);
    });

    test('returns null for ordinary comments with no tag', () => {
        assert.strictEqual(matchTag(' just a normal comment', true), null);
        assert.strictEqual(matchTag(' Function Name: foo', true), null);
    });

    test('word tags require a word boundary (todoist is not todo)', () => {
        assert.strictEqual(matchTag(' todoist app idea', true), null);
    });
});
