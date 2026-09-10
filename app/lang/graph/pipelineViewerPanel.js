let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = { window: {}, workspace: {}, Uri: { file: () => ({}) }, ViewColumn: { One: 1 } };
}
const path = require('path');
const { AttributeDependencyGraph } = require('./attributeDependencyGraph');

/**
 * Webview panel manager for the Commerce Pipeline & Attribute Dependency Graph.
 */
class PipelineViewerPanel {
  static currentPanel = undefined;
  static viewType = 'cpqBml.attributeGraph';

  static createOrShow(context) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PipelineViewerPanel.currentPanel) {
      PipelineViewerPanel.currentPanel.panel.reveal(column);
      PipelineViewerPanel.currentPanel.refresh();
      return PipelineViewerPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      PipelineViewerPanel.viewType,
      'Commerce Pipeline & Attribute Graph',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'app', 'lang', 'graph', 'web-view'))
        ]
      }
    );

    PipelineViewerPanel.currentPanel = new PipelineViewerPanel(panel, context);
    return PipelineViewerPanel.currentPanel;
  }

  constructor(panel, context) {
    this.panel = panel;
    this.context = context;
    this.disposables = [];

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message);
      },
      null,
      this.disposables
    );
  }

  async handleMessage(message) {
    switch (message.type) {
      case 'ready':
      case 'refresh': {
        this.refresh();
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

  refresh() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const root = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : this.context.extensionPath;

    const analyzer = new AttributeDependencyGraph(root);
    analyzer.scanWorkspace(root);
    const model = analyzer.toGraphModel();

    this.panel.webview.postMessage({
      type: 'graphData',
      payload: model
    });
  }

  getHtmlForWebview(webview) {
    const webviewDir = path.join(this.context.extensionPath, 'app', 'lang', 'graph', 'web-view');
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'dist', 'main.js')));
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'css', 'pipelineGraph.css')));

    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>Commerce Pipeline & Attribute Graph</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose() {
    PipelineViewerPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }
}

module.exports = { PipelineViewerPanel };
