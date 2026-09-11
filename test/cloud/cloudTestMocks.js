// Reusable headless VS Code mocks for CPQ Cloud Explorer unit tests

function createMockTreeItem(label, collapsibleState) {
  return {
    label,
    collapsibleState,
    description: '',
    tooltip: '',
    iconPath: null,
    contextValue: '',
    command: null,
  };
}

function createMockEventEmitter() {
  let fired = 0;
  return {
    get fired() { return fired; },
    event: (cb) => ({ dispose: () => {} }),
    fire: function () { fired++; }
  };
}

function createMockThemeIcon(id, color) {
  return { id, color };
}

function createMockThemeColor(id) {
  return { id };
}

function createCloudMockVscode(overrides = {}) {
  const { workspace: wsOverride, window: winOverride, commands: cmdOverride, env: envOverride, Uri: uriOverride, ...restOverrides } = overrides;
  let openedDoc = null;
  let shownDoc = null;
  let executedCmd = null;
  let clipboardText = null;
  let infoMsg = null;
  let warningMsg = null;
  let errorMsg = null;
  let quickPickItems = null;
  let quickPickSelected = null;
  const contexts = new Map();

  return {
    Position: function (l, c) { this.line = l; this.character = c; this.char = c; },
    Range: function (start, end) { this.start = start; this.end = end; },
    TreeItem: function (label, collapsibleState) {
      Object.assign(this, createMockTreeItem(label, collapsibleState));
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: function () {
      Object.assign(this, createMockEventEmitter());
    },
    ThemeIcon: function (id, color) {
      this.id = id;
      this.color = color;
    },
    ThemeColor: function (id) {
      this.id = id;
    },
    workspace: {
      workspaceFolders: [],
      openTextDocument: async (target) => {
        openedDoc = target;
        return target;
      },
      getConfiguration: () => ({ get: () => 'library' }),
      ...(wsOverride || {})
    },
    window: {
      showInputBox: async () => 'testFunc',
      showQuickPick: async (items, opts) => {
        quickPickItems = items;
        if (typeof quickPickSelected === 'function') return quickPickSelected(items);
        return quickPickSelected || (items && items.find(it => it.data)) || (items && items[0]);
      },
      showInformationMessage: (msg) => { infoMsg = msg; },
      showErrorMessage: (msg) => { errorMsg = msg; },
      showWarningMessage: (msg) => { warningMsg = msg; },
      showTextDocument: async (doc) => {
        shownDoc = doc;
        return { selection: null, revealRange: () => {} };
      },
      withProgress: async (opt, task) => task({ report: () => {} }),
      registerTreeDataProvider: (viewId, provider) => ({ dispose: () => {} }),
      createTreeView: (viewId, opts) => ({ dispose: () => {}, description: '', title: '' }),
      ...(winOverride || {})
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: async (cmd, ...args) => {
        executedCmd = { cmd, arg: args[0], args };
        if (cmd === 'setContext') {
          contexts.set(args[0], args[1]);
        }
      },
      ...(cmdOverride || {})
    },
    env: {
      clipboard: {
        writeText: async (txt) => { clipboardText = txt; }
      },
      ...(envOverride || {})
    },
    Uri: {
      file: (f) => ({ fsPath: f, scheme: 'file' }),
      ...(uriOverride || {})
    },
    getOpenedDoc: function () { return openedDoc; },
    getShownDoc: function () { return shownDoc; },
    getExecutedCmd: function () { return executedCmd; },
    getClipboardText: function () { return clipboardText; },
    getInfoMsg: function () { return infoMsg; },
    getWarningMsg: function () { return warningMsg; },
    getErrorMsg: function () { return errorMsg; },
    getQuickPickItems: function () { return quickPickItems; },
    setQuickPickSelected: function (sel) { quickPickSelected = sel; },
    getContext: function (k) { return contexts.get(k); },
    _state: {
      get openedDoc() { return openedDoc; },
      get shownDoc() { return shownDoc; },
      get executedCmd() { return executedCmd; },
      get clipboardText() { return clipboardText; },
      get infoMsg() { return infoMsg; },
      get errorMsg() { return errorMsg; },
      get quickPickItems() { return quickPickItems; },
    },
    ...restOverrides
  };
}

module.exports = {
  createMockTreeItem,
  createMockEventEmitter,
  createMockThemeIcon,
  createMockThemeColor,
  createCloudMockVscode
};
