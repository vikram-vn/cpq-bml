let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }) }
  };
}

const { request } = require('./client');
const { getBaseUrl, getAuthHeader, getRestVersion, getSettings } = require('./config');

/**
 * Remote Log Streamer fetching BML runtime logs and server errors from Oracle CPQ.
 */
class RemoteLogStreamer {
  constructor() {
    this.outputChannel = null;
    this.isStreaming = false;
    this.timer = null;
    this.pollIntervalMs = 5000;
    this.lastSeenTimestamp = null;
  }

  getChannel() {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('CPQ Server Logs');
    }
    return this.outputChannel;
  }

  static formatLogEntry(entry) {
    const time = entry.timestamp || new Date().toISOString();
    const severity = (entry.severity || entry.level || 'INFO').toUpperCase();
    const script = entry.scriptName || entry.functionName || entry.source || 'BML';
    const line = entry.lineNumber ? `:${entry.lineNumber}` : '';
    const msg = entry.message || entry.text || JSON.stringify(entry);

    return `[${time}] [${severity}] [${script}${line}] ${msg}`;
  }

  async fetchLogs(vscodeInstance = vscode, customTransport) {
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

  startStream(vscodeInstance = vscode, customTransport) {
    if (this.isStreaming) return;
    this.isStreaming = true;

    const channel = this.getChannel();
    channel.show(true);
    channel.appendLine(`[${new Date().toISOString()}] === Started CPQ Server Log Streaming ===`);

    const poll = async () => {
      if (!this.isStreaming) return;
      try {
        const logs = await this.fetchLogs(vscodeInstance, customTransport);
        if (logs.length > 0) {
          // Sort ascending chronologically for streaming display
          const chronological = [...logs].reverse();
          for (const item of chronological) {
            const itemTime = item.timestamp || '';
            if (!this.lastSeenTimestamp || itemTime > this.lastSeenTimestamp) {
              channel.appendLine(RemoteLogStreamer.formatLogEntry(item));
              if (itemTime) this.lastSeenTimestamp = itemTime;
            }
          }
        }
      } catch (err) {
        channel.appendLine(`[${new Date().toISOString()}] [STREAM_ERROR] ${err.message}`);
      } finally {
        if (this.isStreaming) {
          this.timer = setTimeout(poll, this.pollIntervalMs);
        }
      }
    };

    poll();
  }

  stopStream() {
    this.isStreaming = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.outputChannel) {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] === Stopped CPQ Server Log Streaming ===`);
    }
  }

  dispose() {
    this.stopStream();
    if (this.outputChannel) {
      this.outputChannel.dispose();
      this.outputChannel = null;
    }
  }
}

let streamerInstance = null;

function getLogStreamer() {
  if (!streamerInstance) {
    streamerInstance = new RemoteLogStreamer();
  }
  return streamerInstance;
}

module.exports = { RemoteLogStreamer, getLogStreamer };
