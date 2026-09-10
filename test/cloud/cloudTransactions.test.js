const assert = require('assert');
const {
  createTransactionsProvider,
  inspectTransactionCommand,
  debugOnTransactionCommand,
  copyTransactionIdCommand
} = require('@/lang/cloud/cloudTransactions');
const api = require('@/lang/rest/api');

const { createCloudMockVscode: createMockVscode } = require('./cloudTestMocks');

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
