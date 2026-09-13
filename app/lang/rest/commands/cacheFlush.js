let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    window: { showInformationMessage: () => {}, showErrorMessage: () => {}, withProgress: async (opt, task) => task({ report: () => {} }) }
  };
}

const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, getSettings, isConfigured } = require('@/lang/rest/config');

/**
 * Dispatches cache invalidation request to Oracle CPQ server.
 */
async function flushServerCache(vscodeInstance = vscode, customTransport, context) {
  const baseUrl = getBaseUrl(vscodeInstance);
  if (!baseUrl) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }
  let authHeader = "";
  try {
    authHeader = await getAuthHeader(context, vscodeInstance);
  } catch (err) {
    if (!customTransport) throw err;
  }
  if (!authHeader && !customTransport) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const path = `/rest/${version}/actions/_flushCache`;

  const res = await request({
    baseUrl,
    path,
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    body: { flushAll: true },
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 25000,
    transport: customTransport
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { success: true, message: 'CPQ Server Cache successfully flushed.' };
  } else {
    const err = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    throw new Error(`HTTP ${res.statusCode}: ${err || 'Failed to flush server cache'}`);
  }
}

function registerCacheFlushCommand(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.rest.flushCache', async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Flushing CPQ Server Cache...',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 50, message: 'Invalidating cached BML & Data Table definitions...' });
      try {
        await flushServerCache(vscode);
        vscode.window.showInformationMessage('CPQ Server Cache & metadata successfully refreshed.');
      } catch (err) {
        vscode.window.showErrorMessage(`Cache flush error: ${err.message}`);
      }
    });
  });

  context.subscriptions.push(disposable);
}

module.exports = { flushServerCache, registerCacheFlushCommand };
