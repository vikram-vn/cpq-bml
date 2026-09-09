const vscode = require('vscode');
const { evaluateBmlLogic } = require('./bmlEvaluator');

let outputChannel = null;

function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('BML Scratchpad');
    }
    return outputChannel;
}

async function runCurrentBmlLocally() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Please open a BML file or select code to evaluate.');
        return;
    }

    const selection = editor.selection;
    const code = (!selection.isEmpty ? editor.document.getText(selection) : editor.document.getText()).trim();

    if (!code) {
        vscode.window.showWarningMessage('No BML code selected to run.');
        return;
    }

    const channel = getOutputChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(`[BML Scratchpad] Executing local BML logic (${code.length} characters)...`);
    channel.appendLine('------------------------------------------------------------');

    const result = evaluateBmlLogic({ code });

    if (result.output.length > 0) {
        channel.appendLine('[Console Logs / print()]:');
        for (const line of result.output) {
            channel.appendLine(`  > ${line}`);
        }
        channel.appendLine('');
    }

    if (result.success) {
        channel.appendLine(`[Return Value]: ${JSON.stringify(result.returnValue)}`);
        channel.appendLine(`[Status]: SUCCESS (took ${result.durationMs}ms)`);
        vscode.window.showInformationMessage(`BML Evaluated in ${result.durationMs}ms: Return = ${JSON.stringify(result.returnValue)}`);
    } else {
        channel.appendLine(`[Runtime Error]: ${result.error}`);
        channel.appendLine(`[Status]: FAILED (took ${result.durationMs}ms)`);
        vscode.window.showErrorMessage(`BML Evaluation Error: ${result.error}`);
    }
}

function openScratchpadWebview(context) {
    const panel = vscode.window.createWebviewPanel(
        'bmlScratchpad',
        'BML Logic Scratchpad',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h2 { margin-top: 0; font-size: 1.1rem; }
    textarea { width: 100%; height: 200px; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; border-radius: 4px; resize: vertical; box-sizing: border-box; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; font-weight: 500; margin-top: 8px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .panel-box { margin-top: 16px; padding: 12px; border-radius: 4px; background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border); }
    pre { margin: 0; font-family: var(--vscode-editor-font-family); white-space: pre-wrap; font-size: 0.9rem; }
    .success { color: #4ec9b0; }
    .error { color: #f14c4c; }
  </style>
</head>
<body>
  <h2>⚡ BML Pure Logic Scratchpad (Offline Sandbox)</h2>
  <textarea id="code" placeholder="// Write pure BML logic here...
name = 'oracle cpq';
print('Uppercase:', upper(name));
result = round(42.5678, 2);
return result;"></textarea>
  <br>
  <button id="runBtn">Run Logic (Ctrl+Enter)</button>

  <div class="panel-box">
    <strong>Console Output (print):</strong>
    <pre id="consoleOut">(Logs will appear here)</pre>
  </div>

  <div class="panel-box">
    <strong>Return Value:</strong>
    <pre id="returnOut">(Return value will appear here)</pre>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const runBtn = document.getElementById('runBtn');
    const codeArea = document.getElementById('code');

    function execute() {
      vscode.postMessage({ command: 'evaluate', code: codeArea.value });
    }

    runBtn.addEventListener('click', execute);
    codeArea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        execute();
      }
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'result') {
        const res = msg.result;
        document.getElementById('consoleOut').textContent = res.output.length ? res.output.join('\\n') : '(No console output)';
        const retEl = document.getElementById('returnOut');
        if (res.success) {
          retEl.textContent = JSON.stringify(res.returnValue, null, 2) + '  (' + res.durationMs + 'ms)';
          retEl.className = 'success';
        } else {
          retEl.textContent = 'Error: ' + res.error + '  (' + res.durationMs + 'ms)';
          retEl.className = 'error';
        }
      }
    });
  </script>
</body>
</html>`;

    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'evaluate') {
            const result = evaluateBmlLogic({ code: message.code });
            panel.webview.postMessage({ command: 'result', result });
        }
    }, null, context.subscriptions);
}

function registerScratchpad(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('cpqBml.runBmlLocally', runCurrentBmlLocally),
        vscode.commands.registerCommand('cpqBml.openScratchpad', () => openScratchpadWebview(context))
    );
}

module.exports = { registerScratchpad, runCurrentBmlLocally, openScratchpadWebview };
