// Shared fakes for testing app/lang/rest/* modules, all of which take
// vscode/context as explicit parameters rather than require()-ing the real
// vscode module, so they can be driven entirely with plain objects here.

function createFakeVscode({ config = {}, window = {}, workspaceFolders, commands = {} } = {}) {
    return {
        ConfigurationTarget: {
            Global: 1,
            Workspace: 2,
            WorkspaceFolder: 3
        },
        workspace: {
            getConfiguration: () => ({
                get(key, def) {
                    return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : def;
                },
                update(key, value) {
                    config[key] = value;
                }
            }),
            workspaceFolders
        },
        window: {
            showInputBox: async () => undefined,
            showInformationMessage: () => {},
            showErrorMessage: () => {},
            showWarningMessage: () => {},
            showQuickPick: async () => undefined,
            activeTextEditor: undefined,
            createOutputChannel: () => ({ appendLine: () => {}, show: () => {} }),
            ...window
        },
        commands: {
            // No-op by default; tests can override to assert on specific calls.
            executeCommand: async () => {},
            ...commands
        }
    };
}

function createFakeContext(secretValues = {}) {
    const store = { ...secretValues };
    const workspaceStore = {};
    const globalStore = {};
    let extensionUri;
    try {
        const vscode = require('vscode');
        extensionUri = vscode.Uri.file(__dirname);
    } catch (e) {}
    return {
        extensionUri,
        secrets: {
            get: async (key) => store[key],
            store: async (key, value) => {
                store[key] = value;
            },
            onDidChange: () => ({ dispose: () => {} }),
            _store: store
        },
        workspaceState: {
            get: (key, def) => (Object.prototype.hasOwnProperty.call(workspaceStore, key) ? workspaceStore[key] : def),
            update: async (key, value) => {
                workspaceStore[key] = value;
            }
        },
        globalState: {
            get: (key, def) => (Object.prototype.hasOwnProperty.call(globalStore, key) ? globalStore[key] : def),
            update: async (key, value) => {
                globalStore[key] = value;
            }
        }
    };
}

module.exports = { createFakeVscode, createFakeContext };
