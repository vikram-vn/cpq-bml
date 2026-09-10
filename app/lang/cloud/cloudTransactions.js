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
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      showWarningMessage: () => {},
      showTextDocument: async () => {},
      withProgress: async (opt, task) => task({ report: () => {} })
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: () => {}
    },
    workspace: {
      workspaceFolders: [],
      openTextDocument: async () => ({})
    },
    env: {
      clipboard: {
        writeText: async () => {}
      }
    },
    Uri: {
      file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
    }
  };
}

const api = require('@/lang/rest/api');
const { getSettings, isConfigured } = require('@/lang/rest/config');

/**
 * Pure Factory: Creates the Recent Transactions TreeDataProvider.
 */
function createTransactionsProvider(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedTransactions = null;
  let isLoading = false;
  let lastError = null;

  async function fetchTransactions() {
    if (!isConfigured(vscodeInstance)) {
      return { error: 'CPQ credentials are not configured. Click to configure settings.' };
    }

    try {
      const settings = getSettings(vscodeInstance);
      const process = settings.commerceProcess || 'oraclecpqo';
      const document = settings.commerceDocument || 'transaction';

      // Request common fields first
      let res = await api.getTransactions(context, vscodeInstance, {
        process,
        document,
        limit: 30,
        orderby: 'dateModified_t:desc',
        fields: '_id,transactionID_t,status_t,dateModified_t,customer_t,version_t,totalAmount_t,transactionName_t'
      });

      // If field error, fallback to minimal query
      if (res.statusCode >= 400) {
        res = await api.getTransactions(context, vscodeInstance, {
          process,
          document,
          limit: 30,
          orderby: '_id:desc',
          fields: '_id,transactionID_t'
        });
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        return { error: `HTTP ${res.statusCode}: Failed to fetch transactions` };
      }

      let parsed = res.body;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
      }

      const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
      return { items };
    } catch (err) {
      return { error: err.message || 'Error fetching transactions' };
    }
  }

  async function getChildren(element) {
    if (!element) {
      if (cachedTransactions === null && !isLoading) {
        isLoading = true;
        const res = await fetchTransactions();
        isLoading = false;
        if (res.error) {
          lastError = res.error;
          cachedTransactions = [];
        } else {
          lastError = null;
          cachedTransactions = res.items || [];
        }
      }

      if (lastError) {
        return [{
          type: 'error',
          label: lastError
        }];
      }

      if (!cachedTransactions || cachedTransactions.length === 0) {
        return [{
          type: 'empty',
          label: 'No recent transactions found'
        }];
      }

      return cachedTransactions.map(tx => ({
        type: 'transaction',
        data: tx
      }));
    }

    if (element.type === 'transaction') {
      const tx = element.data;
      const props = [];

      if (tx.status_t) props.push({ key: 'Status', value: String(tx.status_t) });
      if (tx.customer_t) props.push({ key: 'Customer', value: String(tx.customer_t) });
      if (tx.totalAmount_t !== undefined) props.push({ key: 'Total Amount', value: String(tx.totalAmount_t) });
      if (tx.dateModified_t) props.push({ key: 'Date Modified', value: String(tx.dateModified_t) });
      if (tx.version_t !== undefined) props.push({ key: 'Version', value: String(tx.version_t) });
      if (tx._id) props.push({ key: 'Internal _id', value: String(tx._id) });
      if (tx.transactionID_t) props.push({ key: 'Transaction #', value: String(tx.transactionID_t) });

      return props.map(p => ({
        type: 'property',
        key: p.key,
        value: p.value
      }));
    }

    return [];
  }

  function getTreeItem(element) {
    if (element.type === 'error') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('warning', new vscodeInstance.ThemeColor('problemsWarningIcon.foreground'));
      item.command = {
        command: 'cpqBml.settings.open',
        title: 'Open Settings'
      };
      return item;
    }

    if (element.type === 'empty') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('info');
      return item;
    }

    if (element.type === 'property') {
      const item = new vscodeInstance.TreeItem(
        `${element.key}: ${element.value}`,
        vscodeInstance.TreeItemCollapsibleState.None
      );
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-field');
      return item;
    }

    // Transaction Node
    const tx = element.data;
    const txNumber = tx.transactionID_t || tx.transactionId || tx._id || 'Quote';
    const txId = tx._id || txNumber;

    const item = new vscodeInstance.TreeItem(
      String(txNumber),
      vscodeInstance.TreeItemCollapsibleState.Collapsed
    );

    const descParts = [];
    if (tx.customer_t) descParts.push(tx.customer_t);
    if (tx.status_t) descParts.push(tx.status_t);
    if (tx.totalAmount_t !== undefined) descParts.push(`$${tx.totalAmount_t}`);
    item.description = descParts.join(' • ');

    const tooltipLines = [
      `Quote / Transaction: ${txNumber}`,
      `Internal ID (_id): ${txId}`,
      tx.customer_t ? `Customer: ${tx.customer_t}` : null,
      tx.status_t ? `Status: ${tx.status_t}` : null,
      tx.totalAmount_t !== undefined ? `Total: ${tx.totalAmount_t}` : null,
      tx.dateModified_t ? `Modified: ${tx.dateModified_t}` : null,
      tx.version_t !== undefined ? `Version: ${tx.version_t}` : null,
      '---',
      'Click inline actions to inspect, debug BML, or copy ID'
    ].filter(Boolean);

    item.tooltip = tooltipLines.join('\n');
    item.iconPath = new vscodeInstance.ThemeIcon('file-text', new vscodeInstance.ThemeColor('symbolIcon.fieldForeground'));
    item.contextValue = 'cpqTransactionItem';

    item.command = {
      command: 'cpqBml.cloud.inspectTransaction',
      title: 'Inspect Transaction',
      arguments: [element]
    };

    return item;
  }

  function refresh() {
    cachedTransactions = null;
    lastError = null;
    onDidChangeTreeDataEmitter.fire();
  }

  return {
    onDidChangeTreeData,
    getChildren,
    getTreeItem,
    refresh,
    getCachedTransactions: () => cachedTransactions
  };
}

/**
 * Inspects a transaction: fetches full payload and opens in a JSON editor.
 */
async function inspectTransactionCommand(item, vscodeInstance = vscode, context) {
  const tx = item?.data || item;
  if (!tx) {
    vscodeInstance.window.showWarningMessage('No transaction selected to inspect.');
    return;
  }

  const txId = tx._id || tx.transactionID_t || tx.transactionId;
  if (!txId) {
    vscodeInstance.window.showWarningMessage('Transaction ID is missing.');
    return;
  }

  await vscodeInstance.window.withProgress({
    location: 15, // Notification
    title: `Loading transaction #${tx.transactionID_t || txId}...`,
    cancellable: false
  }, async () => {
    try {
      let data = tx;
      const res = await api.getTransaction(context, vscodeInstance, txId);
      if (res && res.statusCode >= 200 && res.statusCode < 300) {
        let body = res.body;
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch {}
        }
        data = body || tx;
      }

      const formatted = JSON.stringify(data, null, 2);
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: formatted,
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(doc);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to inspect transaction: ${err.message}`);
    }
  });
}

/**
 * Triggers BML debugging pre-filled with this transaction's ID.
 */
async function debugOnTransactionCommand(item, vscodeInstance = vscode) {
  const tx = item?.data || item;
  if (!tx) {
    vscodeInstance.window.showWarningMessage('No transaction selected.');
    return;
  }

  const txId = tx._id || tx.transactionID_t || tx.transactionId;
  if (!txId) {
    vscodeInstance.window.showWarningMessage('Transaction ID is missing.');
    return;
  }

  // Execute debug command with the transaction ID
  await vscodeInstance.commands.executeCommand('cpqBml.rest.debugExecution', { transactionId: String(txId) });
}

/**
 * Copies the transaction ID to clipboard.
 */
async function copyTransactionIdCommand(item, vscodeInstance = vscode) {
  const tx = item?.data || item;
  if (!tx) return;
  const txId = tx._id || tx.transactionID_t || tx.transactionId;
  if (!txId) return;

  await vscodeInstance.env.clipboard.writeText(String(txId));
  vscodeInstance.window.showInformationMessage(`Copied Transaction ID '${txId}' to clipboard.`);
}

function registerCloudTransactions(context, vscodeInstance = vscode) {
  const treeDataProvider = createTransactionsProvider(vscodeInstance, context);

  const treeView = vscodeInstance.window.registerTreeDataProvider(
    'cpqBml.recentTransactions',
    treeDataProvider
  );

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.refreshTransactions', () => {
    treeDataProvider.refresh();
  });

  const inspectCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.inspectTransaction', (item) => {
    return inspectTransactionCommand(item, vscodeInstance, context);
  });

  const debugCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.debugOnTransaction', (item) => {
    return debugOnTransactionCommand(item, vscodeInstance);
  });

  const copyCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.copyTransactionId', (item) => {
    return copyTransactionIdCommand(item, vscodeInstance);
  });

  context.subscriptions.push(treeView, refreshCmd, inspectCmd, debugCmd, copyCmd);

  return { treeDataProvider, treeView };
}

module.exports = {
  createTransactionsProvider,
  inspectTransactionCommand,
  debugOnTransactionCommand,
  copyTransactionIdCommand,
  registerCloudTransactions
};
