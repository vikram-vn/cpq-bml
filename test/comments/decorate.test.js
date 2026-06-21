const assert = require('assert');
const { buildCommentDecorations } = require('../../app/lang/comments/decorate');

suite('BML Better Comments - buildCommentDecorations', () => {
    test('classifies a tagged comment, a directive, and a doc header into separate buckets', () => {
        const text = [
            '// Function Name : sample',
            '// Description: does a thing',
            '',
            '// TODO: handle the edge case',
            '// bml-lint-disable-next-line',
            'x = 5',
            '/* beautify ignore:start */',
            'y    =    6;',
            '/* beautify ignore:end */'
        ].join('\n');

        const { tags, directives, docHeaders } = buildCommentDecorations(text);

        assert.strictEqual(docHeaders.length, 1);
        assert.ok(text.slice(...docHeaders[0]).includes('Function Name'));

        assert.strictEqual(directives.length, 3);

        assert.ok(tags.has('todo'));
        assert.strictEqual(tags.get('todo').length, 1);
        assert.ok(text.slice(...tags.get('todo')[0]).includes('TODO'));
    });

    test('a comment inside a doc-header block is not double-counted as a tag', () => {
        const text = '// Name: foo\n// TODO: this would be a weird place for a todo\nx = 1;';
        const { tags, docHeaders } = buildCommentDecorations(text);
        assert.strictEqual(docHeaders.length, 1);
        assert.strictEqual(tags.size, 0);
    });

    test('returns empty buckets for code with no comments', () => {
        const { tags, directives, docHeaders } = buildCommentDecorations('x = 1;\ny = 2;\n');
        assert.strictEqual(tags.size, 0);
        assert.strictEqual(directives.length, 0);
        assert.strictEqual(docHeaders.length, 0);
    });
});
