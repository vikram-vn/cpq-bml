const assert = require('assert');
const vscode = require('vscode');
const { lintText } = require('../linter/fixtures');
const { activateExtension } = require('../extensionHelper');
const { getSpellingSuggestions, splitIdentifier, cleanCommentText } = require('../../app/lang/spell-check/spelling');

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

    test('Provides correct spelling suggestions and preserves case', () => {
        const suggestions = getSpellingSuggestions('mispelled');
        assert.ok(suggestions.length > 0, 'Should return suggestions for mispelled');
        assert.ok(suggestions.includes('misspelled'), 'Suggestions should include correct word "misspelled"');

        const upperSuggestions = getSpellingSuggestions('MISPELLED');
        assert.ok(upperSuggestions.includes('MISSPELLED'), 'Suggestions should preserve uppercase');

        const titleSuggestions = getSpellingSuggestions('Mispelled');
        assert.ok(titleSuggestions.includes('Misspelled'), 'Suggestions should preserve titlecase');
    });

    test('splitIdentifier splits camelCase and snake_case correctly', () => {
        assert.deepStrictEqual(splitIdentifier('customerName'), ['customer', 'Name']);
        assert.deepStrictEqual(splitIdentifier('max_discount_value'), ['max', 'discount', 'value']);
        assert.deepStrictEqual(splitIdentifier('XMLDocument'), ['XML', 'Document']);
        assert.deepStrictEqual(splitIdentifier('v1_discount_rate2'), ['v', 'discount', 'rate']);
    });

    test('cleanCommentText strips URLs and contraction suffixes', () => {
        const cleaned = cleanCommentText("Visit http://test.com or ask Vikram's team who didn't write it's code.");
        assert.ok(!cleaned.includes('http://test.com'));
        assert.ok(cleaned.includes('Vikram'));
        assert.ok(cleaned.includes('who'));
        assert.ok(cleaned.includes('code'));
    });

    test('cleanCommentText preserves string length to keep correct offsets', () => {
        const original = "Visit http://test.com or ask Vikram's team who didn't write it's code.";
        const cleaned = cleanCommentText(original);
        assert.strictEqual(cleaned.length, original.length, 'Cleaned string must have exactly the same length as the original');
    });

    test('Diagnostics ranges are correct when preceding text contains URLs/contractions', () => {
        const code = '// Check http://google.com mispelled word';
        const diagnostics = lintText(code);
        const spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
        assert.ok(spellingErrors.length > 0, 'Should find spelling error');
        const err = spellingErrors.find(e => e.message.includes('mispelled'));
        assert.ok(err, 'Should find mispelled error');
        assert.strictEqual(err.range.start.character, 27, 'Should start at the correct character index');
        assert.strictEqual(err.range.end.character, 36, 'Should end at the correct character index');
    });

    test('Respects cpqBml.features.spelling config setting', async function () {
        this.timeout(15000);
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

    test('Respects userWords dictionary additions', async function () {
        this.timeout(15000);
        const config = vscode.workspace.getConfiguration('cpqBml');
        const originalUserWords = config.get('spelling.userWords');

        try {
            // "customword" should be flagged as misspelled by default
            let diagnostics = lintText('// customword');
            let spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
            assert.ok(spellingErrors.some(e => e.message.includes('customword')), 'Should flag unrecognized word customword');

            // Add "customword" to userWords config
            await config.update('spelling.userWords', ['customword'], vscode.ConfigurationTarget.Global);
            diagnostics = lintText('// customword');
            spellingErrors = diagnostics.filter(d => d.code === 'bml-spelling-error');
            assert.strictEqual(spellingErrors.length, 0, 'Spelling errors should NOT be flagged for words in userWords');

            // Get spelling suggestions for "customwrd" when "customword" is in userWords
            const suggestions = getSpellingSuggestions('customwrd');
            assert.ok(suggestions.includes('customword'), 'Suggestions should include the configured userWord customword');

        } finally {
            await config.update('spelling.userWords', originalUserWords, vscode.ConfigurationTarget.Global);
        }
    });

    test('Add spelling word commands work correctly', async function () {
        this.timeout(15000);
        await activateExtension(vscode);
        const config = vscode.workspace.getConfiguration('cpqBml');
        const originalUserWords = config.get('spelling.userWords');

        try {
            // Trigger command to add a word globally
            await vscode.commands.executeCommand('cpqBml.spelling.addUserWord', 'globaltestword');
            let userWords = vscode.workspace.getConfiguration('cpqBml').get('spelling.userWords') || [];
            assert.ok(userWords.includes('globaltestword'), 'addUserWord command should append word to userWords settings');

            // Reset list and trigger command to add a word to workspace
            await vscode.workspace.getConfiguration('cpqBml').update('spelling.userWords', originalUserWords, vscode.ConfigurationTarget.Global);
            await vscode.commands.executeCommand('cpqBml.spelling.addWorkspaceWord', 'workspacetestword');
            userWords = vscode.workspace.getConfiguration('cpqBml').get('spelling.userWords') || [];
            assert.ok(userWords.includes('workspacetestword'), 'addWorkspaceWord command should append word to userWords settings');
        } finally {
            await vscode.workspace.getConfiguration('cpqBml').update('spelling.userWords', originalUserWords, vscode.ConfigurationTarget.Global);
            try {
                await vscode.workspace.getConfiguration('cpqBml').update('spelling.userWords', undefined, vscode.ConfigurationTarget.Workspace);
            } catch (e) {}
        }
    });
});
