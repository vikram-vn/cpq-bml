'use strict';

const fs = require('fs');
const path = require('path');
const { fetchTableRows } = require('@/lang/cloud/cloudDataTables');

let activeEditorPanels = new Map();

function getWebviewContent(tableName, columns, rows) {
  const colHeaders = columns.map(c => {
    const name = typeof c === 'string' ? c : c.name || '';
    const type = typeof c === 'string' ? 'string' : c.type || 'string';
    return `<th data-col="${name}">${name} <span class="col-type">(${type})</span></th>`;
  }).join('');

  const rowHtml = rows.map((r, idx) => {
    const cells = columns.map(c => {
      const colName = typeof c === 'string' ? c : c.name || '';
      const val = r[colName] !== undefined ? String(r[colName]) : '';
      return `<td contenteditable="true" data-row="${idx}" data-col="${colName}">${val}</td>`;
    }).join('');
    return `<tr><td class="row-num">${idx + 1}</td>${cells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Data Table: ${tableName}</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --header-bg: var(--vscode-editorGroupHeader-tabsBackground, #252526);
      --border: var(--vscode-panel-border, #333);
      --hover: var(--vscode-list-hoverBackground, #2a2d2e);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #fff);
    }
    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .toolbar h2 {
      margin: 0 16px 0 0;
      font-size: 16px;
    }
    .search-input {
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #555);
      padding: 6px 10px;
      border-radius: 4px;
      width: 250px;
    }
    button {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      opacity: 0.9;
    }
    .table-container {
      flex: 1;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 4px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: var(--header-bg);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .col-type {
      font-size: 10px;
      opacity: 0.6;
    }
    .row-num {
      font-size: 11px;
      opacity: 0.5;
      text-align: center;
      width: 40px;
    }
    tr:hover {
      background: var(--hover);
    }
    .footer {
      margin-top: 10px;
      font-size: 12px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h2>Data Table: ${tableName}</h2>
    <input type="text" id="search" class="search-input" placeholder="Filter rows...">
    <button id="btnExport">Export CSV</button>
    <button id="btnRefresh">Refresh from CPQ</button>
    <span style="flex:1"></span>
    <span id="recordCount">${rows.length} records</span>
  </div>
  <div class="table-container">
    <table id="dataTable">
      <thead>
        <tr>
          <th>#</th>
          ${colHeaders}
        </tr>
      </thead>
      <tbody>
        ${rowHtml}
      </tbody>
    </table>
  </div>
  <div class="footer">
    Double click any cell to edit. Changes can be exported to CSV or saved back to CPQ.
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const searchInput = document.getElementById('search');
    const table = document.getElementById('dataTable');

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        const match = !q || text.includes(q);
        tr.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      document.getElementById('recordCount').innerText = visible + ' records';
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      vscode.postMessage({ command: 'exportCsv' });
    });

    document.getElementById('btnRefresh').addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });
  </script>
</body>
</html>`;
}

async function openDataTableEditor(item, vscodeInstance, context) {
  const tableName = item?.data?.name || item?.name;
  if (!tableName) return;

  if (activeEditorPanels.has(tableName)) {
    activeEditorPanels.get(tableName).reveal();
    return;
  }

  const panel = vscodeInstance.window.createWebviewPanel(
    'cpqDataTableEditor',
    `Data Table: ${tableName}`,
    vscodeInstance.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  activeEditorPanels.set(tableName, panel);

  panel.onDidDispose(() => {
    activeEditorPanels.delete(tableName);
  });

  async function loadData() {
    try {
      const rows = await fetchTableRows(tableName, { limit: 500 }, vscodeInstance, undefined, context);
      const columns = rows && rows.length > 0
        ? Object.keys(rows[0]).filter(k => k !== 'links').map(name => ({ name, type: 'string' }))
        : (item?.data?.columns || [{ name: 'id', type: 'string' }]);

      panel.webview.html = getWebviewContent(tableName, columns, rows || []);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to load data table '${tableName}': ${err.message}`);
    }
  }

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.command === 'refresh') {
      await loadData();
    } else if (msg.command === 'exportCsv') {
      const { exportTableCsvCommand } = require('@/lang/cloud/cloudDataTables');
      await exportTableCsvCommand(item, vscodeInstance, undefined, context);
    }
  });

  await loadData();
}

module.exports = {
  openDataTableEditor
};
