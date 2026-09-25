let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      createStatusBarItem: () => ({ show: () => {}, hide: () => {}, dispose: () => {} }),
      showInformationMessage: () => {},
      showErrorMessage: () => {}
    },
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    StatusBarAlignment: { Right: 2 },
    MarkdownString: function(val = '') {
      this.value = val;
      this.appendMarkdown = function(v) { this.value += v; };
    }
  };
}

const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, getSettings, isConfigured } = require('@/lang/rest/config');
const { isBmlActive } = require('@/extensionContext');

async function checkInstanceHealth(vscodeInstance = vscode, customTransport, statusBarItem, context) {
  const updateStatus = (text, tooltip, isError = false) => {
    if (statusBarItem) {
      statusBarItem.text = `$(server) ${text}`;
      if (tooltip !== undefined) statusBarItem.tooltip = tooltip;
      if (isError && vscodeInstance.ThemeColor) {
        statusBarItem.backgroundColor = new vscodeInstance.ThemeColor('statusBarItem.warningBackground');
      } else {
        statusBarItem.backgroundColor = undefined;
      }
    }
  };

  if (!isConfigured(vscodeInstance)) {
    updateStatus('Offline / Standby', 'Click to configure Oracle CPQ connection settings');
    return { connected: false, reason: 'Credentials not configured' };
  }

  const baseUrl = getBaseUrl(vscodeInstance);
  let authHeader;
  try {
    authHeader = await getAuthHeader(context, vscodeInstance);
  } catch (err) {
    if (!customTransport) {
      updateStatus('Offline / Standby', err.message || 'Credentials not configured', true);
      return { connected: false, reason: err.message };
    }
  }

  if (!baseUrl || (!authHeader && !customTransport)) {
    updateStatus('Offline / Standby', 'Click to configure Oracle CPQ connection settings');
    return { connected: false, reason: 'Credentials not configured' };
  }

  const version = getRestVersion(vscodeInstance);
  const t0 = Date.now();

  try {
    let res = await request({
      baseUrl,
      path: `/rest/${version}/currentUser`,
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
      timeoutMs: getSettings(vscodeInstance).timeoutMs || 10000,
      transport: customTransport
    });

    if (res && res.statusCode === 404) {
      res = await request({
        baseUrl,
        path: `/rest/${version}/datatables`,
        query: { limit: 1 },
        method: 'GET',
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeoutMs: getSettings(vscodeInstance).timeoutMs || 10000,
        transport: customTransport
      });
    }

    const latencyMs = Date.now() - t0;
    const ok = Boolean(res && res.statusCode >= 200 && res.statusCode < 300);

    let siteName = 'CPQ';
    try {
      const u = new URL(baseUrl);
      siteName = u.hostname.split('.')[0];
    } catch {
      siteName = baseUrl.replace(/^https?:\/\//, '').split('/')[0].split('.')[0];
    }

    const normalizedVer = (version || '').replace(/^v+/i, '');
    const cleanVersion = normalizedVer ? `v${normalizedVer}` : (version || 'v18');
    const release = ok ? cleanVersion : `HTTP ${res ? res.statusCode : 'Error'}`;
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**Oracle CPQ Instance Health**\n\n`);
    tooltip.appendMarkdown(`- **Site**: \`${baseUrl}\`\n`);
    tooltip.appendMarkdown(`- **Status**: \`${res ? res.statusCode : 'N/A'} ${ok ? 'OK' : 'Error'}\`\n`);
    tooltip.appendMarkdown(`- **Latency**: \`${latencyMs}ms\`\n`);
    tooltip.appendMarkdown(`- **REST Version**: \`${cleanVersion}\`\n`);
    tooltip.appendMarkdown(`- **Last Checked**: \`${new Date().toLocaleTimeString()}\`\n\n`);
    tooltip.appendMarkdown(`*Click to re-check health and network round-trip latency.*`);

    updateStatus(`${siteName} (${release} - ${latencyMs}ms)`, tooltip, !ok);

    return {
      connected: ok,
      latencyMs,
      statusCode: res ? res.statusCode : undefined,
      siteName,
      version: cleanVersion,
      reason: ok ? undefined : (res ? (res.statusCode === 401 ? 'Authentication failed (401)' : res.statusCode === 403 ? 'Access forbidden (403)' : `HTTP ${res.statusCode}`) : 'No response')
    };
  } catch (err) {
    updateStatus('CPQ: Unreachable', `Connection failed: ${err.message}`, true);
    return { connected: false, reason: err.message };
  }
}

function createInstanceMonitor(vscodeInstance = vscode, context) {
  const statusBarItem = vscodeInstance.window.createStatusBarItem(vscodeInstance.StatusBarAlignment.Right, 90);
  statusBarItem.command = 'cpqBml.rest.checkHealth';
  statusBarItem.text = '$(server) Offline / Standby';

  const updateVisibility = () => {
    if (!statusBarItem) return;
    if (isBmlActive(vscodeInstance)) {
      if (typeof statusBarItem.show === 'function') statusBarItem.show();
    } else {
      if (typeof statusBarItem.hide === 'function') statusBarItem.hide();
    }
  };

  updateVisibility();

  let editorSub = null;
  if (vscodeInstance && vscodeInstance.window && typeof vscodeInstance.window.onDidChangeActiveTextEditor === 'function') {
    editorSub = vscodeInstance.window.onDidChangeActiveTextEditor(updateVisibility);
  }

  let lastHealth = null;
  let timer = null;
  let startupTimer = null;

  async function checkHealth(customVscode = vscodeInstance, customTransport, customContext = context) {
    const result = await checkInstanceHealth(customVscode, customTransport, statusBarItem, customContext);
    lastHealth = result;
    return result;
  }

  function startPeriodicChecks(intervalMs = 5 * 60 * 1000, initialDelayMs = 10000) {
    if (initialDelayMs > 0) {
      startupTimer = setTimeout(() => {
        startupTimer = null;
        checkHealth();
      }, initialDelayMs);
    } else {
      checkHealth();
    }
    timer = setInterval(() => {
      checkHealth();
    }, intervalMs);
  }

  function dispose() {
    if (editorSub) {
      editorSub.dispose();
      editorSub = null;
    }
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    statusBarItem.dispose();
  }

  return {
    statusBarItem,
    get lastHealth() { return lastHealth; },
    checkHealth,
    startPeriodicChecks,
    updateVisibility,
    dispose
  };
}

function InstanceMonitor(context) {
  return createInstanceMonitor(vscode, context);
}

let monitorInstance = null;

function getInstanceMonitor(context) {
  if (!monitorInstance) {
    monitorInstance = createInstanceMonitor(vscode, context);
  }
  return monitorInstance;
}

function registerInstanceMonitorCommands(context) {
  const monitor = getInstanceMonitor(context);
  context.subscriptions.push(
    monitor,
    vscode.commands.registerCommand('cpqBml.rest.checkHealth', async () => {
      const h = await monitor.checkHealth(vscode, undefined, context);
      if (h.connected) {
        vscode.window.showInformationMessage(
          `Connected to ${h.siteName} (${h.version}): Latency ${h.latencyMs}ms.`
        );
      } else {
        vscode.window.showWarningMessage(`CPQ health check: ${h.reason || (h.statusCode ? `HTTP ${h.statusCode}` : 'Unreachable')}`);
      }
    })
  );
  monitor.startPeriodicChecks();
}

module.exports = {
  checkInstanceHealth,
  createInstanceMonitor,
  getInstanceMonitor,
  registerInstanceMonitorCommands,
  InstanceMonitor
};
