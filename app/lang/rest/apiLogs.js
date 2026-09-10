let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }) }
  };
}

const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, getSettings } = require('@/lang/rest/config');

function formatLogEntry(entry) {
  const time = entry.timestamp || new Date().toISOString();
  const severity = (entry.severity || entry.level || 'INFO').toUpperCase();
  const script = entry.scriptName || entry.functionName || entry.source || 'BML';
  const line = entry.lineNumber ? `:${entry.lineNumber}` : '';
  const msg = entry.message || entry.text || JSON.stringify(entry);

  return `[${time}] [${severity}] [${script}${line}] ${msg}`;
}

async function fetchLogs(vscodeInstance = vscode, customTransport) {
  const settings = getSettings(vscodeInstance);
  const baseUrl = getBaseUrl(vscodeInstance);
  const authHeader = getAuthHeader(vscodeInstance);

  if (!baseUrl || !authHeader) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const path = `/rest/${version}/developerLogs?limit=50&orderBy=timestamp:desc`;

  const res = await request({
    baseUrl,
    path,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    timeoutMs: settings.timeoutMs || 15000,
    transport: customTransport
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    const body = res.body;
    const items = Array.isArray(body?.items) ? body.items : (Array.isArray(body) ? body : []);
    return items;
  } else {
    const errText = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    throw new Error(`HTTP ${res.statusCode}: ${errText || 'Failed to fetch logs'}`);
  }
}

function createLogStreamer() {
  let outputChannel = null;
  let isStreaming = false;
  let timer = null;
  const pollIntervalMs = 5000;
  let lastSeenTimestamp = null;

  function getChannel() {
    if (!outputChannel) {
      outputChannel = vscode.window.createOutputChannel('CPQ Server Logs');
    }
    return outputChannel;
  }

  function startStream(vscodeInstance = vscode, customTransport) {
    if (isStreaming) return;
    isStreaming = true;

    const channel = getChannel();
    channel.show(true);
    channel.appendLine(`[${new Date().toISOString()}] === Started CPQ Server Log Streaming ===`);

    const poll = async () => {
      if (!isStreaming) return;
      try {
        const logs = await fetchLogs(vscodeInstance, customTransport);
        if (logs.length > 0) {
          const chronological = [...logs].reverse();
          for (const item of chronological) {
            const itemTime = item.timestamp || '';
            if (!lastSeenTimestamp || itemTime > lastSeenTimestamp) {
              channel.appendLine(formatLogEntry(item));
              if (itemTime) lastSeenTimestamp = itemTime;
            }
          }
        }
      } catch (err) {
        channel.appendLine(`[${new Date().toISOString()}] [STREAM_ERROR] ${err.message}`);
      } finally {
        if (isStreaming) {
          timer = setTimeout(poll, pollIntervalMs);
        }
      }
    };

    poll();
  }

  function stopStream() {
    isStreaming = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (outputChannel) {
      outputChannel.appendLine(`[${new Date().toISOString()}] === Stopped CPQ Server Log Streaming ===`);
    }
  }

  function dispose() {
    stopStream();
    if (outputChannel) {
      outputChannel.dispose();
      outputChannel = null;
    }
  }

  return {
    get isStreaming() { return isStreaming; },
    set isStreaming(val) { isStreaming = val; },
    get timer() { return timer; },
    set timer(val) { timer = val; },
    getChannel,
    fetchLogs,
    startStream,
    stopStream,
    dispose
  };
}

function RemoteLogStreamer() {
  return createLogStreamer();
}
RemoteLogStreamer.formatLogEntry = formatLogEntry;

let streamerInstance = null;

function getLogStreamer() {
  if (!streamerInstance) {
    streamerInstance = createLogStreamer();
  }
  return streamerInstance;
}

module.exports = {
  formatLogEntry,
  fetchLogs,
  createLogStreamer,
  getLogStreamer,
  RemoteLogStreamer
};
