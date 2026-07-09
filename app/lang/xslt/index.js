const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { getWebviewContent } = require("./webviewContent");

function instrumentXslt(xsltContent) {
  const lines = xsltContent.split("\n");
  return lines
    .map((line, index) => {
      const lineNum = index + 1;
      return line.replace(
        /<(?!(?:\/|xsl:|[\?!]))([a-zA-Z0-9_:-]+)([^>]*)>/g,
        (match, tagName, attributes) => {
          if (attributes.includes("data-source-line")) return match;
          return `<${tagName} data-source-line="${lineNum}"${attributes}>`;
        }
      );
    })
    .join("\n");
}

function formatXml(xml, tab = "  ") {
  const cleanXml = xml.replace(/>\s+</g, "><").trim();
  let formatted = "";
  let indent = "";
  const reg = /(<[^>]+>)/g;
  const parts = cleanXml.split(reg);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (part.startsWith("</")) {
      indent = indent.substring(tab.length);
      formatted += indent + part + "\n";
    } else if (part.startsWith("<") && !part.endsWith("/>") && !part.startsWith("<?") && !part.startsWith("<!")) {
      const next1 = parts[i + 1] ? parts[i + 1].trim() : "";
      const next2 = parts[i + 2] ? parts[i + 2].trim() : "";
      const match = part.match(/<([^\s>]+)/);
      const tagName = match ? match[1] : "";

      if (next1 && !next1.startsWith("<") && next2 === `</${tagName}>`) {
        formatted += indent + part + next1 + next2 + "\n";
        i += 2;
      } else {
        formatted += indent + part + "\n";
        indent += tab;
      }
    } else {
      formatted += indent + part + "\n";
    }
  }
  return formatted.trim();
}

function tryFindLinkedStylesheet(xmlPath) {
  try {
    const content = fs.readFileSync(xmlPath, "utf-8");
    const match = content.match(/<\?xml-stylesheet\s+[^?>]*href=["']([^"']+)["']/);
    if (match) {
      const href = match[1];
      const resolved = path.resolve(path.dirname(xmlPath), href);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }
  } catch (e) {}
  return undefined;
}

async function runSwitchXsltFile(context, vscode) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const activePath = editor.document.uri.fsPath;
  const pairedPath = context.workspaceState.get(`xslt-pair:${activePath}`);

  if (pairedPath && fs.existsSync(pairedPath)) {
    const doc = await vscode.workspace.openTextDocument(pairedPath);
    await vscode.window.showTextDocument(doc);
  } else {
    vscode.window.showInformationMessage("No paired XML/XSLT file found for this document.");
  }
}

async function runPreviewXslt(context, vscode) {
  if (!vscode.workspace.getConfiguration('cpqBml').get('features.xslt', true)) {
    vscode.window.showWarningMessage('XSLT Preview is disabled in settings.');
    return;
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const activeDoc = editor.document;
  const activePath = activeDoc.uri.fsPath;
  const isXml = activeDoc.languageId === "xml";
  const isXslt = activeDoc.languageId === "xsl" || activePath.endsWith(".xsl") || activePath.endsWith(".xslt");

  if (!isXml && !isXslt) {
    vscode.window.showErrorMessage("Active file must be an XML or XSLT file.");
    return;
  }

  const pairKey = `xslt-pair:${activePath}`;
  let pairedPath = context.workspaceState.get(pairKey);

  if (!pairedPath && isXml) {
    pairedPath = tryFindLinkedStylesheet(activePath);
  }

  if (pairedPath && !fs.existsSync(pairedPath)) {
    pairedPath = undefined;
  }

  if (!pairedPath) {
    const fileType = isXml ? "XSLT stylesheet" : "XML data file";
    const extensionFilters = isXml ? { XSLT: ["xsl", "xslt"] } : { XML: ["xml"] };

    const selectedUris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: `Select Paired ${fileType}`,
      filters: extensionFilters,
    });

    if (!selectedUris || selectedUris.length === 0) {
      return;
    }

    pairedPath = selectedUris[0].fsPath;
    context.workspaceState.update(pairKey, pairedPath);
    context.workspaceState.update(`xslt-pair:${pairedPath}`, activePath);
  }

  const xmlPath = isXml ? activePath : pairedPath;
  const xsltPath = isXslt ? activePath : pairedPath;

  const xmlName = path.basename(xmlPath);
  const xsltName = path.basename(xsltPath);

  const panel = vscode.window.createWebviewPanel(
    "xsltPreview",
    `XSLT Preview: ${xsltName}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent(xmlName, xsltName);

  const updatePreview = () => {
    try {
      const xmlContent = fs.readFileSync(xmlPath, "utf-8");
      let xsltContent = fs.readFileSync(xsltPath, "utf-8");
      xsltContent = instrumentXslt(xsltContent);

      panel.webview.postMessage({
        type: "update",
        xml: xmlContent,
        xslt: xsltContent,
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to read files: ${err.message}`);
    }
  };

  updatePreview();

  const saveListener = vscode.workspace.onDidSaveTextDocument((doc) => {
    const savedPath = doc.uri.fsPath;
    if (savedPath === xmlPath || savedPath === xsltPath) {
      updatePreview();
    }
  });

  const cursorListener = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.textEditor.document.uri.fsPath === xsltPath) {
      const lineNum = e.selections[0].active.line + 1;
      panel.webview.postMessage({
        type: "highlightSourceLine",
        line: lineNum,
      });
    }
  });

  panel.webview.onDidReceiveMessage((msg) => {
    if (msg.command === "jumpToCode" && msg.line) {
      const line = parseInt(msg.line, 10) - 1;
      vscode.workspace.openTextDocument(xsltPath).then((doc) => {
        vscode.window.showTextDocument(doc, {
          selection: new vscode.Range(line, 0, line, 0),
          viewColumn: vscode.ViewColumn.One,
        });
      });
    } else if (msg.command === "switchFile") {
      runSwitchXsltFile(context, vscode);
    } else if (msg.command === "refresh") {
      updatePreview();
    }
  });

  panel.onDidDispose(() => {
    saveListener.dispose();
    cursorListener.dispose();
  });
}

function registerXslt(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.xslt.preview", () =>
      runPreviewXslt(context, vscode)
    ),
    vscode.commands.registerCommand("cpqBml.xslt.switchFile", () =>
      runSwitchXsltFile(context, vscode)
    )
  );

  const selector = [
    { language: "xml", scheme: "file" },
    { language: "xsl", scheme: "file" },
  ];

  const provider = vscode.languages.registerDocumentFormattingEditProvider(selector, {
    provideDocumentFormattingEdits(document) {
      if (!vscode.workspace.getConfiguration('cpqBml').get('features.xslt', true)) {
        return [];
      }
      const text = document.getText();
      try {
        const formatted = formatXml(text);
        const lastLine = document.lineAt(document.lineCount - 1);
        const range = new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(document.lineCount - 1, lastLine.text.length)
        );
        return [vscode.TextEdit.replace(range, formatted)];
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to format XML/XSLT: ${err.message}`);
        return [];
      }
    },
  });

  context.subscriptions.push(provider);
}

module.exports = { registerXslt, runPreviewXslt, runSwitchXsltFile, getWebviewContent, formatXml, instrumentXslt, tryFindLinkedStylesheet };
