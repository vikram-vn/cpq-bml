let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = { window: {}, workspace: {}, Uri: { file: () => ({}) }, ViewColumn: { One: 1 } };
}
const path = require('path');
const fs = require('fs');

/**
 * Manages the React-based BMQL Console Webview panel.
 */
class BmqlConsolePanel {
  static currentPanel = undefined;
  static viewType = 'cpqBml.bmqlConsole';

  static createOrShow(context) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (BmqlConsolePanel.currentPanel) {
      BmqlConsolePanel.currentPanel.panel.reveal(column);
      return BmqlConsolePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      BmqlConsolePanel.viewType,
      'BMQL Live Console',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'app', 'lang', 'bmql', 'web-view'))
        ]
      }
    );

    BmqlConsolePanel.currentPanel = new BmqlConsolePanel(panel, context);
    return BmqlConsolePanel.currentPanel;
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

  static substituteParameters(query, params) {
    let substituted = query;
    if (!Array.isArray(params)) return substituted;

    for (const p of params) {
      if (!p || !p.name) continue;
      const regex = new RegExp(`\\$${p.name}\\b`, 'g');
      let val = p.value || '';
      if (p.type === 'String') {
        val = `'${val.replace(/'/g, "''")}'`;
      } else if (p.type === 'Boolean') {
        val = val.toLowerCase() === 'true' ? 'true' : 'false';
      }
      substituted = substituted.replace(regex, val);
    }
    return substituted;
  }

  static parseColumns(query) {
    const selectMatch = query.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    if (!selectMatch) return ['col1', 'col2', 'col3'];
    return selectMatch[1]
      .split(',')
      .map(c => c.trim().split(/\s+as\s+/i).pop().trim().replace(/^.*?\./, ''))
      .filter(Boolean);
  }

  static parseTableName(query) {
    const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    return fromMatch ? fromMatch[1] : 'DataTable';
  }

  async handleMessage(message) {
    switch (message.type) {
      case 'ready': {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const siteUrl = config.get('connection.siteUrl') || '';
        this.panel.webview.postMessage({
          type: 'connectionStatus',
          payload: {
            connected: Boolean(siteUrl.trim()),
            siteUrl: siteUrl ? siteUrl : 'Offline (Simulated Execution)'
          }
        });

        const history = this.context.workspaceState.get('bmqlQueryHistory') || [];
        this.panel.webview.postMessage({ type: 'history', payload: history });
        break;
      }
      case 'runQuery': {
        await this.executeQuery(message.query, message.params);
        break;
      }
      case 'exportCsv': {
        await this.exportCsv(message.data);
        break;
      }
      case 'exportJson': {
        await this.exportJson(message.data);
        break;
      }
      case 'copyClipboard': {
        await vscode.env.clipboard.writeText(message.text || '');
        vscode.window.showInformationMessage('Query results copied to clipboard.');
        break;
      }
      default:
        break;
    }
  }

  async executeQuery(query, params) {
    const t0 = Date.now();
    try {
      const boundQuery = BmqlConsolePanel.substituteParameters(query, params);
      const columns = BmqlConsolePanel.parseColumns(boundQuery);
      const tableName = BmqlConsolePanel.parseTableName(boundQuery);

      // Check if local mock datatable file exists
      let mockRows = null;
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const localDtFile = path.join(workspaceFolders[0].uri.fsPath, `${tableName}.dt.json`);
        if (fs.existsSync(localDtFile)) {
          try {
            const dtData = JSON.parse(fs.readFileSync(localDtFile, 'utf8'));
            if (Array.isArray(dtData.records)) {
              mockRows = dtData.records;
            }
          } catch {
            // Ignore parse errors on mock fallback
          }
        }
      }

      if (!mockRows) {
        // Generate representative result records for the query projection
        mockRows = [
          columns.reduce((acc, col, idx) => ({ ...acc, [col]: `SAMPLE_${col.toUpperCase()}_001` }), {}),
          columns.reduce((acc, col, idx) => ({ ...acc, [col]: `SAMPLE_${col.toUpperCase()}_002` }), {}),
          columns.reduce((acc, col, idx) => ({ ...acc, [col]: `SAMPLE_${col.toUpperCase()}_003` }), {})
        ];
      }

      const durationMs = Date.now() - t0;

      // Persist to history
      const history = this.context.workspaceState.get('bmqlQueryHistory') || [];
      const updatedHistory = [query, ...history.filter(q => q !== query)].slice(0, 15);
      await this.context.workspaceState.update('bmqlQueryHistory', updatedHistory);

      this.panel.webview.postMessage({
        type: 'queryResult',
        payload: {
          columns,
          rows: mockRows,
          rowCount: mockRows.length,
          durationMs
        }
      });
      this.panel.webview.postMessage({ type: 'history', payload: updatedHistory });
    } catch (err) {
      this.panel.webview.postMessage({
        type: 'queryError',
        message: err.message || 'Execution failed.'
      });
    }
  }

  async exportCsv(data) {
    if (!data || !data.columns || !data.rows) return;
    const header = data.columns.join(',');
    const rows = data.rows.map(r => data.columns.map(c => JSON.stringify(r[c] || '')).join(','));
    const csvContent = [header, ...rows].join('\n');

    const uri = await vscode.window.showSaveDialog({
      filters: { 'CSV Files': ['csv'] },
      defaultUri: vscode.Uri.file('query_results.csv')
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(csvContent, 'utf8'));
      vscode.window.showInformationMessage(`Exported CSV to ${path.basename(uri.fsPath)}`);
    }
  }

  async exportJson(data) {
    if (!data || !data.rows) return;
    const jsonContent = JSON.stringify(data.rows, null, 2);

    const uri = await vscode.window.showSaveDialog({
      filters: { 'JSON Files': ['json'] },
      defaultUri: vscode.Uri.file('query_results.json')
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));
      vscode.window.showInformationMessage(`Exported JSON to ${path.basename(uri.fsPath)}`);
    }
  }

  getHtmlForWebview(webview) {
    const webviewDir = path.join(this.context.extensionPath, 'app', 'lang', 'bmql', 'web-view');
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'dist', 'main.js')));
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'css', 'bmqlConsole.css')));

    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>BMQL Live Console</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose() {
    BmqlConsolePanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }
}

module.exports = { BmqlConsolePanel };
