let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { showWarningMessage: () => {} }
  };
}

const { request } = require('./client');
const { getBaseUrl, getAuthHeader, getRestVersion } = require('./config');

/**
 * Background heartbeat service keeping CPQ sessions and tokens alive.
 */
class SessionKeepAlive {
  constructor() {
    this.timer = null;
    this.intervalMs = 15 * 60 * 1000; // 15 minutes
    this.lastPingTime = null;
    this.isActive = false;
  }

  start(vscodeInstance = vscode, customTransport) {
    if (this.isActive) return;
    this.isActive = true;

    // First ping after 1 minute, then recurring every intervalMs
    this.timer = setInterval(async () => {
      await this.ping(vscodeInstance, customTransport);
    }, this.intervalMs);
  }

  async ping(vscodeInstance = vscode, customTransport) {
    const baseUrl = getBaseUrl(vscodeInstance);
    const authHeader = getAuthHeader(vscodeInstance);
    if (!baseUrl || !authHeader) return { success: false, reason: 'Not configured' };

    const version = getRestVersion(vscodeInstance);
    const path = `/rest/${version}`;

    try {
      const res = await request({
        baseUrl,
        path,
        method: 'GET',
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeoutMs: 10000,
        transport: customTransport
      });

      this.lastPingTime = new Date();

      if (res.statusCode === 401) {
        vscodeInstance.window.showWarningMessage('CPQ Session expired. Please re-authenticate or refresh credentials.');
        return { success: false, statusCode: 401 };
      }

      return { success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode };
    } catch {
      return { success: false, reason: 'Network error' };
    }
  }

  stop() {
    this.isActive = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose() {
    this.stop();
  }
}

let keepAliveInstance = null;

function getSessionKeepAlive() {
  if (!keepAliveInstance) {
    keepAliveInstance = new SessionKeepAlive();
  }
  return keepAliveInstance;
}

module.exports = { SessionKeepAlive, getSessionKeepAlive };
