const vscode = require("vscode");

const { lintXslt } = require("./xsltLinter");
const { registerXsltCodeActions } = require("./xsltCodeActions");
const { registerXsltCompletions } = require("./xsltCompletions");
const { formatXml } = require("./formatter");

function registerXslt(context) {

  // Register XSLT Diagnostic Linter
  const xsltDiagnostics = vscode.languages.createDiagnosticCollection("xsltLint");
  context.subscriptions.push(xsltDiagnostics);

  const runXsltLinter = (doc) => {
    if (!doc) return;
    const isXslt = doc.languageId === "xsl" || doc.languageId === "xslt" || doc.fileName.endsWith(".xsl") || doc.fileName.endsWith(".xslt");
    if (isXslt) {
      const diags = lintXslt(doc);
      xsltDiagnostics.set(doc.uri, diags);
    }
  };

  vscode.workspace.onDidOpenTextDocument(runXsltLinter, null, context.subscriptions);
  vscode.workspace.onDidChangeTextDocument((e) => runXsltLinter(e.document), null, context.subscriptions);
  vscode.workspace.onDidSaveTextDocument(runXsltLinter, null, context.subscriptions);

  vscode.workspace.textDocuments.forEach(runXsltLinter);

  // Register Code Actions & Completions
  registerXsltCodeActions(context);
  registerXsltCompletions(context);

  const selector = [
    { language: "xml", scheme: "file" },
    { language: "xsl", scheme: "file" },
    { language: "xslt", scheme: "file" }
  ];

  const provider = vscode.languages.registerDocumentFormattingEditProvider(selector, {
    provideDocumentFormattingEdits(document) {
      if (!vscode.workspace.getConfiguration('cpqBml').get('features.xslt', true)) {
        return [];
      }
      const text = document.getText();
      try {
        const tabSize = vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 2);
        const insertSpaces = vscode.workspace.getConfiguration('editor', document.uri).get('insertSpaces', true);
        const indentStr = insertSpaces ? ' '.repeat(tabSize) : '\t';

        const formatted = formatXml(text, indentStr);
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

module.exports = { registerXslt, formatXml };
