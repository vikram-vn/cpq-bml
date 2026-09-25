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

const DiagnosticTag = {
    Unnecessary: 1,
    Deprecated: 2,
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
MarkdownString.prototype.appendCodeblock = function(val, lang = '') {
    this.value += `\n\`\`\`${lang}\n${val}\n\`\`\`\n`;
    return this;
};

function EventEmitter() {
    this.event = () => ({ dispose: () => {} });
}
EventEmitter.prototype.fire = function() {};
function CodeAction(title, kind) {
    this.title = title;
    this.kind = kind;
    this.edit = null;
    this.diagnostics = [];
    this.isPreferred = false;
}

const CodeActionKind = {
    QuickFix: { value: 'quickfix' },
    Refactor: { value: 'refactor' },
    RefactorExtract: { value: 'refactor.extract' },
    RefactorInline: { value: 'refactor.inline' },
    RefactorRewrite: { value: 'refactor.rewrite' },
    Source: { value: 'source' },
    SourceOrganizeImports: { value: 'source.organizeImports' },
    SourceFixAll: { value: 'source.fixAll' }
};

function WorkspaceEdit() {
    this._edits = [];
}
WorkspaceEdit.prototype.replace = function(uri, range, newText) {
    this._edits.push({ type: 'replace', uri: uri, range: range, newText: newText });
};
WorkspaceEdit.prototype.insert = function(uri, position, newText) {
    this._edits.push({ type: 'insert', uri: uri, position: position, newText: newText });
};
WorkspaceEdit.prototype.delete = function(uri, range) {
    this._edits.push({ type: 'delete', uri: uri, range: range });
};

EventEmitter.prototype.dispose = function() {};

const _commands = new Map();
const _configListeners = [];
const _docOpenListeners = [];
const _diagnostics = new Map();

const mockVscode = {
    Position,
    Range,
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticTag,
    CodeAction,
    CodeActionKind,
    WorkspaceEdit,
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
    OverviewRulerLane: {
        Left: 1,
        Center: 2,
        Right: 4,
        Full: 7,
    },
    Uri: {
        file: (fsPath) => {
            const p = fsPath || '';
            const u = {
                fsPath: p,
                scheme: 'file',
                path: p.replace(/\\/g, '/'),
                toString: () => 'file://' + p.replace(/\\/g, '/'),
                with: (change) => {
                    const newPath = (change && change.path !== undefined) ? change.path : p;
                    return mockVscode.Uri.file(newPath);
                },
            };
            return u;
        },
        parse: (uriStr) => {
            const str = uriStr || '';
            const p = str.replace(/^file:\/\//, '');
            const u = {
                toString: () => str,
                fsPath: p,
                path: p.replace(/\\/g, '/'),
                scheme: (str.match(/^([a-z]+):/) || [])[1] || 'file',
                with: (change) => {
                    const newPath = (change && change.path !== undefined) ? change.path : p;
                    return mockVscode.Uri.parse('file://' + newPath.replace(/\\/g, '/'));
                },
            };
            return u;
        },
        joinPath: (baseUri, ...pathSegments) => {
            const joined = path.join(baseUri.fsPath || baseUri.path || '', ...pathSegments);
            return mockVscode.Uri.file(joined);
        },
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
    },
    ViewColumn: {
        Active: -1,
        Beside: -2,
        One: 1,
        Two: 2,
        Three: 3,
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
        createTextEditorDecorationType: () => ({ dispose: () => {} }),
        onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
        showTextDocument: async (doc) => ({ document: doc }),
        withProgress: async (opts, task) => {
            return task({ report: () => {} }, { isCancellationRequested: false, onCancellationRequested: () => {} });
        },
        createWebviewPanel: (viewType, title, showOptions, options) => {
            const panel = {
                viewType,
                title,
                showOptions,
                options,
                webview: {
                    html: '',
                    cspSource: 'vscode-webview:',
                    asWebviewUri: (u) => u,
                    postMessage: async () => true,
                    onDidReceiveMessage: () => ({ dispose: () => {} }),
                },
                onDidDispose: (cb) => { panel._onDispose = cb; return { dispose: () => {} }; },
                reveal: () => {},
                dispose: () => { if (panel._onDispose) panel._onDispose(); },
            };
            return panel;
        },
    },
    workspace: {
        findFiles: async () => [],
        workspaceFolders: [],
        textDocuments: [],
        getConfiguration: (section = '') => ({
            get: (key, def) => {
                const fullKey = section ? `${section}.${key}` : key;
                return configStore.has(fullKey) ? configStore.get(fullKey) : def;
            },
            update: async (key, val) => {
                const fullKey = section ? `${section}.${key}` : key;
                if (val === undefined) configStore.delete(fullKey);
                else configStore.set(fullKey, val);
                for (const listener of _configListeners) {
                    try {
                        listener({
                            affectsConfiguration: (s) => fullKey.startsWith(s) || s.startsWith(fullKey),
                        });
                    } catch (_) {}
                }
            },
            has: (key) => {
                const fullKey = section ? `${section}.${key}` : key;
                return configStore.has(fullKey);
            },
            inspect: () => undefined,
        }),
        onDidChangeConfiguration: (cb) => {
            _configListeners.push(cb);
            return {
                dispose: () => {
                    const idx = _configListeners.indexOf(cb);
                    if (idx !== -1) _configListeners.splice(idx, 1);
                },
            };
        },
        onDidOpenTextDocument: (cb) => {
            _docOpenListeners.push(cb);
            return {
                dispose: () => {
                    const idx = _docOpenListeners.indexOf(cb);
                    if (idx !== -1) _docOpenListeners.splice(idx, 1);
                },
            };
        },
        onDidChangeTextDocument: () => ({ dispose: () => {} }),
        onDidSaveTextDocument: () => ({ dispose: () => {} }),
        onDidCloseTextDocument: () => ({ dispose: () => {} }),
        registerTextDocumentContentProvider: () => ({ dispose: () => {} }),
        onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
        onDidCreateFiles: () => ({ dispose: () => {} }),
        onDidRenameFiles: () => ({ dispose: () => {} }),
        createFileSystemWatcher: () => ({
            onDidChange: () => ({ dispose: () => {} }),
            onDidCreate: () => ({ dispose: () => {} }),
            onDidDelete: () => ({ dispose: () => {} }),
            dispose: () => {},
        }),
        openTextDocument: async (arg) => {
            let content = '';
            let uri;
            let languageId = 'bml';
            if (typeof arg === 'string') {
                const fs = require('fs');
                if (fs.existsSync(arg)) content = fs.readFileSync(arg, 'utf8');
                uri = mockVscode.Uri.file(arg);
                if (arg.endsWith('.bml')) languageId = 'bml';
                else if (arg.endsWith('.bmlt')) languageId = 'bmlt';
            } else if (arg && typeof arg === 'object') {
                content = arg.content !== undefined ? arg.content : '';
                languageId = arg.language || 'bml';
                uri = arg.uri || mockVscode.Uri.file(path.join(process.cwd(), 'temp_' + Math.random().toString(36).slice(2) + '.' + languageId));
            } else {
                uri = mockVscode.Uri.file('');
            }
            const lines = content.split('\n');
            const doc = {
                getText: () => content,
                lineAt: (idx) => ({ text: lines[idx] !== undefined ? lines[idx] : '' }),
                lineCount: lines.length,
                uri,
                fileName: uri.fsPath || '',
                languageId,
                positionAt: (offset) => {
                    let cur = 0;
                    for (let l = 0; l < lines.length; l++) {
                        if (cur + lines[l].length + 1 > offset || l === lines.length - 1) {
                            return new Position(l, Math.max(0, offset - cur));
                        }
                        cur += lines[l].length + 1;
                    }
                    return new Position(0, 0);
                },
            };
            for (const listener of _docOpenListeners) {
                try { listener(doc); } catch (_) {}
            }
            return doc;
        },
        fs: {
            readFile: async () => Buffer.from(''),
            writeFile: async () => {},
            stat: async () => { throw new Error('Not found'); },
        },
    },
    commands: {
        registerCommand: (id, handler) => {
            _commands.set(id, handler);
            return { dispose: () => _commands.delete(id) };
        },
        executeCommand: async (id, ...args) => {
            const h = _commands.get(id);
            if (typeof h === 'function') {
                return await h(...args);
            }
            return undefined;
        },
        getCommands: async () => Array.from(_commands.keys()),
    },
    languages: {
        createDiagnosticCollection: () => ({
            set: (uri, diags) => {
                const key = uri && uri.fsPath ? uri.fsPath : (uri?.toString ? uri.toString() : String(uri));
                _diagnostics.set(key, diags || []);
            },
            delete: (uri) => {
                const key = uri && uri.fsPath ? uri.fsPath : (uri?.toString ? uri.toString() : String(uri));
                _diagnostics.delete(key);
            },
            clear: () => _diagnostics.clear(),
            dispose: () => _diagnostics.clear(),
        }),
        getDiagnostics: (uri) => {
            if (!uri) {
                const all = [];
                for (const arr of _diagnostics.values()) all.push(...arr);
                return all;
            }
            const key = uri && uri.fsPath ? uri.fsPath : (uri?.toString ? uri.toString() : String(uri));
            return _diagnostics.get(key) || [];
        },
        registerCompletionItemProvider: () => ({ dispose: () => {} }),
        registerHoverProvider: () => ({ dispose: () => {} }),
        registerDefinitionProvider: () => ({ dispose: () => {} }),
        registerReferenceProvider: () => ({ dispose: () => {} }),
        registerCodeActionsProvider: () => ({ dispose: () => {} }),
        registerInlayHintsProvider: () => ({ dispose: () => {} }),
        registerDocumentFormattingEditProvider: () => ({ dispose: () => {} }),
        registerDocumentRangeFormattingEditProvider: () => ({ dispose: () => {} }),
        registerOnTypeFormattingEditProvider: () => ({ dispose: () => {} }),
        registerSignatureHelpProvider: () => ({ dispose: () => {} }),
        registerRenameProvider: () => ({ dispose: () => {} }),
        registerDocumentSymbolProvider: () => ({ dispose: () => {} }),
        registerWorkspaceSymbolProvider: () => ({ dispose: () => {} }),
        registerCodeLensProvider: () => ({ dispose: () => {} }),
        registerCallHierarchyProvider: () => ({ dispose: () => {} }),
    },
    extensions: {
        getExtension: (id) => ({
            id: id || 'vikram-n.cpq-bml',
            isActive: true,
            activate: async () => {
                const ext = require('../extension');
                const fakeContext = {
                    subscriptions: [],
                    globalState: { get: () => undefined, update: async () => {} },
                    workspaceState: { get: () => undefined, update: async () => {} },
                    secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
                    extensionPath: path.join(__dirname, '..'),
                    extensionUri: mockVscode.Uri.file(path.join(__dirname, '..')),
                };
                if (typeof ext.activate === 'function') {
                    await ext.activate(fakeContext);
                }
            },
            exports: {},
            packageJSON: require('../package.json')
        }),
        all: []
    },
    EventEmitter,
};

module.exports = mockVscode;
