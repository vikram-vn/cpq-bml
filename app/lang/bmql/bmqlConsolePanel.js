let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: { activeTextEditor: undefined, createWebviewPanel: () => ({ webview: { postMessage: () => {} } }), showInformationMessage: () => {}, showSaveDialog: () => {} },
    workspace: { getConfiguration: () => ({ get: () => '' }), workspaceFolders: [], fs: { writeFile: () => {} } },
    env: { clipboard: { writeText: () => {} } },
    Uri: { file: () => ({}) },
    ViewColumn: { One: 1 }
  };
}

const path = require('path');
const fs = require('fs');
const { fetchTableRows } = require('../cloud/cloudDataTables');

let currentPanelInstance = null;

function substituteParameters(query, params) {
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

function parseColumns(query) {
  const selectMatch = query.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  if (!selectMatch) return ['col1', 'col2', 'col3'];
  const rawCols = selectMatch[1].trim();
  if (rawCols === '*') return [];
  return rawCols
    .split(',')
    .map(c => c.trim().split(/\s+as\s+/i).pop().trim().replace(/^.*?\./, ''))
    .filter(Boolean);
}

function parseTableName(query) {
  const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
  return fromMatch ? fromMatch[1] : 'DataTable';
}

function getHtmlForWebview(webview, extensionPath) {
  const webviewDir = path.join(extensionPath, 'app', 'lang', 'bmql', 'web-view');
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

/**
 * Pure Factory: Creates the BMQL Console Webview panel controller.
 */
function createBmqlConsolePanel(panel, context) {
  const disposables = [];

  panel.webview.html = getHtmlForWebview(panel.webview, context.extensionPath);

  panel.onDidDispose(() => {
    currentPanelInstance = null;
    while (disposables.length) {
      const x = disposables.pop();
      if (x && x.dispose) x.dispose();
    }
  }, null, disposables);

  panel.webview.onDidReceiveMessage(async (message) => {
    await handleMessage(message);
  }, null, disposables);

  async function handleMessage(message) {
    switch (message.type) {
      case 'ready': {
        const config = vscode.workspace.getConfiguration('cpqBml');
        const siteUrl = config.get('connection.siteUrl') || '';
        panel.webview.postMessage({
          type: 'connectionStatus',
          payload: {
            connected: Boolean(siteUrl.trim()),
            siteUrl: siteUrl ? siteUrl : 'Offline (Simulated Execution)'
          }
        });

        const history = context.workspaceState.get('bmqlQueryHistory') || [];
        panel.webview.postMessage({ type: 'history', payload: history });
        break;
      }
      case 'runQuery': {
        await executeQuery(message.query, message.params);
        break;
      }
      case 'exportCsv': {
        await exportCsv(message.data);
        break;
      }
      case 'exportJson': {
        await exportJson(message.data);
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

  async function executeQuery(query, params) {
    const t0 = Date.now();
    try {
      const boundQuery = substituteParameters(query, params);
      let columns = parseColumns(boundQuery);
      const tableName = parseTableName(boundQuery);

      let rows = null;
      let source = 'Offline Simulation';

      // 1. Attempt Live Server Query if CPQ is configured
      try {
        const remoteRows = await fetchTableRows(tableName, { limit: 100 }, vscode);
        if (remoteRows && remoteRows.length > 0) {
          rows = remoteRows;
          source = 'Live CPQ Instance';
          if (columns.length === 0) {
            columns = Array.from(new Set(remoteRows.flatMap(r => Object.keys(r).filter(k => k !== 'links'))));
          }
        }
      } catch {
        // Fallback to local
      }

      // 2. Check local mock file if server query unavailable
      if (!rows) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const localDtFile = path.join(workspaceFolders[0].uri.fsPath, `${tableName}.dt.json`);
          if (fs.existsSync(localDtFile)) {
            try {
              const dtData = JSON.parse(fs.readFileSync(localDtFile, 'utf8'));
              if (Array.isArray(dtData.records)) {
                rows = dtData.records;
                source = 'Local .dt.json File';
                if (columns.length === 0 && rows.length > 0) {
                  columns = Object.keys(rows[0]);
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      }

      // 3. Fallback mock generator
      if (!rows) {
        if (columns.length === 0) columns = ['id', 'name', 'value'];
        rows = [
          columns.reduce((acc, col) => ({ ...acc, [col]: `SAMPLE_${col.toUpperCase()}_001` }), {}),
          columns.reduce((acc, col) => ({ ...acc, [col]: `SAMPLE_${col.toUpperCase()}_002` }), {}),
          columns.reduce((acc, col) => ({ ...acc, [col]: `SAMPLE_${col.toUpperCase()}_003` }), {})
        ];
      }

      const durationMs = Date.now() - t0;

      const history = context.workspaceState.get('bmqlQueryHistory') || [];
      const updatedHistory = [query, ...history.filter(q => q !== query)].slice(0, 15);
      await context.workspaceState.update('bmqlQueryHistory', updatedHistory);

      panel.webview.postMessage({
        type: 'queryResult',
        payload: {
          columns,
          rows,
          rowCount: rows.length,
          durationMs,
          source
        }
      });
      panel.webview.postMessage({ type: 'history', payload: updatedHistory });
    } catch (err) {
      panel.webview.postMessage({
        type: 'queryError',
        message: err.message || 'Execution failed.'
      });
    }
  }

  async function exportCsv(data) {
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

  async function exportJson(data) {
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

  return {
    panel,
    handleMessage,
    executeQuery,
    exportCsv,
    exportJson,
    dispose: () => panel.dispose()
  };
}

function createOrShow(context, initialQuery) {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanelInstance) {
    currentPanelInstance.panel.reveal(column);
    if (initialQuery) {
      currentPanelInstance.panel.webview.postMessage({ type: 'setQuery', query: initialQuery });
    }
    return currentPanelInstance;
  }

  const panel = vscode.window.createWebviewPanel(
    'cpqBml.bmqlConsole',
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

  currentPanelInstance = createBmqlConsolePanel(panel, context);
  if (initialQuery) {
    setTimeout(() => {
      if (currentPanelInstance) {
        currentPanelInstance.panel.webview.postMessage({ type: 'setQuery', query: initialQuery });
      }
    }, 500);
  }

  return currentPanelInstance;
}

const BmqlConsolePanel = {
  createOrShow,
  substituteParameters,
  parseColumns,
  parseTableName
};

module.exports = {
  createBmqlConsolePanel,
  BmqlConsolePanel,
  substituteParameters,
  parseColumns,
  parseTableName
};
