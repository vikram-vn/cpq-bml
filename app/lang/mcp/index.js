const vscode = require('vscode');
const pathLib = require('path');
const fs = require('fs');
const { startMcpServer, stopMcpServer, getMcpServerStatus } = require('./server');

function logMcpServerEvent(message) {
    try {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const mcpLogsDir = pathLib.join(workspaceRoot, 'logs', 'mcp-logs');
            fs.mkdirSync(mcpLogsDir, { recursive: true });
            const mcpLogPath = pathLib.join(mcpLogsDir, 'mcp.log');
            const timestamp = new Date().toISOString();
            fs.appendFileSync(mcpLogPath, `[${timestamp}] [Server] ${message}\n`);
        }
    } catch (e) {}
}

function registerMcp(context) {

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
            logMcpServerEvent(`MCP server started on port ${result.port}`);
            return { started: true, port: result.port };
        } catch (err) {
            console.error("MCP SERVER START ERROR:", err);
            logMcpServerEvent(`MCP server failed to start: ${err && err.message ? err.message : String(err)}`);
            return { started: false, reason: err && err.message ? err.message : String(err) };
        }
    };

    context.subscriptions.push({ dispose: () => {
        stopMcpServer();
        logMcpServerEvent("MCP server stopped");
    }});

    // Auto-start on activation if the user has already opted in.
    ensureStarted();

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration('cpqBml.mcp')) return;
        const status = getMcpServerStatus();
        const { enable, port } = getSettings();
        if (!enable) {
            if (status.running) {
                stopMcpServer();
                logMcpServerEvent("MCP server stopped via configuration change");
            }
        } else {
            if (status.running && status.port !== port) {
                stopMcpServer();
                logMcpServerEvent("MCP server stopped for port reconfiguration");
                await ensureStarted();
            } else if (!status.running) {
                await ensureStarted();
            }
        }
    }, null, context.subscriptions);

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

    if (vscode.lm && typeof vscode.lm.registerMcpServerProvider === 'function') {
        context.subscriptions.push(
            vscode.lm.registerMcpServerProvider('cpqBml.mcpServers', {
                provideMcpServerDefinitions: async () => {
                    const { enable, port } = getSettings();
                    if (!enable) return [];
                    return [{
                        id: 'cpqBml.mcpServer',
                        label: 'CPQ-BML Local MCP Server',
                        transport: {
                            type: 'http',
                            url: `http://127.0.0.1:${port}/mcp`
                        }
                    }];
                }
            })
        );
    }
}

module.exports = { registerMcp };
