const vscode = require('vscode');
const { buildWorkspaceReport } = require('./report');

/**
 * Register the cpqBml.metrics.openReport command.
 */
function registerMetrics(context) {
    const cmd = vscode.commands.registerCommand('cpqBml.metrics.openReport', () =>
        openMetricsReport(context)
    );
    context.subscriptions.push(cmd);
}


/**
 * Opens a WebView panel showing a sortable BML Code Metrics table.
 */
async function openMetricsReport(context, diagnosticCollection) {
    const panel = vscode.window.createWebviewPanel(
        'bmlMetrics',
        'BML Code Metrics',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getLoadingHtml();

    const files = await buildWorkspaceReport(diagnosticCollection);
    panel.webview.html = getReportHtml(files);

    // Handle open-file messages from the WebView
    panel.webview.onDidReceiveMessage(
        (message) => {
            if (message.command === 'openFile') {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.path));
            }
        },
        undefined,
        context.subscriptions
    );
}

function getLoadingHtml() {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>BML Code Metrics</title></head>
<body style="font-family:sans-serif;padding:2rem">
<h2>⏳ Analyzing workspace…</h2>
</body></html>`;
}

function getReportHtml(files) {
    const totalFiles = files.length;
    const totalErrors = files.reduce((s, f) => s + f.errorCount, 0);
    const totalWarnings = files.reduce((s, f) => s + f.warningCount, 0);
    const avgComplexity = totalFiles
        ? (files.reduce((s, f) => s + f.metrics.cyclomaticComplexity, 0) / totalFiles).toFixed(1)
        : 0;

    const rows = files.map((f) => {
        const cc = f.metrics.cyclomaticComplexity;
        const nd = f.metrics.nestingDepth;
        const ccClass = cc > 15 ? 'high' : cc > 8 ? 'medium' : 'low';
        const ndClass = nd > 3 ? 'high' : nd > 2 ? 'medium' : 'low';
        const errClass = f.errorCount > 0 ? 'high' : '';
        const warnClass = f.warningCount > 5 ? 'medium' : '';
        const name = f.relativePath.split('/').pop();
        return `<tr>
            <td><a href="#" onclick="openFile('${f.path.replace(/\\/g, '\\\\')}');return false" title="${f.relativePath}">${name}</a></td>
            <td>${f.metrics.lineCount}</td>
            <td>${f.metrics.codeLines}</td>
            <td class="${ccClass}">${cc}</td>
            <td class="${ndClass}">${nd}</td>
            <td class="${errClass}">${f.errorCount}</td>
            <td class="${warnClass}">${f.warningCount}</td>
            <td>${f.infoCount}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BML Code Metrics</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        padding: 1.5rem;
        font-size: 13px;
    }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    .summary {
        display: flex; gap: 1.5rem; margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }
    .stat {
        background: var(--vscode-sideBar-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px; padding: 0.75rem 1rem;
        min-width: 120px; text-align: center;
    }
    .stat .val { font-size: 1.6rem; font-weight: 700; }
    .stat .lbl { font-size: 0.75rem; opacity: 0.7; margin-top: 2px; }
    table {
        width: 100%; border-collapse: collapse;
        background: var(--vscode-sideBar-background);
        border-radius: 8px; overflow: hidden;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    thead { background: var(--vscode-list-hoverBackground); }
    th {
        padding: 0.6rem 0.8rem; text-align: left;
        font-weight: 600; font-size: 0.8rem; text-transform: uppercase;
        letter-spacing: 0.04em; cursor: pointer; user-select: none;
        border-bottom: 1px solid var(--vscode-panel-border);
    }
    th:hover { opacity: 0.8; }
    td { padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--vscode-panel-border, #2a2a2a); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--vscode-list-hoverBackground); }
    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }
    td.high { color: #f14c4c; font-weight: 600; }
    td.medium { color: #f0a500; font-weight: 600; }
    td.low { color: #4caf50; }
    .sort-asc::after { content: ' ↑'; }
    .sort-desc::after { content: ' ↓'; }
</style>
</head>
<body>
<h1>📊 BML Code Metrics</h1>
<div class="summary">
    <div class="stat"><div class="val">${totalFiles}</div><div class="lbl">Files</div></div>
    <div class="stat"><div class="val" style="color:#f14c4c">${totalErrors}</div><div class="lbl">Errors</div></div>
    <div class="stat"><div class="val" style="color:#f0a500">${totalWarnings}</div><div class="lbl">Warnings</div></div>
    <div class="stat"><div class="val">${avgComplexity}</div><div class="lbl">Avg Complexity</div></div>
</div>
<table id="metricsTable">
<thead>
<tr>
    <th onclick="sortTable(0)">File</th>
    <th onclick="sortTable(1)">Lines</th>
    <th onclick="sortTable(2)">Code Lines</th>
    <th onclick="sortTable(3)">Complexity</th>
    <th onclick="sortTable(4)">Nesting</th>
    <th onclick="sortTable(5)">Errors</th>
    <th onclick="sortTable(6)">Warnings</th>
    <th onclick="sortTable(7)">Info</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
<script>
const vscode = acquireVsCodeApi();
function openFile(p) { vscode.postMessage({ command: 'openFile', path: p }); }

let sortCol = 5, sortAsc = false;
function sortTable(col) {
    const table = document.getElementById('metricsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = false; }
    rows.sort((a, b) => {
        const av = a.cells[col].textContent.trim();
        const bv = b.cells[col].textContent.trim();
        const an = parseFloat(av), bn = parseFloat(bv);
        const cmp = isNaN(an) || isNaN(bn) ? av.localeCompare(bv) : an - bn;
        return sortAsc ? cmp : -cmp;
    });
    rows.forEach(r => tbody.appendChild(r));
    document.querySelectorAll('th').forEach((th, i) => {
        th.className = i === col ? (sortAsc ? 'sort-asc' : 'sort-desc') : '';
    });
}
</script>
</body>
</html>`;
}

module.exports = { registerMetrics, openMetricsReport };
