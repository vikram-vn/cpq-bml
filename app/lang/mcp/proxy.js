const fs = require('fs');
const vscode = require('vscode');
const pathLib = require('path');

// Wraps the real vscode module so the existing run*() command logic can be reused unattended:
// overrides activeTextEditor and QuickPick (which would otherwise block waiting for a human),
// and intercepts the show*Message calls to capture outcome text for the tool result.
function createToolVscodeContext(vscode, { bmlPath, quickPickSelector, warningConfirm, configOverrides } = {}) {
    const messages = { info: [], error: [], warning: [] };

    const fakeEditor = bmlPath
        ? {
            document: {
                languageId: 'bml',
                uri: { fsPath: bmlPath },
                getText: () => fs.readFileSync(bmlPath, 'utf8'),
            },
        }
        : undefined;

    const windowProxy = new Proxy(vscode.window, {
        get(target, prop) {
            if (prop === 'activeTextEditor') return fakeEditor;
            if (prop === 'showInformationMessage') {
                return (msg, ...rest) => {
                    messages.info.push(msg);
                    return target.showInformationMessage(msg, ...rest);
                };
            }
            if (prop === 'showErrorMessage') {
                return (msg, ...rest) => {
                    messages.error.push(msg);
                    return target.showErrorMessage(msg, ...rest);
                };
            }
            if (prop === 'showWarningMessage') {
                // Never shows a real modal for a headless tool call: an explicit
                // warningConfirm answers it directly, and the absence of one cancels
                // rather than blocking on a popup no one is watching for.
                return (msg) => {
                    messages.warning.push(msg);
                    return warningConfirm;
                };
            }
            if (prop === 'showQuickPick') {
                return async (items, options) => {
                    if (quickPickSelector) return quickPickSelector(await items, options);
                    return undefined; // no answerer configured - cancel rather than hang
                };
            }
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });

    const workspaceProxy = new Proxy(vscode.workspace, {
        get(target, prop) {
            if (prop === 'getConfiguration') {
                return (section) => {
                    const real = target.getConfiguration(section);
                    if (!configOverrides) return real;
                    return new Proxy(real, {
                        get(cfgTarget, cfgProp) {
                            if (cfgProp === 'get') {
                                return (key, defaultValue) => {
                                    if (Object.prototype.hasOwnProperty.call(configOverrides, key)) {
                                        return configOverrides[key];
                                    }
                                    return cfgTarget.get(key, defaultValue);
                                };
                            }
                            const value = cfgTarget[cfgProp];
                            return typeof value === 'function' ? value.bind(cfgTarget) : value;
                        },
                    });
                };
            }
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });

    const vscodeProxy = new Proxy(vscode, {
        get(target, prop) {
            if (prop === 'window') return windowProxy;
            if (prop === 'workspace') return workspaceProxy;
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });

    return { vscodeProxy, messages };
}

// Strips ANSI color codes so the tool result's log text is plain.
function stripAnsi(text) {
    return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

// Captures every line for the tool result, and forwards live to realTerminal if provided.
// The real terminal is shared with human-triggered commands, so lines forwarded there are
// prefixed with "[MCP]" to distinguish AI-driven activity from the user's own; the captured
// lines returned to the tool caller are left unprefixed.
function createCapturingTerminal(realTerminal) {
    const lines = [];
    return {
        terminal: {
            writeLine: (l) => {
                lines.push(l);
                if (realTerminal) {
                    try { realTerminal.writeLine(`[MCP] ${l}`); } catch (e) { // best-effort
                    }
                }
                try {
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const mcpLogsDir = pathLib.join(workspaceRoot, 'logs', 'mcp-logs');
                        fs.mkdirSync(mcpLogsDir, { recursive: true });
                        const mcpLogPath = pathLib.join(mcpLogsDir, 'mcp.log');
                        const timestamp = new Date().toISOString();
                        fs.appendFileSync(mcpLogPath, `[${timestamp}] [Tool] ${l}\n`);
                    }
                } catch (e) {}
            },
            show: () => {
                if (realTerminal) {
                    try { realTerminal.show(); } catch (e) { // best-effort
                    }
                }
            },
            clear: () => {
                if (realTerminal) {
                    try { realTerminal.clear(); } catch (e) { // best-effort
                    }
                }
            },
        },
        getLines: () => lines.map(stripAnsi),
    };
}

module.exports = { createToolVscodeContext, createCapturingTerminal, stripAnsi };
