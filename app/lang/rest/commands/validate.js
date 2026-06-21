const api = require("../api");
const metadataLib = require("../metadata");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  isSuccess,
  resolveMetadataForFile,
  ensureCredentials,
} = require("./shared");

async function runValidateCurrentFile(
  context,
  vscode,
  diagnosticCollection,
  resultsTerminal,
  { transport } = {},
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "bml") {
    vscode.window.showErrorMessage("CPQ-BML: open a .bml file to validate.");
    return;
  }

  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) return;

  const doc = editor.document;
  const metadata = await resolveMetadataForFile(
    context,
    vscode,
    doc.uri.fsPath,
    transport,
  );
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(doc.uri.fsPath);
    vscode.window.showErrorMessage(
      `CPQ-BML: could not find CPQ metadata for "${variableName}" locally or on the server. Run "CPQ-BML: Pull Util Library Functions from CPQ" first, or confirm the function exists in CPQ.`,
    );
    return;
  }

  // Standard functions that have not been overridden cannot be edited or
  // validated - direct the user to create an override in the CPQ UI first.
  if (metadata.isStandardFunction && !metadata.isOverridden) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is a standard (system) function and cannot be validated directly. ` +
      `Open it in the CPQ UI, click "Create Override", then pull the override before editing here.`,
    );
    return;
  }

  writeRunHeader(resultsTerminal, "Validate", metadata.variableName);
  writeRunningLine(resultsTerminal, "Validate", metadata.variableName);
  resultsTerminal.show();

  const startedAt = Date.now();
  const payload = metadataLib.buildFunctionPayload(metadata, doc.getText());
  const { statusCode, body } = await api.validateLibraryFunction(
    context,
    vscode,
    payload,
    transport,
  );
  const elapsed = formatElapsed(startedAt);

  if (isSuccess(statusCode)) {
    if (diagnosticCollection) diagnosticCollection.delete(doc.uri);
    resultsTerminal.writeLine(
      `\x1b[32m${getTimestamp()} Validation passed: no errors found (${elapsed})\x1b[0m`,
    );
    resultsTerminal.show();
    vscode.window.showInformationMessage(
      `CPQ-BML: ${metadata.variableName} is valid.`,
    );
  } else {
    const message = describeError(body);
    writeTerminalMessage(
      resultsTerminal,
      "Validation failed: ",
      `${message} (${elapsed})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    vscode.window.showErrorMessage(
      `CPQ-BML: validation failed (HTTP ${statusCode}). ${message}`,
    );
  }
}

module.exports = { runValidateCurrentFile };
