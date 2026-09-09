/**
 * BML Profiler Diagnostics Provider
 * Connects BmlProfiler to VS Code diagnostic collection and Quick-Fixes.
 * Strictly maintains under 500 lines of code.
 */

const vscode = require("vscode");
const { BmlProfiler } = require("./bmlProfiler");

const DIAGNOSTIC_COLLECTION_NAME = "bml-profiler";

function getSeverity(sev) {
  switch (sev) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

class BmlProfilerDiagnostics {
  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_COLLECTION_NAME);
  }

  updateDiagnostics(document) {
    if (!document || (document.languageId !== "bml" && !document.fileName.endsWith(".bml") && !document.fileName.endsWith(".util"))) {
      return;
    }

    const text = document.getText();
    const issues = BmlProfiler.profile(text);
    const diagnostics = issues.map((issue) => {
      const range = new vscode.Range(
        Math.max(0, issue.line - 1),
        Math.max(0, issue.column - 1),
        Math.max(0, (issue.endLine || issue.line) - 1),
        Math.max(0, (issue.endColumn || issue.column + 5) - 1)
      );

      const diag = new vscode.Diagnostic(range, issue.message, getSeverity(issue.severity));
      diag.code = issue.ruleId;
      diag.source = "BML Profiler";
      return diag;
    });

    this.collection.set(document.uri, diagnostics);
  }

  clear() {
    this.collection.clear();
  }
}

function registerProfilerDiagnostics(context) {
  const profiler = new BmlProfilerDiagnostics();
  context.subscriptions.push(profiler.collection);

  // Update on open and change
  if (vscode.window.activeTextEditor) {
    profiler.updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) profiler.updateDiagnostics(editor.document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      profiler.updateDiagnostics(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      profiler.collection.delete(doc.uri);
    })
  );
}

module.exports = {
  BmlProfilerDiagnostics,
  registerProfilerDiagnostics,
};
