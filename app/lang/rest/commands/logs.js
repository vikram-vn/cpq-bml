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

  context.subscriptions.push(
    streamer,
    vscode.commands.registerCommand('cpqBml.rest.startLogStream', () => {
      try {
        streamer.startStream(vscode);
        vscode.window.showInformationMessage('Started streaming CPQ server error & print logs.');
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to start log stream: ${err.message}`);
      }
    }),
    vscode.commands.registerCommand('cpqBml.rest.stopLogStream', () => {
      streamer.stopStream();
      vscode.window.showInformationMessage('Stopped CPQ server log stream.');
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

module.exports = { registerLogCommands };
