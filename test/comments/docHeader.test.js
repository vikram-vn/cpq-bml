const assert = require('assert');
const { getCommentRanges } = require('../../app/lang/lint/comments');
const { findDocHeaderBlocks } = require('../../app/lang/comments/docHeader');

suite('BML Better Comments - doc header detection', () => {
    test('detects a // Function Name : ... run of line comments (abo_jsonCompare.bml style)', () => {
        const text = [
            '// Function Name : abo_jsonCompare',
            '//   Inputs: jsonObj1(Json), jsonObj2(Json), jsonCritArray(JsonArray)',
            '//   output: 0 if both objects are equal as per jsonCrit\'s in jsonCritArray.',
            '// Description:',
            '//    This utility BML is a supporting function for abo_jsonSort,',
            '',
            'x = 1;'
        ].join('\n');

        const blocks = findDocHeaderBlocks(text, getCommentRanges(text));
        assert.strictEqual(blocks.length, 1);
        const [start, end] = blocks[0];
        assert.ok(text.slice(start, end).includes('Function Name'));
        assert.ok(text.slice(start, end).includes('Description'));
        assert.ok(!text.slice(start, end).includes('x = 1'));
    });

    test('detects a /* Name: ... Description: ... */ block comment (getEncodedDict.bml style)', () => {
        const text = [
            '/*',
            'Name: getEncodedDict',
            'Description: This function returns a dictionary of type String.',
            'Inputs:',
            '    username - String',
            '    password - String',
            'Return: String Dictionary',
            '*/',
            'x = 1;'
        ].join('\n');

        const blocks = findDocHeaderBlocks(text, getCommentRanges(text));
        assert.strictEqual(blocks.length, 1);
        const [start, end] = blocks[0];
        assert.ok(text.slice(start, end).startsWith('/*'));
        assert.ok(text.slice(start, end).endsWith('*/'));
    });

    test('does not flag an ordinary comment block with no header fields', () => {
        const text = '// just explaining what the next line does\n// nothing fancy here\nx = 1;';
        const blocks = findDocHeaderBlocks(text, getCommentRanges(text));
        assert.strictEqual(blocks.length, 0);
    });

    test('does not merge line comments separated by a blank code line', () => {
        const text = '// Name: foo\nx = 1;\n// just a trailing comment\n';
        const blocks = findDocHeaderBlocks(text, getCommentRanges(text));
        assert.strictEqual(blocks.length, 1);
        const [start, end] = blocks[0];
        assert.ok(!text.slice(start, end).includes('trailing'));
    });
});
