let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {},
    workspace: {},
    Uri: { file: () => ({}) },
    ViewColumn: { One: 1 }
  };
}

const path = require('path');
const { ComplexityAnalyzer } = require('./complexityAnalyzer');

/**
 * WebviewPanel manager for the BML Technical Debt & Complexity Dashboard.
 */
let currentPanel = undefined;
const viewType = 'cpqBml.complexityDashboard';

function createComplexityPanel(panel, context) {
  const disposables = [];

  function getHtmlForWebview(webview) {
    const webviewDir = path.join(context.extensionPath, 'app', 'lang', 'complexity', 'web-view');
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'dist', 'main.js')));
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'css', 'complexityDashboard.css')));

    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>BML Complexity & Debt Radar</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  function refresh() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const root = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : context.extensionPath;

    const analyzer = new ComplexityAnalyzer(root);
    analyzer.scanWorkspace(root);
    const dashboardData = analyzer.getDashboardData();

    panel.webview.postMessage({
      type: 'complexityData',
      payload: dashboardData
    });
  }

  async function handleMessage(message) {
    switch (message.type) {
      case 'ready':
      case 'refresh': {
        refresh();
        break;
      }
      case 'openFile': {
        if (message.filePath) {
          try {
            const doc = await vscode.workspace.openTextDocument(message.filePath);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } catch (err) {
            vscode.window.showErrorMessage(`Unable to open file: ${err.message}`);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  function dispose() {
    currentPanel = undefined;
    panel.dispose();
    while (disposables.length) {
      const x = disposables.pop();
      if (x) x.dispose();
    }
  }

  panel.webview.html = getHtmlForWebview(panel.webview);
  panel.onDidDispose(() => dispose(), null, disposables);
  panel.webview.onDidReceiveMessage(
    async (message) => {
      await handleMessage(message);
    },
    null,
    disposables
  );

  return {
    panel,
    context,
    refresh,
    dispose
  };
}

function createOrShow(context) {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    currentPanel.panel.reveal(column);
    currentPanel.refresh();
    return currentPanel;
  }

  const panel = vscode.window.createWebviewPanel(
    viewType,
    'BML Complexity & Debt Radar',
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'app', 'lang', 'complexity', 'web-view'))
      ]
    }
  );

  currentPanel = createComplexityPanel(panel, context);
  return currentPanel;
}

const ComplexityPanel = {
  createOrShow,
  get currentPanel() { return currentPanel; },
  set currentPanel(v) { currentPanel = v; },
  viewType
};

module.exports = { ComplexityPanel, createOrShow, createComplexityPanel };
