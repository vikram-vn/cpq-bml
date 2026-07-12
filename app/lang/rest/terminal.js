// Read-only Pseudoterminal — unlike Terminal#sendText(), it never executes its output as shell input.
const { normalizeSiteUrl } = require('./config');
function createResultsTerminal(vscode, name) {
    const writeEmitter = new vscode.EventEmitter();
    const pty = {
        onDidWrite: writeEmitter.event,
        open() {},
        close() {},
        handleInput() {} // read-only: ignore anything the user types into it
    };
    const terminal = vscode.window.createTerminal({ name, pty });

    return {
        writeLine(text) {
            writeEmitter.fire(`${text}\r\n`);
        },
        show() {
            terminal.show(true);
        },
        // xterm.js escape sequences — Pseudoterminal API has no dedicated clear call.
        clear() {
            writeEmitter.fire('\x1b[2J\x1b[3J\x1b[H');
        },
        dispose() {
            terminal.dispose();
        }
    };
}

function getActiveEnvironmentName(vscode) {
    try {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const siteUrl = (config.get('connection.siteUrl', '') || '').trim();
        if (!siteUrl) return '';
        const username = (config.get('connection.username', '') || '').trim().toLowerCase();
        const authMethod = config.get('connection.authMethod', 'basic');

        const normalizedActiveSite = normalizeSiteUrl(siteUrl).toLowerCase();

        const environments = config.get('connection.environments', []) || [];
        const matchedEnv = environments.find(env => {
            if (!env.siteUrl) return false;
            const urlMatches = normalizeSiteUrl(env.siteUrl).toLowerCase() === normalizedActiveSite;
            const userMatches = (env.username || '').trim().toLowerCase() === username;
            const authMatches = (env.authMethod || 'basic') === authMethod;
            return urlMatches && userMatches && authMatches;
        });

        return matchedEnv ? matchedEnv.name : '';
    } catch (e) {
        return '';
    }
}

let sharedResultsTerminal = null;

function getResultsTerminal(vscode) {
    if (!sharedResultsTerminal) {
        let currentTerminal = null;
        let currentTerminalName = null;

        const getActiveTerminal = () => {
            const envName = getActiveEnvironmentName(vscode);
            const expectedName = envName ? `BML: ${envName}` : 'CPQ-BML';

            if (currentTerminal && currentTerminalName !== expectedName) {
                currentTerminal.dispose();
                currentTerminal = null;
            }

            if (!currentTerminal) {
                currentTerminal = createResultsTerminal(vscode, expectedName);
                currentTerminalName = expectedName;
            }
            return currentTerminal;
        };

        sharedResultsTerminal = {
            writeLine(text) {
                getActiveTerminal().writeLine(text);
            },
            show() {
                getActiveTerminal().show();
            },
            clear() {
                getActiveTerminal().clear();
            },
            dispose() {
                if (currentTerminal) {
                    currentTerminal.dispose();
                    currentTerminal = null;
                }
            }
        };
    }
    return sharedResultsTerminal;
}

module.exports = { createResultsTerminal, getResultsTerminal, getActiveEnvironmentName };

