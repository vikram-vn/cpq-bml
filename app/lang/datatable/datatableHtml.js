
function getDatatableWebviewHtml(tableName, columns = [], rows = []) {
  const safeColumns = JSON.stringify(columns);
  const safeRows = JSON.stringify(rows);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${tableName} - CPQ Data Table Editor</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }
    .header h2 {
      margin: 0;
      font-size: 1.2rem;
      color: var(--vscode-textLink-foreground);
    }
    .toolbar {
      display: flex;
      gap: 8px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .search-box {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 10px;
      border-radius: 3px;
    }
    .table-container {
      overflow: auto;
      max-height: calc(100vh - 120px);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      background: var(--vscode-sideBar-background);
      position: sticky;
      top: 0;
      padding: 8px;
      text-align: left;
      border-bottom: 2px solid var(--vscode-panel-border);
      border-right: 1px solid var(--vscode-panel-border);
      user-select: none;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      border-right: 1px solid var(--vscode-panel-border);
      white-space: nowrap;
    }
    td[contenteditable="true"]:focus {
      outline: 2px solid var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }
    .row-actions {
      width: 40px;
      text-align: center;
    }
    .btn-del {
      background: transparent;
      color: var(--vscode-errorForeground);
      padding: 2px 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Data Table: ${tableName}</h2>
    <div class="toolbar">
      <input type="text" id="searchInput" class="search-box" placeholder="Filter rows..." oninput="filterRows()" />
      <button onclick="addRow()">+ Add Row</button>
      <button onclick="saveChanges()">Save Changes</button>
      <button onclick="pushToCpq()">Push to CPQ</button>
    </div>
  </div>

  <div class="table-container">
    <table id="gridTable">
      <thead>
        <tr id="tableHeader"></tr>
      </thead>
      <tbody id="tableBody"></tbody>
    </table>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let columns = ${safeColumns};
    let rows = ${safeRows};

    function renderTable() {
      const thead = document.getElementById("tableHeader");
      const tbody = document.getElementById("tableBody");
      thead.innerHTML = '<th class="row-actions">#</th>' + columns.map(c => '<th>' + c + '</th>').join('') + '<th class="row-actions">Del</th>';
      tbody.innerHTML = '';

      rows.forEach((row, rIdx) => {
        const tr = document.createElement("tr");
        tr.dataset.index = rIdx;
        let html = '<td class="row-actions">' + (rIdx + 1) + '</td>';
        columns.forEach(col => {
          const val = row[col] !== undefined ? row[col] : '';
          html += '<td contenteditable="true" onblur="updateCell(' + rIdx + ', \'' + col + '\', this.innerText)">' + val + '</td>';
        });
        html += '<td class="row-actions"><button class="btn-del" onclick="deleteRow(' + rIdx + ')">✕</button></td>';
        tr.innerHTML = html;
        tbody.appendChild(tr);
      });
    }

    function updateCell(rIdx, col, value) {
      if (rows[rIdx]) {
        rows[rIdx][col] = value;
      }
    }

    function addRow() {
      const newRow = {};
      columns.forEach(c => newRow[c] = '');
      rows.push(newRow);
      renderTable();
    }

    function deleteRow(rIdx) {
      rows.splice(rIdx, 1);
      renderTable();
    }

    function filterRows() {
      const q = document.getElementById("searchInput").value.toLowerCase();
      const trs = document.querySelectorAll("#tableBody tr");
      trs.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(q) ? "" : "none";
      });
    }

    function saveChanges() {
      vscode.postMessage({ command: "save", rows });
    }

    function pushToCpq() {
      vscode.postMessage({ command: "push", rows });
    }

    renderTable();
  </script>
</body>
</html>`;
}

module.exports = {
  getDatatableWebviewHtml,
};
