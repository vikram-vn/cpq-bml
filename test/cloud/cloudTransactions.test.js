const assert = require('assert');
const {
  createTransactionsProvider,
  inspectTransactionCommand,
  debugOnTransactionCommand,
  copyTransactionIdCommand
} = require('@/lang/cloud/cloudTransactions');
const api = require('@/lang/rest/api');

function createMockVscode(overrides = {}) {
  const treeItemFn = function (label, collapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.description = '';
    this.tooltip = '';
    this.iconPath = null;
    this.contextValue = '';
    this.command = null;
  };

  const eventEmitterFn = function () {
    this.fired = 0;
    this.event = function (cb) {
      return { dispose: function () {} };
    };
    this.fire = function () {
      this.fired++;
    }.bind(this);
  };

  const themeIconFn = function (id, color) {
    this.id = id;
    this.color = color;
  };

  const themeColorFn = function (id) {
    this.id = id;
  };

  let openedDoc = null;
  let shownDoc = null;
  let executedCmd = null;
  let clipboardText = null;
  let infoMsg = null;
  let errorMsg = null;

  const mock = {
    TreeItem: treeItemFn,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: eventEmitterFn,
    ThemeIcon: themeIconFn,
    ThemeColor: themeColorFn,
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
      getConfiguration: function () {
        return {
          get: function (key, def) {
            if (key === 'connection.siteUrl') return 'https://test.bigmachines.com';
            if (key === 'connection.username') return 'testuser';
            return def;
          }
        };
      },
      openTextDocument: async function (target) {
        openedDoc = target;
        return target;
      }
    },
    window: {
      registerTreeDataProvider: function () {
        return { dispose: function () {} };
      },
      showInformationMessage: function (msg) {
        infoMsg = msg;
      },
      showErrorMessage: function (msg) {
        errorMsg = msg;
      },
      showWarningMessage: function (msg) {},
      showTextDocument: async function (doc) {
        shownDoc = doc;
        return doc;
      },
      withProgress: async function (opt, task) {
        return task({ report: function () {} });
      }
    },
    commands: {
      registerCommand: function () {
        return { dispose: function () {} };
      },
      executeCommand: async function (cmd, arg) {
        executedCmd = { cmd: cmd, arg: arg };
      }
    },
    env: {
      clipboard: {
        writeText: async function (text) {
          clipboardText = text;
        }
      }
    },
    Uri: {
      file: function (f) {
        return { fsPath: f, scheme: 'file' };
      }
    },
    getOpenedDoc: function () { return openedDoc; },
    getShownDoc: function () { return shownDoc; },
    getExecutedCmd: function () { return executedCmd; },
    getClipboardText: function () { return clipboardText; },
    getInfoMsg: function () { return infoMsg; },
    getErrorMsg: function () { return errorMsg; }
  };

  if (overrides) {
    Object.assign(mock, overrides);
  }
  return mock;
}

suite('CPQ Recent Transactions Explorer - Unit Tests', () => {
  const origGetTransactions = api.getTransactions;
  const origGetTransaction = api.getTransaction;

  setup(() => {
    api.getTransactions = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            {
              _id: '1001',
              transactionID_t: 'Q-2026-001',
              customer_t: 'Acme Corp',
              status_t: 'Approved',
              totalAmount_t: 12500,
              dateModified_t: '2026-09-10T10:00:00Z',
              version_t: 1
            },
            {
              _id: '1002',
              transactionID_t: 'Q-2026-002',
              customer_t: 'Beta Inc',
              status_t: 'Draft',
              totalAmount_t: 8400,
              dateModified_t: '2026-09-09T15:30:00Z',
              version_t: 2
            }
          ]
        }
      };
    };

    api.getTransaction = async function (context, vscodeInstance, id) {
      return {
        statusCode: 200,
        body: {
          _id: id,
          transactionID_t: `Q-${id}`,
          status_t: 'Approved',
          lineItems: [{ docId: 1, partNumber: 'PART-A', price: 500 }]
        }
      };
    };
  });

  teardown(() => {
    api.getTransactions = origGetTransactions;
    api.getTransaction = origGetTransaction;
  });

  test('createTransactionsProvider returns items and formats TreeItems properly', async () => {
    const mockVscode = createMockVscode();
    const provider = createTransactionsProvider(mockVscode, {});

    const rootNodes = await provider.getChildren();
    assert.strictEqual(rootNodes.length, 2);
    assert.strictEqual(rootNodes[0].type, 'transaction');
    assert.strictEqual(rootNodes[0].data.transactionID_t, 'Q-2026-001');

    const treeItem = provider.getTreeItem(rootNodes[0]);
    assert.strictEqual(treeItem.label, 'Q-2026-001');
    assert.ok(treeItem.description.includes('Acme Corp'));
    assert.ok(treeItem.description.includes('Approved'));
    assert.strictEqual(treeItem.contextValue, 'cpqTransactionItem');
    assert.strictEqual(treeItem.collapsibleState, mockVscode.TreeItemCollapsibleState.Collapsed);
    assert.ok(treeItem.tooltip.includes('Internal ID (_id): 1001'));
  });

  test('expanding a transaction node reveals property sub-nodes', async () => {
    const mockVscode = createMockVscode();
    const provider = createTransactionsProvider(mockVscode, {});

    const rootNodes = await provider.getChildren();
    const propNodes = await provider.getChildren(rootNodes[0]);

    assert.ok(propNodes.length >= 4);
    const statusProp = propNodes.find(p => p.key === 'Status');
    assert.ok(statusProp);
    assert.strictEqual(statusProp.value, 'Approved');

    const treeItem = provider.getTreeItem(statusProp);
    assert.strictEqual(treeItem.label, 'Status: Approved');
    assert.strictEqual(treeItem.collapsibleState, mockVscode.TreeItemCollapsibleState.None);
  });

  test('inspectTransactionCommand fetches full transaction and opens JSON document', async () => {
    const mockVscode = createMockVscode();
    const item = {
      data: {
        _id: '1001',
        transactionID_t: 'Q-2026-001'
      }
    };

    await inspectTransactionCommand(item, mockVscode, {});
    const opened = mockVscode.getOpenedDoc();
    assert.ok(opened);
    assert.strictEqual(opened.language, 'json');
    assert.ok(opened.content.includes('"lineItems"'));
  });

  test('debugOnTransactionCommand invokes cpqBml.rest.debugExecution with transaction ID', async () => {
    const mockVscode = createMockVscode();
    const item = {
      data: {
        _id: '1001',
        transactionID_t: 'Q-2026-001'
      }
    };

    await debugOnTransactionCommand(item, mockVscode);
    const exec = mockVscode.getExecutedCmd();
    assert.ok(exec);
    assert.strictEqual(exec.cmd, 'cpqBml.rest.debugExecution');
    assert.strictEqual(exec.arg.transactionId, '1001');
  });

  test('copyTransactionIdCommand copies ID to clipboard and shows info notification', async () => {
    const mockVscode = createMockVscode();
    const item = {
      data: {
        _id: '1001',
        transactionID_t: 'Q-2026-001'
      }
    };

    await copyTransactionIdCommand(item, mockVscode);
    assert.strictEqual(mockVscode.getClipboardText(), '1001');
    assert.ok(mockVscode.getInfoMsg().includes('1001'));
  });

  test('handles empty results and errors gracefully', async () => {
    api.getTransactions = async function () {
      return { statusCode: 200, body: { items: [] } };
    };

    const mockVscode = createMockVscode();
    const provider = createTransactionsProvider(mockVscode, {});

    const rootNodes = await provider.getChildren();
    assert.strictEqual(rootNodes.length, 1);
    assert.strictEqual(rootNodes[0].type, 'empty');
    const item = provider.getTreeItem(rootNodes[0]);
    assert.ok(item.label.includes('No recent transactions'));
  });
});
