const assert = require('assert');
const { lintText } = require('../linter/fixtures');
const { splitIdentifier } = require('../../app/lang/spellCheck/spelling');

suite('BML Linter Test Suite - Custom Spellchecker - identifier splitting edge cases', () => {
    test('splitIdentifier handles a leading underscore (CPQ system variable style)', () => {
        assert.deepStrictEqual(splitIdentifier('_user_name'), ['user', 'name']);
        assert.deepStrictEqual(splitIdentifier('_site_url'), ['site', 'url']);
    });

    test('splitIdentifier handles a single all-uppercase acronym word with no boundary', () => {
        assert.deepStrictEqual(splitIdentifier('XML'), ['XML']);
        assert.deepStrictEqual(splitIdentifier('ID'), ['ID']);
    });

    test('splitIdentifier handles consecutive camelCase humps (3+ words)', () => {
        assert.deepStrictEqual(splitIdentifier('getOneAssetState'), ['get', 'One', 'Asset', 'State']);
    });

    test('splitIdentifier on a purely numeric token returns no sub-words', () => {
        assert.deepStrictEqual(splitIdentifier('12345'), []);
    });

    test('Does not flag a CPQ attribute dotted-access read whose sub-words are all real words', () => {
        const diagnostics = lintText(`
            price = line.unitPrice;
            status = transaction.approvalStatus;
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.deepStrictEqual(spellingErrors.map(e => e.message), []);
    });

    test('Still flags a genuine misspelling inside a dotted attribute access', () => {
        const diagnostics = lintText(`
            price = line.unitPricee;
            return "";
        `);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.some(e => e.message.includes('Pricee')), 'Should flag the misspelled "Pricee" sub-word');
    });
});
