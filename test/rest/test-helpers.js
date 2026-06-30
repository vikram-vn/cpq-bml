// Shared fakes for testing app/lang/rest/* modules, all of which take
// vscode/context as explicit parameters rather than require()-ing the real
// vscode module, so they can be driven entirely with plain objects here.

class Range {
    constructor(startLine, startChar, endLine, endChar) {
        this.start = { line: startLine, character: startChar };
        this.end = { line: endLine, character: endChar };
    }
}

class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
}

class Diagnostic {
    constructor(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
}

const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
};

function createFakeVscode({ config = {}, window = {}, workspaceFolders, commands = {} } = {}) {
    return {
        Range,
        Position,
        Diagnostic,
        DiagnosticSeverity,
        ConfigurationTarget: {
            Global: 1,
            Workspace: 2,
            WorkspaceFolder: 3
        },
        workspace: {
            getConfiguration: (section) => ({
                get(key, def) {
                    const fullKey = section ? `${section}.${key}` : key;
                    if (Object.prototype.hasOwnProperty.call(config, fullKey)) {
                        return config[fullKey];
                    }
                    if (Object.prototype.hasOwnProperty.call(config, key)) {
                        return config[key];
                    }
                    return def;
                },
                update(key, value) {
                    config[key] = value;
                    const fullKey = section ? `${section}.${key}` : key;
                    if (fullKey !== key) {
                        config[fullKey] = value;
                    }
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
