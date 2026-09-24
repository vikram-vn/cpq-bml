'use strict';

const { vscode, safeParseJson, extractStringValue } = require('@/lang/cloud/cloudVscodeShim');
const api = require('@/lang/rest/api');
const { getSettings, isConfigured } = require('@/lang/rest/config');

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

/**
 * QuickPick interactive transaction debugger: fetches recent quotes/transactions,
 * lets user choose one, and triggers remote BML debugging with that transaction ID.
 */
async function debugWithQuoteCommand(provider, vscodeInstance = vscode, context) {
  if (!isConfigured(vscodeInstance)) {
    vscodeInstance.window.showWarningMessage('CPQ credentials are not configured. Click to configure settings.');
    return { success: false, reason: 'Unconfigured' };
  }

  let txs = provider && typeof provider.getCachedTransactions === 'function'
    ? provider.getCachedTransactions()
    : null;

  if (!txs || txs.length === 0) {
    await vscodeInstance.window.withProgress({
      location: 15,
      title: 'Fetching recent transactions from CPQ...',
      cancellable: false
    }, async () => {
      if (provider && typeof provider.getChildren === 'function') {
        await provider.getChildren();
        txs = provider.getCachedTransactions ? provider.getCachedTransactions() : [];
      } else {
        const settings = getSettings(vscodeInstance);
        const process = settings.commerceProcess || 'oraclecpqo';
        const document = settings.commerceDocument || 'transaction';
        const res = await api.getTransactions({
          process,
          document,
          limit: 20,
          orderby: '_date_modified:desc'
        });
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          const parsed = safeParseJson(res.body);
          txs = Array.isArray(parsed) ? parsed : (parsed?.items || []);
        }
      }
    });
  }

  if (!txs || txs.length === 0) {
    vscodeInstance.window.showInformationMessage('No transactions found on the active CPQ environment.');
    return { success: false, reason: 'No transactions' };
  }

  const items = txs.map(tx => {
    const id = extractStringValue(tx.transactionID_t || tx._id || tx.transactionId, 'Unknown');
    const cust = extractStringValue(tx.customer_t || tx._customer_t_company_name, '');
    const status = extractStringValue(tx.status_t, 'Draft');
    const name = extractStringValue(tx.transactionName_t || tx.name, '');
    const date = extractStringValue(tx._date_modified || tx.dateModified_t, '');
    return {
      label: `$(history) ${id}`,
      description: [status ? `[${status}]` : '', cust].filter(Boolean).join(' • '),
      detail: [name, date ? `Modified: ${date}` : ''].filter(Boolean).join(' | '),
      data: tx
    };
  });

  const selected = await vscodeInstance.window.showQuickPick(items, {
    placeHolder: 'Select a Transaction / Quote to debug current BML function with...',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selected || !selected.data) {
    return { success: false, reason: 'Cancelled' };
  }

  await debugOnTransactionCommand(selected, vscodeInstance);
  const selectedId = extractStringValue(selected.data?.transactionID_t || selected.data?._id || selected.data?.transactionId, 'Unknown');
  return { success: true, transactionId: selectedId };
}

module.exports = {
  debugOnTransactionCommand,
  copyTransactionIdCommand,
  debugWithQuoteCommand
};
