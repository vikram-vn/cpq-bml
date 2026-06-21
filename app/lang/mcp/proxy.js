const fs = require('fs');

// MCP tools call into the same run*(context, vscode, ...) functions the
// editor/title icons use, instead of re-implementing payload-building logic.
// Those functions read vscode.window.activeTextEditor and occasionally show
// a QuickPick/InputBox - neither of which an unattended AI caller can answer.
// This proxy wraps the REAL vscode module (so real secrets/config/workspace
// still apply) and overrides only the few surfaces a tool call needs to
// control: which file is "open", and how to resolve any QuickPick that would
// otherwise block waiting for a human.
//
// showInformationMessage/showErrorMessage/showWarningMessage are also
// intercepted (but still forwarded to the real vscode, so the human sees the
// same toast) purely to capture the final outcome text for the tool result -
// the run* functions don't return anything themselves.
function createToolVscodeContext(vscode, { bmlPath, quickPickSelector, configOverrides } = {}) {
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
                return (msg, ...rest) => {
                    messages.warning.push(msg);
                    return target.showWarningMessage(msg, ...rest);
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

// Always captures every line (so the tool result can carry a full log back
// to the AI), and - when a real terminal is passed in - also forwards each
// line live, so a human watching VS Code sees AI activity as it happens.
function createCapturingTerminal(realTerminal) {
    const lines = [];
    return {
        terminal: {
            writeLine: (l) => {
                lines.push(l);
                if (realTerminal) {
                    try { realTerminal.writeLine(l); } catch (e) { /* best-effort */ }
                }
            },
            show: () => {
                if (realTerminal) {
                    try { realTerminal.show(); } catch (e) { /* best-effort */ }
                }
            },
            clear: () => {
                if (realTerminal) {
                    try { realTerminal.clear(); } catch (e) { /* best-effort */ }
                }
            },
        },
        getLines: () => lines.map(stripAnsi),
    };
}

module.exports = { createToolVscodeContext, createCapturingTerminal, stripAnsi };
