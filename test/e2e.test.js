const assert = require('assert');
const vscode = require('vscode');
const { activateExtension } = require('./extensionHelper');

suite('CPQ-BML End-to-End Command Registration & Flow Verification', () => {
    suiteSetup(async () => {
        await activateExtension(vscode);
    });

    test('All CPQ-BML extension commands are successfully registered in VS Code', async () => {
        const registered = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'cpqBml.settings.open',
            'cpqBml.beautifyWorkspace',
            'cpqBml.rest.setPassword',
            'cpqBml.rest.setAuthToken',
            'cpqBml.rest.pullLibraryFunctions',
            'cpqBml.rest.pullCommerceFunctions',
            'cpqBml.rest.validateCurrentFile',
            'cpqBml.rest.debugCurrentFile',
            'cpqBml.rest.saveCurrentFile',
            'cpqBml.rest.clearResults',
            'cpqBml.rest.createOverride',
            'cpqBml.rest.removeOverride',
            'cpqBml.rest.deployCommerceProcess',
            'cpqBml.rest.deployCurrentFile',
            'cpqBml.rest.deployUtilFunctions',
            'cpqBml.rest.createBmlFunction',
            'cpqBml.rest.changeEnvironment',
            'cpqBml.mcp.showInfo'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(registered.includes(cmd), `Command ${cmd} should be registered`);
        }
    });

    test('Opening Settings panel command executes without crashing', async () => {
        await assert.doesNotReject(async () => {
            await vscode.commands.executeCommand('cpqBml.settings.open');
        }, 'cpqBml.settings.open command should run without throwing errors');
    });

    test('Showing MCP server info command handles showInfo flow without crashing', async () => {
        const originalShowErr = vscode.window.showErrorMessage;
        let errMsg = '';
        vscode.window.showErrorMessage = async (msg) => {
            errMsg = msg;
            return undefined;
        };

        try {
            await vscode.commands.executeCommand('cpqBml.mcp.showInfo');
            assert.ok(errMsg.includes('MCP server is not running') || errMsg.includes('running at'), 'Expected MCP status message');
        } finally {
            vscode.window.showErrorMessage = originalShowErr;
        }
    });
});
