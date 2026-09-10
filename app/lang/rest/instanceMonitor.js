let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      createStatusBarItem: () => ({ show: () => {}, dispose: () => {} }),
      showInformationMessage: () => {},
      showErrorMessage: () => {}
    },
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    StatusBarAlignment: { Right: 2 },
    MarkdownString: class {
      constructor(val = '') { this.value = val; }
      appendMarkdown(val) { this.value += val; }
    }
  };
}

const { request } = require('./client');
const { getBaseUrl, getAuthHeader, getRestVersion, getSettings } = require('./config');

/**
 * Monitors CPQ instance health, version, and round-trip network latency.
 */
class InstanceMonitor {
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    this.statusBarItem.command = 'cpqBml.rest.checkHealth';
    this.lastHealth = null;
    this.timer = null;
    this.updateStatusText('Offline / Standby');
    this.statusBarItem.show();
  }

  updateStatusText(text) {
    this.statusBarItem.text = `$(server) ${text}`;
  }

  async checkHealth(vscodeInstance = vscode, customTransport) {
    const baseUrl = getBaseUrl(vscodeInstance);
    const authHeader = getAuthHeader(vscodeInstance);

    if (!baseUrl || !authHeader) {
      this.updateStatusText('CPQ: Not Configured');
      this.statusBarItem.tooltip = 'Click to configure Oracle CPQ connection settings';
      return { connected: false, reason: 'Credentials not configured' };
    }

    const version = getRestVersion(vscodeInstance);
    const path = `/rest/${version}`;
    const t0 = Date.now();

    try {
      const res = await request({
        baseUrl,
        path,
        method: 'GET',
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeoutMs: getSettings(vscodeInstance).timeoutMs || 10000,
        transport: customTransport
      });

      const latencyMs = Date.now() - t0;
      const ok = res.statusCode >= 200 && res.statusCode < 300;

      let siteName = 'CPQ';
      try {
        const u = new URL(baseUrl);
        siteName = u.hostname.split('.')[0];
      } catch {
        siteName = baseUrl.replace(/^https?:\/\//, '').split('/')[0].split('.')[0];
      }

      const release = ok ? `v${version}` : `HTTP ${res.statusCode}`;
      this.updateStatusText(`${siteName} (${release} - ${latencyMs}ms)`);

      const tooltip = new vscode.MarkdownString();
      tooltip.appendMarkdown(`**Oracle CPQ Instance Health**\n\n`);
      tooltip.appendMarkdown(`- **Site**: \`${baseUrl}\`\n`);
      tooltip.appendMarkdown(`- **Status**: \`${res.statusCode} ${ok ? 'OK' : 'Error'}\`\n`);
      tooltip.appendMarkdown(`- **Latency**: \`${latencyMs}ms\`\n`);
      tooltip.appendMarkdown(`- **REST Version**: \`${version}\`\n`);
      tooltip.appendMarkdown(`- **Last Checked**: \`${new Date().toLocaleTimeString()}\`\n\n`);
      tooltip.appendMarkdown(`*Click to re-check health and network round-trip latency.*`);
      this.statusBarItem.tooltip = tooltip;

      this.lastHealth = { connected: ok, latencyMs, statusCode: res.statusCode, siteName, version };
      return this.lastHealth;
    } catch (err) {
      this.updateStatusText('CPQ: Unreachable');
      this.statusBarItem.tooltip = `Connection failed: ${err.message}`;
      return { connected: false, reason: err.message };
    }
  }

  startPeriodicChecks(intervalMs = 5 * 60 * 1000) {
    this.checkHealth();
    this.timer = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.statusBarItem.dispose();
  }
}

let monitorInstance = null;

function getInstanceMonitor() {
  if (!monitorInstance) {
    monitorInstance = new InstanceMonitor();
  }
  return monitorInstance;
}

function registerInstanceMonitorCommands(context) {
  const monitor = getInstanceMonitor();
  context.subscriptions.push(
    monitor,
    vscode.commands.registerCommand('cpqBml.rest.checkHealth', async () => {
      const h = await monitor.checkHealth(vscode);
      if (h.connected) {
        vscode.window.showInformationMessage(
          `Connected to ${h.siteName} (${h.version}): Latency ${h.latencyMs}ms.`
        );
      } else {
        vscode.window.showWarningMessage(`CPQ health check: ${h.reason || 'Unreachable'}`);
      }
    })
  );
  monitor.startPeriodicChecks();
}

module.exports = { InstanceMonitor, getInstanceMonitor, registerInstanceMonitorCommands };
