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

/**
 * Safely extracts a string from a string, number, or CPQ metadata object (e.g. { displayValue, name, label, value }).
 */
function extractStringValue(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const candidate =
      val.displayValue ||
      val.displayLabel ||
      val.label ||
      val.name ||
      val.actionType ||
      val.lookupVal ||
      val.value ||
      val.type;
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') return extractStringValue(candidate, fallback);
    if (candidate !== null && candidate !== undefined) return String(candidate);
  }
  return fallback;
}

module.exports = {
  vscode,
  safeParseJson,
  extractStringValue,
};

