let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    window: {
      showInputBox: () => {},
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }),
      withProgress: async (opt, task) => task({ report: () => {} })
    }
  };
}

const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, getCommerceProcess, getSettings, isConfigured } = require('@/lang/rest/config');
const { TransactionMockGenerator, fetchRecentTransactions } = require('@/lang/rest/apiTransactionMock');

/**
 * Simulates clicking a Commerce Action and computes attribute deltas.
 */
async function executeAction(transId, actionName, proc, vscodeInstance = vscode, customTransport, context) {
  if (!isConfigured(vscodeInstance)) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }
  const baseUrl = getBaseUrl(vscodeInstance);
  const authHeader = await getAuthHeader(context, vscodeInstance);
  if (!baseUrl || !authHeader) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const process = proc || getCommerceProcess(vscodeInstance) || 'oraclecpqo';

  // 1. Fetch pre-action state
  const beforePayload = await TransactionMockGenerator.fetchTransaction(transId, process, vscodeInstance, customTransport);
  const beforeAttrs = TransactionMockGenerator.extractMockAttributes(beforePayload);

  // 2. Dispatch Action POST
  const actionPath = `/rest/${version}/commerceProcesses/${process}/transactions/${transId}/actions/${actionName}`;
  const res = await request({
    baseUrl,
    path: actionPath,
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    body: {},
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 30000,
    transport: customTransport
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const err = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    throw new Error(`HTTP ${res.statusCode}: ${err || 'Action execution failed'}`);
  }

  const afterPayload = res.body || {};
  const afterAttrs = TransactionMockGenerator.extractMockAttributes(afterPayload);

  // 3. Compute Delta
  const delta = computeAttributeDelta(beforeAttrs, afterAttrs);
  return {
    actionName,
    transactionId: transId,
    delta,
    before: beforeAttrs,
    after: afterAttrs
  };
}

function computeAttributeDelta(before, after) {
  const changes = [];
  const allKeys = new Set([...Object.keys(before.header), ...Object.keys(after.header)]);

  for (const key of allKeys) {
    const oldVal = before.header[key];
    const newVal = after.header[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        attribute: key,
        before: oldVal !== undefined ? oldVal : '(none)',
        after: newVal !== undefined ? newVal : '(deleted)'
      });
    }
  }

  const lineDiff = {
    beforeCount: before.lines.length,
    afterCount: after.lines.length,
    countChanged: before.lines.length !== after.lines.length
  };

  return {
    headerChanges: changes,
    lineDiff
  };
}

function formatDeltaReport(result) {
  const lines = [];
  lines.push(`=== Commerce Action Delta: ${result.actionName} (Quote #${result.transactionId}) ===`);
  lines.push(`Executed At: ${new Date().toISOString()}`);
  lines.push(`--------------------------------------------------------------------------------`);

  if (result.delta.headerChanges.length === 0) {
    lines.push('No header attribute changes detected.');
  } else {
    lines.push(`Header Attributes Modified (${result.delta.headerChanges.length}):`);
    for (const ch of result.delta.headerChanges) {
      lines.push(`  * ${ch.attribute}:`);
      lines.push(`      Before: ${JSON.stringify(ch.before)}`);
      lines.push(`      After:  ${JSON.stringify(ch.after)}`);
    }
  }

  lines.push(`--------------------------------------------------------------------------------`);
  lines.push(`Line Items: ${result.delta.lineDiff.beforeCount} -> ${result.delta.lineDiff.afterCount} lines`);
  lines.push(`================================================================================`);
  return lines.join('\n');
}

let deltaChannel = null;

function registerActionSimulatorCommands(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.rest.simulateAction', async () => {
    let transId = null;
    try {
      const recent = await fetchRecentTransactions(null, 12, vscode);
      if (recent && recent.length > 0) {
        const items = recent.map(t => ({
          label: `$(play) Quote #${t.id}`,
          description: t.status ? `[${t.status}] ${t.amount}` : t.amount,
          detail: t.lastModified ? `Modified: ${t.lastModified}` : undefined,
          id: t.id
        }));
        items.push({
          label: '$(edit) Enter Transaction ID manually...',
          description: 'Input any Quote/Transaction ID',
          id: null
        });
        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a transaction to simulate action on or enter manually'
        });
        if (!picked) return;
        if (picked.id) transId = picked.id;
      }
    } catch (_) {}

    if (!transId) {
      transId = await vscode.window.showInputBox({
        prompt: 'Enter Transaction ID or Quote Number to simulate on',
        placeHolder: 'e.g. 12345678'
      });
    }
    if (!transId || !transId.trim()) return;

    const actionName = await vscode.window.showInputBox({
      prompt: 'Enter Commerce Action Name to execute',
      placeHolder: 'e.g. _recalculate, _save, submit_quote',
      value: '_recalculate'
    });
    if (!actionName || !actionName.trim()) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Simulating Action '${actionName}' on #${transId}...`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 30, message: 'Executing action and computing delta...' });
      try {
        const result = await executeAction(transId.trim(), actionName.trim(), null, vscode);

        if (!deltaChannel) {
          deltaChannel = vscode.window.createOutputChannel('CPQ Action Delta');
        }
        deltaChannel.show(true);
        deltaChannel.appendLine(formatDeltaReport(result));

        vscode.window.showInformationMessage(
          `Action '${actionName}' completed: ${result.delta.headerChanges.length} attributes updated.`
        );
      } catch (err) {
        vscode.window.showErrorMessage(`Action simulation failed: ${err.message}`);
      }
    });
  });

  context.subscriptions.push(disposable);
}

const ActionSimulator = {
  executeAction,
  computeAttributeDelta,
  formatDeltaReport
};

module.exports = {
  executeAction,
  computeAttributeDelta,
  formatDeltaReport,
  ActionSimulator,
  registerActionSimulatorCommands
};
