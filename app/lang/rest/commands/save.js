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

async function runSaveCurrentFile(
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "bml") {
    vscode.window.showErrorMessage("CPQ-BML: open a .bml file to save.");
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

  // Standard (system-supplied) functions that have not been overridden yet
  // cannot be saved directly - CPQ rejects the PATCH with 400 "Invalid payload."
  // The user must click "Create Override" in the CPQ UI first to get a custom
  // copy, then pull it again before editing here.
  if (metadata.isStandardFunction && !metadata.isOverridden) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is a standard (system) function and cannot be saved directly. ` +
      `Open it in the CPQ UI, click "Create Override", then use "CPQ-BML: Pull Commerce Functions from CPQ" to pull the override before saving.`,
    );
    return;
  }

  const nsVarName = metadataLib.namespaceVariableNameFor(metadata);
  const payload = metadataLib.buildFunctionPayload(metadata, doc.getText());

  writeRunHeader(resultsTerminal, "Save", metadata.variableName);
  writeRunningLine(resultsTerminal, "Save", metadata.variableName);
  resultsTerminal.show();

  const startedAt = Date.now();
  let updateResult = await api.updateLibraryFunction(
    context,
    vscode,
    nsVarName,
    payload,
    transport,
  );
  if (!isSuccess(updateResult.statusCode)) {
    const errorMsg = describeError(updateResult.body);
    const doesNotExist = updateResult.statusCode === 404 || (errorMsg && errorMsg.includes("does not exist"));
    if (doesNotExist) {
      resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Function "${metadata.variableName}" does not exist. Attempting to create...\x1b[0m`);
      const createResult = await api.createLibraryFunction(
        context,
        vscode,
        payload,
        transport,
      );
      if (!isSuccess(createResult.statusCode)) {
        const message = describeError(createResult.body);
        writeTerminalMessage(
          resultsTerminal,
          "Create failed: ",
          `${message} (${formatElapsed(startedAt)})`,
          "\x1b[31m",
        );
        resultsTerminal.show();
        vscode.window.showErrorMessage(
          `CPQ-BML: create failed (HTTP ${createResult.statusCode}). ${message}`,
        );
        return;
      }
    } else {
      writeTerminalMessage(
        resultsTerminal,
        "Update failed: ",
        `${errorMsg} (${formatElapsed(startedAt)})`,
        "\x1b[31m",
      );
      resultsTerminal.show();
      vscode.window.showErrorMessage(
        `CPQ-BML: update failed (HTTP ${updateResult.statusCode}). ${errorMsg}`,
      );
      return;
    }
  }

  // Commerce Process document functions are saved by PATCH alone - there is
  // no documented "deploy" action under the commerceProcessSetups path, and
  // it does not apply to the Util Library's sandbox/production lifecycle.
  if (metadata.commerceDocument) {
    resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Saved (${formatElapsed(startedAt)})\x1b[0m`);
    resultsTerminal.show();
    vscode.window.showInformationMessage(
      `CPQ-BML: ${metadata.variableName} saved.`,
    );
    return;
  }

  const deployResult = await api.deployLibraryFunctions(
    context,
    vscode,
    [metadataLib.buildDeployItem(metadata)],
    transport,
    metadata,
  );
  if (!isSuccess(deployResult.statusCode)) {
    const message = describeError(deployResult.body);
    writeTerminalMessage(
      resultsTerminal,
      "Save failed: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    vscode.window.showErrorMessage(
      `CPQ-BML: save failed (HTTP ${deployResult.statusCode}). ${message}`,
    );
    return;
  }

  resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Saved (${formatElapsed(startedAt)})\x1b[0m`);
  resultsTerminal.show();
  vscode.window.showInformationMessage(
    `CPQ-BML: ${metadata.variableName} saved.`,
  );
}

module.exports = { runSaveCurrentFile };
