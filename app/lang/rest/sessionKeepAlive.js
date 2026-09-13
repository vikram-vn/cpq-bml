let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { showWarningMessage: () => {} }
  };
}

const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, isConfigured } = require('@/lang/rest/config');

/**
 * Background heartbeat service keeping CPQ sessions and tokens alive.
 */
async function pingSession(vscodeInstance = vscode, customTransport, context) {
  if (!isConfigured(vscodeInstance)) return { success: false, reason: 'Not configured' };
  const baseUrl = getBaseUrl(vscodeInstance);
  let authHeader;
  try {
    authHeader = await getAuthHeader(context, vscodeInstance);
  } catch {
    if (!customTransport) {
      return { success: false, reason: 'Credentials not configured' };
    }
  }
  if (!baseUrl || (!authHeader && !customTransport)) return { success: false, reason: 'Not configured' };

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

  async function ping(vscodeInstance = vscode, customTransport, context) {
    const res = await pingSession(vscodeInstance, customTransport, context);
    lastPingTime = new Date();
    return res;
  }

  function start(vscodeInstance = vscode, customTransport, context) {
    if (isActive) return;
    if (!isConfigured(vscodeInstance)) return;
    const baseUrl = getBaseUrl(vscodeInstance);
    if (!baseUrl) return;
    isActive = true;

    timer = setInterval(async () => {
      await ping(vscodeInstance, customTransport, context);
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
