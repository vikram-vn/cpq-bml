let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    window: { showInformationMessage: () => {}, showErrorMessage: () => {} }
  };
}

const { getLogStreamer, formatLogEntry } = require('@/lang/rest/apiLogs');

function registerLogCommands(context) {
  const streamer = getLogStreamer();

  let statusBarItem = null;
  if (vscode.window && typeof vscode.window.createStatusBarItem === 'function') {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 92);
    statusBarItem.command = 'cpqBml.rest.toggleLogStream';
    statusBarItem.text = '$(output) BML Logs: Off';
    statusBarItem.tooltip = 'Click to start streaming live CPQ server error & print logs';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
  }

  function updateStatus(active) {
    if (!statusBarItem) return;
    if (active) {
      statusBarItem.text = '$(broadcast) BML Logs: Streaming';
      statusBarItem.tooltip = 'CPQ live log stream is ACTIVE. Click to stop.';
    } else {
      statusBarItem.text = '$(output) BML Logs: Off';
      statusBarItem.tooltip = 'CPQ live log stream is OFF. Click to start.';
    }
  }

  function doToggleStream(vscodeInst = vscode) {
    if (streamer.isStreaming) {
      streamer.stopStream();
      updateStatus(false);
      vscodeInst.window?.showInformationMessage?.('Stopped CPQ server log stream.');
      return { streaming: false };
    } else {
      try {
        streamer.startStream(vscodeInst);
        updateStatus(true);
        vscodeInst.window?.showInformationMessage?.('Started streaming CPQ server error & print logs.');
        return { streaming: true };
      } catch (err) {
        vscodeInst.window?.showErrorMessage?.(`Failed to start log stream: ${err.message}`);
        return { streaming: false, error: err.message };
      }
    }
  }

  context.subscriptions.push(
    streamer,
    vscode.commands.registerCommand('cpqBml.rest.startLogStream', () => {
      try {
        streamer.startStream(vscode);
        updateStatus(true);
        vscode.window.showInformationMessage('Started streaming CPQ server error & print logs.');
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to start log stream: ${err.message}`);
      }
    }),
    vscode.commands.registerCommand('cpqBml.rest.stopLogStream', () => {
      streamer.stopStream();
      updateStatus(false);
      vscode.window.showInformationMessage('Stopped CPQ server log stream.');
    }),
    vscode.commands.registerCommand('cpqBml.rest.toggleLogStream', () => {
      return doToggleStream(vscode);
    }),
    vscode.commands.registerCommand('cpqBml.rest.fetchLogs', async () => {
      try {
        const logs = await streamer.fetchLogs(vscode);
        const channel = streamer.getChannel();
        channel.show(true);
        channel.appendLine(`[${new Date().toISOString()}] === Fetched ${logs.length} Recent CPQ Logs ===`);
        for (const item of logs.slice(0, 30)) {
          channel.appendLine(formatLogEntry(item));
        }
        vscode.window.showInformationMessage(`Fetched ${logs.length} recent logs from CPQ.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to fetch logs: ${err.message}`);
      }
    })
  );
}

function toggleLogStream(vscodeInstance = vscode) {
  const streamer = getLogStreamer();
  if (streamer.isStreaming) {
    streamer.stopStream();
    return { streaming: false };
  } else {
    streamer.startStream(vscodeInstance);
    return { streaming: true };
  }
}

function isStreamingLogs() {
  const streamer = getLogStreamer();
  return Boolean(streamer.isStreaming);
}

module.exports = {
  registerLogCommands,
  toggleLogStream,
  isStreamingLogs
};
