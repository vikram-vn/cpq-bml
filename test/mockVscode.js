// Headless mock for 'vscode' when running unit tests outside of VS Code test-electron
const path = require('path');

function Position(line, character) {
    this.line = line;
    this.character = character;
}
Position.prototype.translate = function(lineDelta = 0, characterDelta = 0) {
    return new Position(this.line + lineDelta, this.character + characterDelta);
};

function Range(a, b, c, d) {
    if (typeof a === 'object' && a !== null) {
        this.start = new Position(a.line, a.character);
        this.end = new Position(b.line, b.character);
    } else {
        this.start = new Position(a, b);
        this.end = new Position(c, d);
    }
}

function Diagnostic(range, message, severity) {
    this.range = range;
    this.message = message;
    this.severity = severity;
}

const DiagnosticSeverity = {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
};

const CompletionItemKind = {
    Text: 1,
    Method: 2,
    Function: 3,
    Constructor: 4,
    Field: 5,
    Variable: 6,
    Class: 7,
    Interface: 8,
    Module: 9,
    Property: 10,
    Unit: 11,
    Value: 12,
    Enum: 13,
    Keyword: 14,
    Snippet: 15,
    Color: 16,
    File: 17,
    Reference: 18,
    Folder: 19,
    EnumMember: 20,
    Constant: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25,
};

function SnippetString(value) {
    this.value = value;
}

function CompletionItem(label, kind) {
    this.label = label;
    this.kind = kind;
}

function ThemeColor(id) {
    this.id = id;
}

function ThemeIcon(id) {
    this.id = id;
}

function TreeItem(label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
}

const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

const ProgressLocation = {
    SourceControl: 1,
    Window: 10,
    Notification: 15,
};

const configStore = new Map();

function MarkdownString(value = '') {
    this.value = value;
}
MarkdownString.prototype.appendMarkdown = function(val) {
    this.value += val;
    return this;
};
MarkdownString.prototype.appendText = function(val) {
    this.value += val;
    return this;
};

function EventEmitter() {
    this.event = () => ({ dispose: () => {} });
}
EventEmitter.prototype.fire = function() {};
EventEmitter.prototype.dispose = function() {};

const mockVscode = {
    Position,
    Range,
    Diagnostic,
    DiagnosticSeverity,
    CompletionItemKind,
    CompletionItem,
    SnippetString,
    MarkdownString,
    ThemeColor,
    ThemeIcon,
    TreeItem,
    TreeItemCollapsibleState,
    ProgressLocation,
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
    },
    Uri: {
        file: (fsPath) => ({
            fsPath,
            scheme: 'file',
            path: fsPath,
            toString: () => 'file://' + String(fsPath).replace(/\\/g, '/'),
        }),
        parse: (uriStr) => ({
            toString: () => uriStr,
            fsPath: uriStr.replace(/^file:\/\//, ''),
            scheme: (uriStr.match(/^([a-z]+):/) || [])[1] || 'file',
        }),
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
    },
    window: {
        terminals: [],
        showInformationMessage: async () => undefined,
        showWarningMessage: async () => undefined,
        showErrorMessage: async () => undefined,
        showQuickPick: async () => undefined,
        showInputBox: async () => undefined,
        createOutputChannel: () => ({
            append: () => {},
            appendLine: () => {},
            clear: () => {},
            show: () => {},
            dispose: () => {},
        }),
        createTerminal: (optionsOrName, pty) => {
            const name = typeof optionsOrName === 'string' ? optionsOrName : (optionsOrName && optionsOrName.name) || '';
            const term = {
                name,
                pty: pty || (typeof optionsOrName === 'object' ? optionsOrName.pty : undefined),
                show: () => {},
                dispose: () => {
                    const idx = mockVscode.window.terminals.indexOf(term);
                    if (idx !== -1) mockVscode.window.terminals.splice(idx, 1);
                },
                sendText: () => {},
            };
            mockVscode.window.terminals.push(term);
            return term;
        },
        createStatusBarItem: (alignment, priority) => ({
            alignment,
            priority,
            text: '',
            tooltip: '',
            command: '',
            show: () => {},
            hide: () => {},
            dispose: () => {},
        }),
        registerTreeDataProvider: () => ({ dispose: () => {} }),
        createTreeView: () => ({ dispose: () => {} }),
        showTextDocument: async (doc) => ({ document: doc }),
        withProgress: async (opts, task) => {
            return task({ report: () => {} }, { isCancellationRequested: false, onCancellationRequested: () => {} });
        },
    },
    workspace: {
        workspaceFolders: [],
        getConfiguration: (section = '') => ({
            get: (key, def) => {
                const fullKey = section ? `${section}.${key}` : key;
                return configStore.has(fullKey) ? configStore.get(fullKey) : def;
            },
            update: async (key, val) => {
                const fullKey = section ? `${section}.${key}` : key;
                if (val === undefined) configStore.delete(fullKey);
                else configStore.set(fullKey, val);
            },
            has: (key) => {
                const fullKey = section ? `${section}.${key}` : key;
                return configStore.has(fullKey);
            },
            inspect: () => undefined,
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        onDidOpenTextDocument: () => ({ dispose: () => {} }),
        onDidChangeTextDocument: () => ({ dispose: () => {} }),
        onDidCloseTextDocument: () => ({ dispose: () => {} }),
        createFileSystemWatcher: () => ({
            onDidChange: () => ({ dispose: () => {} }),
            onDidCreate: () => ({ dispose: () => {} }),
            onDidDelete: () => ({ dispose: () => {} }),
            dispose: () => {},
        }),
        openTextDocument: async () => ({
            getText: () => '',
            lineAt: () => ({ text: '' }),
            lineCount: 0,
            uri: { fsPath: '' },
        }),
        fs: {
            readFile: async () => Buffer.from(''),
            writeFile: async () => {},
        },
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: async () => undefined,
    },
    languages: {
        createDiagnosticCollection: () => ({
            set: () => {},
            delete: () => {},
            clear: () => {},
            dispose: () => {},
        }),
        registerCompletionItemProvider: () => ({ dispose: () => {} }),
        registerHoverProvider: () => ({ dispose: () => {} }),
        registerDefinitionProvider: () => ({ dispose: () => {} }),
        registerReferenceProvider: () => ({ dispose: () => {} }),
        registerCodeActionsProvider: () => ({ dispose: () => {} }),
        registerInlayHintsProvider: () => ({ dispose: () => {} }),
        registerDocumentFormattingEditProvider: () => ({ dispose: () => {} }),
    },
    EventEmitter,
};

module.exports = mockVscode;
