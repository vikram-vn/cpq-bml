const vscode = require('vscode');
const pathLib = require('path');
const fs = require('fs');
const { startMcpServer, stopMcpServer, getMcpServerStatus } = require('./server');
const { registerMcpWithAllTools, deregisterMcpFromAllTools } = require('../../ai/setup/mcpAutoRegister');

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

    let statusBarItem = null;
    if (vscode.window && typeof vscode.window.createStatusBarItem === 'function') {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = 'cpqBml.mcp.showInfo';
        context.subscriptions.push(statusBarItem);
    }

    const ensureStarted = async () => {
        const { enable, port } = getSettings();
        if (!enable) {
            if (statusBarItem) statusBarItem.hide();
            return { started: false, reason: 'cpqBml.mcp.enable is false' };
        }
        try {
            const result = await startMcpServer(context, vscode, port);
            logMcpServerEvent(`MCP server started on port ${result.port}`);

            if (statusBarItem) {
                statusBarItem.text = `$(server) MCP:${result.port}`;
                statusBarItem.tooltip = `CPQ-BML MCP Server active on port ${result.port}. Click to show details.`;
                statusBarItem.show();
            }

            // Auto-register with all AI tools (idempotent — safe to call on every start)
            try {
                const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                    ? vscode.workspace.workspaceFolders[0].uri.fsPath
                    : null;
                const { registered, errors } = registerMcpWithAllTools(result.port, wsRoot);
                if (registered.length > 0) {
                    console.log(`CPQ-BML: MCP auto-registered with: ${registered.join(', ')}`);
                    logMcpServerEvent(`MCP auto-registered with: ${registered.join(', ')}`);
                }
                if (errors.length > 0) {
                    console.warn('CPQ-BML: MCP auto-registration warnings:', errors);
                }
            } catch (regErr) {
                console.warn('CPQ-BML: MCP auto-registration failed (non-fatal):', regErr);
            }

            return { started: true, port: result.port };
        } catch (err) {
            console.error('MCP SERVER START ERROR:', err);
            logMcpServerEvent(`MCP server failed to start: ${err && err.message ? err.message : String(err)}`);

            if (err && (err.code === 'EADDRINUSE' || String(err).includes('EADDRINUSE'))) {
                // Zero-touch automatic port recovery: probe consecutive ports
                let recovered = null;
                for (let nextPort = port + 1; nextPort <= port + 5; nextPort++) {
                    try {
                        const rec = await startMcpServer(context, vscode, nextPort);
                        recovered = rec;
                        break;
                    } catch {
                        // continue searching
                    }
                }

                if (recovered) {
                    logMcpServerEvent(`Port ${port} was busy. Auto-recovered on port ${recovered.port}`);
                    vscode.workspace.getConfiguration('cpqBml').update('mcp.port', recovered.port, vscode.ConfigurationTarget.Global);
                    if (statusBarItem) {
                        statusBarItem.text = `$(server) MCP:${recovered.port}`;
                        statusBarItem.tooltip = `CPQ-BML MCP Server auto-recovered on port ${recovered.port}.`;
                        statusBarItem.show();
                    }
                    if (vscode.window && typeof vscode.window.showInformationMessage === 'function') {
                        vscode.window.showInformationMessage(`CPQ-BML: MCP port ${port} was busy. Automatically bound to port ${recovered.port}.`);
                    }
                    try {
                        const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                            ? vscode.workspace.workspaceFolders[0].uri.fsPath
                            : null;
                        registerMcpWithAllTools(recovered.port, wsRoot);
                    } catch {}
                    return { started: true, port: recovered.port };
                }

                if (statusBarItem) {
                    statusBarItem.text = `$(warning) MCP: Port ${port} Busy`;
                    statusBarItem.tooltip = `Port ${port} is currently in use. Click to troubleshoot.`;
                    statusBarItem.show();
                }
                if (vscode.window && typeof vscode.window.showWarningMessage === 'function') {
                    vscode.window.showWarningMessage(
                        `CPQ-BML: MCP port ${port} is in use and auto-recovery could not find a free port.`,
                        'Open Settings'
                    ).then(choice => {
                        if (choice === 'Open Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'cpqBml.mcp.port');
                        }
                    });
                }
            }

            return { started: false, reason: err && err.message ? err.message : String(err) };
        }
    };

    const ensureStopped = () => {
        stopMcpServer();
        logMcpServerEvent('MCP server stopped');

        if (statusBarItem) {
            statusBarItem.hide();
        }

        // Remove cpq-bml entry from all AI tool global configs
        try {
            const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : null;
            const { deregistered } = deregisterMcpFromAllTools(wsRoot);
            if (deregistered.length > 0) {
                logMcpServerEvent(`MCP deregistered from: ${deregistered.join(', ')}`);
            }
        } catch (deregErr) {
            console.warn('CPQ-BML: MCP deregistration failed (non-fatal):', deregErr);
        }
    };

    context.subscriptions.push({ dispose: () => {
        stopMcpServer();
        logMcpServerEvent('MCP server stopped');
    }});

    // Auto-start on activation if the user has already opted in.
    ensureStarted();

    vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration('cpqBml.mcp')) return;
        const status = getMcpServerStatus();
        const { enable, port } = getSettings();
        if (!enable) {
            if (status.running) {
                ensureStopped();
            }
        } else {
            if (status.running && status.port !== port) {
                ensureStopped();
                await ensureStarted();
            } else if (!status.running) {
                await ensureStarted();
            } else {
                // Running on current port: re-sync native AI configs to reflect any setting updates
                try {
                    const wsRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
                        ? vscode.workspace.workspaceFolders[0].uri.fsPath
                        : null;
                    const { registered, skipped } = registerMcpWithAllTools(port, wsRoot);
                    if (registered.length > 0) {
                        logMcpServerEvent(`MCP re-synced with: ${registered.join(', ')} (skipped: ${skipped.length})`);
                    }
                } catch (regErr) {
                    console.warn('CPQ-BML: MCP config re-sync failed:', regErr);
                }
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
