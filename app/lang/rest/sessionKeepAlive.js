let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { showWarningMessage: () => {} }
  };
}

const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion } = require('@/lang/rest/config');

/**
 * Background heartbeat service keeping CPQ sessions and tokens alive.
 */
async function pingSession(vscodeInstance = vscode, customTransport) {
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

    if (res.statusCode === 401) {
      vscodeInstance.window.showWarningMessage('CPQ Session expired. Please re-authenticate or refresh credentials.');
      return { success: false, statusCode: 401 };
    }

    return { success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode };
  } catch {
    return { success: false, reason: 'Network error' };
  }
}

function createSessionKeepAlive() {
  let timer = null;
  const intervalMs = 15 * 60 * 1000;
  let lastPingTime = null;
  let isActive = false;

  async function ping(vscodeInstance = vscode, customTransport) {
    const res = await pingSession(vscodeInstance, customTransport);
    lastPingTime = new Date();
    return res;
  }

  function start(vscodeInstance = vscode, customTransport) {
    if (isActive) return;
    const baseUrl = getBaseUrl(vscodeInstance);
    const authHeader = getAuthHeader(vscodeInstance);
    if (!baseUrl || !authHeader) return;
    isActive = true;

    timer = setInterval(async () => {
      await ping(vscodeInstance, customTransport);
    }, intervalMs);
  }

  function stop() {
    isActive = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function dispose() {
    stop();
  }

  return {
    get isActive() { return isActive; },
    get lastPingTime() { return lastPingTime; },
    start,
    ping,
    stop,
    dispose
  };
}

function SessionKeepAlive() {
  return createSessionKeepAlive();
}

let keepAliveInstance = null;

function getSessionKeepAlive() {
  if (!keepAliveInstance) {
    keepAliveInstance = createSessionKeepAlive();
  }
  return keepAliveInstance;
}

module.exports = {
  pingSession,
  createSessionKeepAlive,
  getSessionKeepAlive,
  SessionKeepAlive
};
