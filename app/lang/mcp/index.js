const { startMcpServer, stopMcpServer, getMcpServerStatus } = require('./server');

function registerMcp(context) {
    const vscode = require('vscode');

    const getSettings = () => {
        const cfg = vscode.workspace.getConfiguration('cpqBml');
        return {
            enable: cfg.get('mcp.enable', false),
            port: cfg.get('mcp.port', 47821),
        };
    };

    const ensureStarted = async () => {
        const { enable, port } = getSettings();
        if (!enable) return { started: false, reason: 'cpqBml.mcp.enable is false' };
        try {
            const result = await startMcpServer(context, vscode, port);
            return { started: true, port: result.port };
        } catch (err) {
            return { started: false, reason: err && err.message ? err.message : String(err) };
        }
    };

    context.subscriptions.push({ dispose: stopMcpServer });

    // Auto-start on activation if the user has already opted in.
    ensureStarted();

    context.subscriptions.push(
        vscode.commands.registerCommand('cpqBml.mcp.showInfo', async () => {
            let status = getMcpServerStatus();
            if (!status.running) {
                const result = await ensureStarted();
                if (!result.started) {
                    vscode.window.showErrorMessage(
                        `CPQ-BML: MCP server is not running (${result.reason}). Enable "cpqBml.mcp.enable" in settings, then run this command again.`,
                    );
                    return;
                }
                status = { running: true, port: result.port };
            }
            const url = `http://127.0.0.1:${status.port}/mcp`;
            vscode.window.showInformationMessage(
                `CPQ-BML: MCP server is running at ${url} (localhost only - no credentials are ever exposed to a connecting client).`,
            );
        }),
    );
}

module.exports = { registerMcp };
