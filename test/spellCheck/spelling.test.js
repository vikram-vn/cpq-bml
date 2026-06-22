const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../linter/fixtures');
const { getSpellingSuggestions, splitIdentifier, cleanCommentText } = require('../../app/lang/spellCheck/spelling');

suite('BML Linter Test Suite - Custom Spellchecker', () => {
    test('Does not flag correct English words and BML built-ins', () => {
        const diagnostics = lintText(`
            // This is a correct comment with valid words.
            customerName = "USD"; 
            strtojavadate("2026-06-22");
            return "";
        `);

        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.strictEqual(spellingErrors.length, 0, 'Should not find spelling errors in valid code');
    });

    test('Flags misspelled words in comments', () => {
        const diagnostics = lintText(`
            // This contains a mispelled word here.
            return "";
        `);

        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.length > 0, 'Should flag misspelled words in comments');
        const err = spellingErrors.find(e => e.message.includes('mispelled'));
        assert.ok(err, 'Should specifically flag the word "mispelled"');
        assert.strictEqual(err.severity, vscode.DiagnosticSeverity.Information);
    });

    test('Flags misspelled sub-words in camelCase or snake_case identifiers', () => {
        const diagnostics = lintText(`
            mispelledVarName = 1;
            calculated_discout = 2;
            return "";
        `);

        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.length >= 2, 'Should flag misspelled parts of identifiers');
        assert.ok(spellingErrors.some(e => e.message.includes('mispelled')), 'Should flag mispelled');
        assert.ok(spellingErrors.some(e => e.message.includes('discout')), 'Should flag discout');
    });

    test('Ignores technical acronyms, SQL keywords, and URLs', () => {
        const diagnostics = lintText(`
            // Check out http://google.com/search?q=test
            // TODO: fix JSON format
            sqlQuery = "SELECT id, name FROM table WHERE status = 'active'";
            return "";
        `);

        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.strictEqual(spellingErrors.length, 0, 'Should ignore URLs, technical acronyms, and SQL strings');
    });

    test('Provides correct spelling suggestions', () => {
        const suggestions = getSpellingSuggestions('mispelled');
        assert.ok(suggestions.length > 0, 'Should return suggestions for mispelled');
        assert.ok(suggestions.includes('misspelled'), 'Suggestions should include correct word "misspelled"');
    });

    test('splitIdentifier splits camelCase and snake_case correctly', () => {
        assert.deepStrictEqual(splitIdentifier('customerName'), ['customer', 'Name']);
        assert.deepStrictEqual(splitIdentifier('max_discount_value'), ['max', 'discount', 'value']);
        assert.deepStrictEqual(splitIdentifier('XMLDocument'), ['XML', 'Document']);
    });

    test('cleanCommentText strips URLs and contraction suffixes', () => {
        const cleaned = cleanCommentText("Visit http://test.com or ask Vikram's team who didn't write it's code.");
        assert.ok(!cleaned.includes('http://test.com'));
        assert.ok(cleaned.includes('Vikram'));
        assert.ok(cleaned.includes('who'));
        assert.ok(cleaned.includes('code'));
    });

    test('Respects cpqBml.features.spelling config setting', async () => {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const originalSpelling = config.get('features.spelling');
        
        try {
            // By default (true), it should flag misspelled words
            let diagnostics = lintText('// mispelled');
            let spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
            assert.ok(spellingErrors.length > 0, 'Spelling errors should be flagged when enabled');

            // Disable features.spelling
            await config.update('features.spelling', false, vscode.ConfigurationTarget.Global);
            diagnostics = lintText('// mispelled');
            spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
            assert.strictEqual(spellingErrors.length, 0, 'Spelling errors should NOT be flagged when features.spelling is disabled');
            
            // Re-enable features.spelling
            await config.update('features.spelling', true, vscode.ConfigurationTarget.Global);
            diagnostics = lintText('// mispelled');
            spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
            assert.ok(spellingErrors.length > 0, 'Spelling errors should be flagged when enabled again');
        } finally {
            await config.update('features.spelling', originalSpelling, vscode.ConfigurationTarget.Global);
        }
    });
});
