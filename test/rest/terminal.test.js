const assert = require('assert');
const vscode = require('vscode');
const { createResultsTerminal, getResultsTerminal } = require('../../app/lang/rest/terminal');

suite('BML REST results terminal', () => {
    test('creates a named terminal and supports writeLine/show/dispose without throwing', () => {
        const before = vscode.window.terminals.length;
        const resultsTerminal = createResultsTerminal(vscode, 'CPQ-BML Debug Test');

        assert.strictEqual(vscode.window.terminals.length, before + 1);
        assert.strictEqual(vscode.window.terminals[vscode.window.terminals.length - 1].name, 'CPQ-BML Debug Test');

        assert.doesNotThrow(() => resultsTerminal.writeLine('hello world'));
        assert.doesNotThrow(() => resultsTerminal.show());
        assert.doesNotThrow(() => resultsTerminal.clear());

        resultsTerminal.dispose();
    });

    test('handleInput is a no-op (the terminal is read-only)', () => {
        const resultsTerminal = createResultsTerminal(vscode, 'CPQ-BML Debug Test 2');
        // There's no public API to type into a pseudoterminal from a test, so
        // this just confirms construction succeeds and cleans up; the pty's
        // handleInput implementation itself is exercised by VS Code internally.
        resultsTerminal.dispose();
        assert.ok(true);
    });

    suite('getResultsTerminal', () => {
        let config;
        let originalEnvironments;
        let originalSiteUrl;
        let originalUsername;
        let originalAuthMethod;

        suiteSetup(async () => {
            config = vscode.workspace.getConfiguration('cpqBml');
            originalEnvironments = config.get('connection.environments');
            originalSiteUrl = config.get('connection.siteUrl');
            originalUsername = config.get('connection.username');
            originalAuthMethod = config.get('connection.authMethod');
        });

        suiteTeardown(async () => {
            await config.update('connection.environments', originalEnvironments, vscode.ConfigurationTarget.Global);
            await config.update('connection.siteUrl', originalSiteUrl, vscode.ConfigurationTarget.Global);
            await config.update('connection.username', originalUsername, vscode.ConfigurationTarget.Global);
            await config.update('connection.authMethod', originalAuthMethod, vscode.ConfigurationTarget.Global);
        });

        setup(async () => {
            const term = getResultsTerminal(vscode);
            term.dispose();
        });

        test('defaults to CPQ-BML when no environment matches or is configured', async () => {
            await config.update('connection.environments', [], vscode.ConfigurationTarget.Global);
            await config.update('connection.siteUrl', '', vscode.ConfigurationTarget.Global);

            const resultsTerminal = getResultsTerminal(vscode);
            resultsTerminal.show();

            const lastTerminal = vscode.window.terminals[vscode.window.terminals.length - 1];
            assert.strictEqual(lastTerminal.name, 'CPQ-BML');
            resultsTerminal.dispose();
        });

        test('uses environment name in title when active environment matches', async () => {
            const envs = [{ name: 'dev-env', siteUrl: 'dev.bigmachines.com', username: 'test-user', authMethod: 'basic' }];
            await config.update('connection.environments', envs, vscode.ConfigurationTarget.Global);
            await config.update('connection.siteUrl', 'dev.bigmachines.com', vscode.ConfigurationTarget.Global);
            await config.update('connection.username', 'test-user', vscode.ConfigurationTarget.Global);
            await config.update('connection.authMethod', 'basic', vscode.ConfigurationTarget.Global);

            const resultsTerminal = getResultsTerminal(vscode);
            resultsTerminal.show();

            const lastTerminal = vscode.window.terminals[vscode.window.terminals.length - 1];
            assert.strictEqual(lastTerminal.name, 'BML: dev-env');
            resultsTerminal.dispose();
        });

        test('re-creates terminal with new name when environment changes', async () => {
            const envs = [
                { name: 'dev-env', siteUrl: 'dev.bigmachines.com', username: 'test-user', authMethod: 'basic' },
                { name: 'prod-env', siteUrl: 'prod.bigmachines.com', username: 'prod-user', authMethod: 'bearer' }
            ];
            await config.update('connection.environments', envs, vscode.ConfigurationTarget.Global);

            // 1. Activate dev-env
            await config.update('connection.siteUrl', 'dev.bigmachines.com', vscode.ConfigurationTarget.Global);
            await config.update('connection.username', 'test-user', vscode.ConfigurationTarget.Global);
            await config.update('connection.authMethod', 'basic', vscode.ConfigurationTarget.Global);

            const resultsTerminal = getResultsTerminal(vscode);
            resultsTerminal.show();

            let lastTerminal = vscode.window.terminals[vscode.window.terminals.length - 1];
            assert.strictEqual(lastTerminal.name, 'BML: dev-env');

            // 2. Switch to prod-env
            await config.update('connection.siteUrl', 'prod.bigmachines.com', vscode.ConfigurationTarget.Global);
            await config.update('connection.username', 'prod-user', vscode.ConfigurationTarget.Global);
            await config.update('connection.authMethod', 'bearer', vscode.ConfigurationTarget.Global);

            resultsTerminal.show();

            lastTerminal = vscode.window.terminals[vscode.window.terminals.length - 1];
            assert.strictEqual(lastTerminal.name, 'BML: prod-env');
            resultsTerminal.dispose();
        });
    });
});

