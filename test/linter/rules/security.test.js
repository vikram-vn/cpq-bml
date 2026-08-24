const assert = require('assert');
const { lintText } = require('../fixtures');

suite('BML Linter Test Suite - security-sensitive literals', () => {
    suite('Hardcoded credentials (bml-hardcoded-credential)', () => {
        test('Flags a hardcoded password literal', () => {
            const diagnostics = lintText(`
                adminPassword = "bigmachines2011";
                return adminPassword;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-credential');
            assert.ok(diag, 'Should flag a variable named *password* assigned a literal string');
            assert.ok(diag.message.includes('adminPassword'));
        });

        test('Flags a hardcoded apiKey literal', () => {
            const diagnostics = lintText(`
                serviceApiKey = "sk-abc123xyz789";
                return serviceApiKey;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-credential');
            assert.ok(diag, 'Should flag a variable named *apiKey* assigned a literal string');
        });

        test('Does not flag an empty-string placeholder init', () => {
            const diagnostics = lintText(`
                password = "";
                return password;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-credential');
            assert.strictEqual(diag, undefined, 'An empty init is not itself a leaked credential');
        });

        test('Does not flag a common placeholder value', () => {
            const diagnostics = lintText(`
                password = "changeme";
                return password;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-credential');
            assert.strictEqual(diag, undefined, 'Known placeholder values are excluded to avoid noise on boilerplate');
        });

        test('Does not flag a credential read from a function call', () => {
            const diagnostics = lintText(`
                password = getvalue("sysPassword");
                return password;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-credential');
            assert.strictEqual(diag, undefined, 'Only a direct string literal assignment is a hardcoded secret');
        });
    });

    suite('Hardcoded URLs (bml-hardcoded-url)', () => {
        test('Flags a hardcoded https URL', () => {
            const diagnostics = lintText(`
                endpoint = "https://api.example.com/v1/resource";
                return endpoint;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-url');
            assert.ok(diag, 'Should flag a hardcoded URL literal');
        });

        test('Does not flag a well-known schema URI', () => {
            const diagnostics = lintText(`
                ns = "https://www.w3.org/2001/XMLSchema";
                return ns;
            `);
            const diag = diagnostics.find(d => d.code === 'bml-hardcoded-url');
            assert.strictEqual(diag, undefined, 'w3.org schema URIs are excluded');
        });
    });
});
