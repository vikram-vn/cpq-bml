
const vscode = require("vscode");
const path = require("path");
const { getDatatableWebviewHtml } = require("./datatableHtml");

class DatatableEditorProvider {
  static register(context) {
    const provider = new DatatableEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      "cpqBml.dataTableEditor",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(context) {
    this.context = context;
  }

  async resolveCustomTextEditor(document, webviewPanel) {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const tableName = path.basename(document.fileName).replace(/\.dt\.(json|csv)$/, "");
    const { columns, rows } = this.parseDocument(document);

    webviewPanel.webview.html = getDatatableWebviewHtml(tableName, columns, rows);

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "save") {
        await this.updateDocument(document, message.rows);
        vscode.window.showInformationMessage(`Saved ${message.rows.length} rows to ${tableName}.`);
      } else if (message.command === "push") {
        await this.updateDocument(document, message.rows);
        vscode.window.showInformationMessage(`Data Table '${tableName}' ready for CPQ deployment.`);
      }
    });
  }

  parseDocument(document) {
    const text = document.getText();
    if (!text.trim()) {
      return { columns: ["id", "key", "value"], rows: [] };
    }

    if (document.fileName.endsWith(".json")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          const columns = parsed.length > 0 ? Object.keys(parsed[0]) : ["id", "key", "value"];
          return { columns, rows: parsed };
        }
        if (parsed.items && Array.isArray(parsed.items)) {
          const columns = parsed.items.length > 0 ? Object.keys(parsed.items[0]) : ["id", "key", "value"];
          return { columns, rows: parsed.items };
        }
      } catch {
        // Fallback below
      }
    }

    // CSV parsing fallback
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { columns: ["col1", "col2"], rows: [] };

    const columns = lines[0].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const row = {};
      columns.forEach((col, idx) => {
        row[col] = parts[idx] !== undefined ? parts[idx] : "";
      });
      rows.push(row);
    }

    return { columns, rows };
  }

  async updateDocument(document, rows) {
    let content = "";
    if (document.fileName.endsWith(".json")) {
      content = JSON.stringify(rows, null, 2);
    } else {
      // CSV format
      if (rows.length === 0) return;
      const cols = Object.keys(rows[0]);
      content = cols.join(",") + "\n";
      content += rows.map((r) => cols.map((c) => `"${r[c] || ""}"`).join(",")).join("\n");
    }

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
  }
}

function registerDatatableEditor(context) {
  return DatatableEditorProvider.register(context);
}

module.exports = {
  DatatableEditorProvider,
  registerDatatableEditor,
};
