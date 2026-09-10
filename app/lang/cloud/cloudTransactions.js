const { vscode, safeParseJson, extractStringValue } = require('./cloudVscodeShim');

const api = require('@/lang/rest/api');
const { getSettings, isConfigured } = require('@/lang/rest/config');
const { describeError } = require('@/lang/rest/commands/shared');

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

      const res = await api.getTransactions(context, vscodeInstance, {
        process,
        document,
        limit: 30,
        excludeFieldTypes: false,
        orderby: 'dateModified_t:desc',
        fields: '_id,transactionID_t,status_t,dateModified_t,customer_t,version_t,totalAmount_t,transactionName_t'
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        const errDetail = describeError(res.body);
        const msg = errDetail
          ? `HTTP ${res.statusCode}: ${errDetail}`
          : `HTTP ${res.statusCode}: Failed to fetch transactions for '${process}/${document}' (Click to switch process)`;
        return { error: msg, process, document };
      }

      const parsed = safeParseJson(res.body);
      const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
      return { items, process, document };
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
          label: lastError,
          command: {
            command: 'cpqBml.cloud.switchCommerceProcess',
            title: 'Switch Commerce Process'
          }
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

      const status = extractStringValue(tx.status_t);
      if (status) props.push({ key: 'Status', value: status });

      const customer = extractStringValue(tx.customer_t);
      if (customer) props.push({ key: 'Customer', value: customer });

      const totalAmount = extractStringValue(tx.totalAmount_t);
      if (totalAmount) props.push({ key: 'Total Amount', value: totalAmount.startsWith('$') ? totalAmount : `$${totalAmount}` });

      const dateModified = extractStringValue(tx.dateModified_t);
      if (dateModified) props.push({ key: 'Date Modified', value: dateModified });

      const version = extractStringValue(tx.version_t);
      if (version) props.push({ key: 'Version', value: version });

      const internalId = extractStringValue(tx._id);
      if (internalId) props.push({ key: 'Internal _id', value: internalId });

      const txNum = extractStringValue(tx.transactionID_t || tx.transactionId);
      if (txNum) props.push({ key: 'Transaction #', value: txNum });

      const txName = extractStringValue(tx.transactionName_t);
      if (txName) props.push({ key: 'Transaction Name', value: txName });

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
      item.command = element.command || {
        command: 'cpqBml.settings.open',
        title: 'Open Settings'
      };
      item.tooltip = 'Click to switch commerce process / document or configure settings';
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
    const txNumber = extractStringValue(tx.transactionID_t || tx.transactionId || tx._id, 'Quote');
    const txId = extractStringValue(tx._id || tx.transactionID_t || tx.transactionId, txNumber);

    const item = new vscodeInstance.TreeItem(
      txNumber,
      vscodeInstance.TreeItemCollapsibleState.Collapsed
    );

    const customer = extractStringValue(tx.customer_t);
    const status = extractStringValue(tx.status_t);
    const totalAmount = extractStringValue(tx.totalAmount_t);
    const dateModified = extractStringValue(tx.dateModified_t);
    const version = extractStringValue(tx.version_t);

    const descParts = [];
    if (customer) descParts.push(customer);
    if (status) descParts.push(status);
    if (totalAmount) descParts.push(totalAmount.startsWith('$') ? totalAmount : `$${totalAmount}`);
    item.description = descParts.join(' • ');

    const tooltipLines = [
      `Quote / Transaction: ${txNumber}`,
      `Internal ID (_id): ${txId}`,
      customer ? `Customer: ${customer}` : null,
      status ? `Status: ${status}` : null,
      totalAmount ? `Total: ${totalAmount}` : null,
      dateModified ? `Modified: ${dateModified}` : null,
      version ? `Version: ${version}` : null,
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

  const rawTxId = tx._id || tx.transactionID_t || tx.transactionId;
  const txId = extractStringValue(rawTxId);
  if (!txId) {
    vscodeInstance.window.showWarningMessage('Transaction ID is missing.');
    return;
  }

  const txNum = extractStringValue(tx.transactionID_t, txId);
  const settings = getSettings(vscodeInstance);
  const process = settings.commerceProcess || tx.process || 'oraclecpqo';
  const document = settings.commerceDocument || tx.document || 'transaction';

  await vscodeInstance.window.withProgress({
    location: 15, // Notification
    title: `Loading transaction #${txNum}...`,
    cancellable: false
  }, async () => {
    let data = tx;
    try {
      const res = await api.getTransaction(context, vscodeInstance, txId, { process, document, timeoutMs: 60000 });
      if (res && res.statusCode >= 200 && res.statusCode < 300) {
        data = safeParseJson(res.body, tx);
      } else if (tx.transactionID_t && String(tx.transactionID_t) !== String(txId)) {
        const altRes = await api.getTransaction(context, vscodeInstance, String(tx.transactionID_t), { process, document, timeoutMs: 30000 });
        if (altRes && altRes.statusCode >= 200 && altRes.statusCode < 300) {
          data = safeParseJson(altRes.body, tx);
        }
      }
    } catch (err) {
      vscodeInstance.window.showWarningMessage(
        `Full payload request for #${txNum} timed out or failed (${err.message}). Opening available transaction summary.`
      );
    }

    try {
      const formatted = JSON.stringify(data, null, 2);
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: formatted,
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(doc);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to display transaction: ${err.message}`);
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

  const rawTxId = tx._id || tx.transactionID_t || tx.transactionId;
  const txId = extractStringValue(rawTxId);
  if (!txId) {
    vscodeInstance.window.showWarningMessage('Transaction ID is missing.');
    return;
  }

  // Execute debug command with the transaction ID
  try {
    await vscodeInstance.commands.executeCommand('cpqBml.rest.debugExecution', { transactionId: String(txId) });
  } catch {
    await vscodeInstance.commands.executeCommand('cpqBml.rest.debugCurrentFile', { transactionId: String(txId) });
  }
}

/**
 * Copies the transaction ID to clipboard.
 */
async function copyTransactionIdCommand(item, vscodeInstance = vscode) {
  const tx = item?.data || item;
  if (!tx) return;
  const rawTxId = tx._id || tx.transactionID_t || tx.transactionId;
  const txId = extractStringValue(rawTxId);
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
