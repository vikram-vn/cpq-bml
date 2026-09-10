let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    TreeItem: function (label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: function () {
      this.event = () => ({ dispose: () => {} });
      this.fire = () => {};
    },
    ThemeIcon: function (id, color) {
      this.id = id;
      this.color = color;
    },
    ThemeColor: function (id) {
      this.id = id;
    },
    window: {
      registerTreeDataProvider: () => ({ dispose: () => {} }),
      showInputBox: async () => '',
      showQuickPick: async () => null,
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      showWarningMessage: () => {},
      showTextDocument: async () => {},
      showSaveDialog: () => {},
      createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }),
      withProgress: async (opt, task) => task({ report: () => {} })
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: () => {}
    },
    workspace: {
      workspaceFolders: [],
      openTextDocument: async () => ({}),
      fs: { writeFile: () => {} },
      createFileSystemWatcher: () => ({ onDidCreate: () => {}, onDidChange: () => {}, onDidDelete: () => {} }),
      onDidChangeConfiguration: () => ({ dispose: () => {} })
    },
    env: {
      clipboard: {
        writeText: async () => {}
      }
    },
    Uri: {
      file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
    },
    Position: function (line, char) {
      this.line = line;
      this.character = char;
    },
    Range: function (start, end) {
      this.start = start;
      this.end = end;
    }
  };
}

/**
 * Safely parses JSON values or returns the fallback object/array.
 */
function safeParseJson(val, fallback = {}) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

module.exports = {
  vscode,
  safeParseJson,
};
