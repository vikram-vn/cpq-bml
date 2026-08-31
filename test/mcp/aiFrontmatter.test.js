const assert = require('assert');
const { parseSkillFrontmatter } = require('../../app/ai/setup/index.js');

suite('parseSkillFrontmatter', () => {
    test('extracts an inline scalar description', () => {
        const { name, description } = parseSkillFrontmatter('---\nname: foo\ndescription: A short description.\n---\nBody text.');
        assert.strictEqual(name, 'foo');
        assert.strictEqual(description, 'A short description.');
    });

    test('extracts a quoted inline scalar description, stripping the quotes', () => {
        const { description } = parseSkillFrontmatter('---\ndescription: "Quoted description."\n---\nBody.');
        assert.strictEqual(description, 'Quoted description.');
    });

    test('extracts a folded block scalar (>-) description spanning multiple indented lines', () => {
        const { description } = parseSkillFrontmatter(
            '---\nname: bml-language\ndescription: >-\n  Core BML language skill. Covers all syntax, data types,\n  BMQL, and coding conventions.\n---\n# Body\n'
        );
        assert.strictEqual(description, 'Core BML language skill. Covers all syntax, data types, BMQL, and coding conventions.');
    });

    test('returns the trimmed body with frontmatter stripped', () => {
        const { body } = parseSkillFrontmatter('---\nname: foo\ndescription: d\n---\n\n# Heading\n\nSome content.\n');
        assert.strictEqual(body, '# Heading\n\nSome content.');
    });

    test('falls back to an empty description and the raw content as body when there is no frontmatter', () => {
        const { name, description, body } = parseSkillFrontmatter('# Just a heading\nNo frontmatter here.');
        assert.strictEqual(name, null);
        assert.strictEqual(description, '');
        assert.strictEqual(body, '# Just a heading\nNo frontmatter here.');
    });

    test('handles a folded block scalar using the | (literal) indicator, not just >-', () => {
        const { description } = parseSkillFrontmatter('---\ndescription: |-\n  Literal style description.\n---\nBody.');
        assert.strictEqual(description, 'Literal style description.');
    });
});
