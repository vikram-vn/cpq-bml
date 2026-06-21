const api = require('../api');
const metadataLib = require('../metadata');
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
} = require('./shared');

// PATCH { isOverridden: true } on a standard function to create a custom editable copy.
// On success the local sidecar is updated so Save/Validate now work.
async function runCreateOverride(
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'bml') {
    vscode.window.showErrorMessage('CPQ-BML: open a .bml file to create an override.');
    return;
  }
  const doc = editor.document;
  const metadata = await resolveMetadataForFile(context, vscode, doc.uri.fsPath, transport);
  if (!metadata) {
    vscode.window.showErrorMessage(
      'CPQ-BML: could not find CPQ metadata for this function. Pull it first.',
    );
    return;
  }
  if (!metadata.isStandardFunction) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is not a standard function — override not applicable.`,
    );
    return;
  }
  if (metadata.isOverridden) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is already overridden and editable.`,
    );
    return;
  }

  writeRunHeader(resultsTerminal, 'Create Override', metadata.variableName);
  writeRunningLine(resultsTerminal, 'Create Override', metadata.variableName);
  resultsTerminal.show();
  const startedAt = Date.now();

  const nsVarName = metadataLib.namespaceVariableNameFor(metadata);
  const result = await api.setOverride(context, vscode, nsVarName, true, metadata, transport);

  if (!isSuccess(result.statusCode)) {
    const message = describeError(result.body);
    writeTerminalMessage(
      resultsTerminal,
      'Override failed: ',
      `${message} (${formatElapsed(startedAt)})`,
      '\x1b[31m',
    );
    resultsTerminal.show();
    vscode.window.showErrorMessage(
      `CPQ-BML: create override failed (HTTP ${result.statusCode}). ${message}`,
    );
    return;
  }

  // Write updated sidecar — the response contains isOverridden: true
  const { metadata: updatedMeta } = metadataLib.splitFunctionResponse(result.body);
  if (metadata.commerceProcess) updatedMeta.commerceProcess = metadata.commerceProcess;
  if (metadata.commerceDocument) updatedMeta.commerceDocument = metadata.commerceDocument;
  const metaPath = metadataLib.bmlPathToMetaPath(doc.uri.fsPath);
  metadataLib.writeMetadata(metaPath, updatedMeta);

  // Refresh status bar + context keys immediately (active editor has not changed)
  await vscode.commands.executeCommand('cpqBml.internal.refreshStatus');

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Override created (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  vscode.window.showInformationMessage(
    `CPQ-BML: override created for "${metadata.variableName}". You can now edit and save it.`,
  );
}

// PATCH { isOverridden: false } to revert a standard function to its system version.
// The local .bml and sidecar are updated from the API response (system script).
async function runRemoveOverride(
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'bml') {
    vscode.window.showErrorMessage('CPQ-BML: open a .bml file to remove an override.');
    return;
  }
  const doc = editor.document;
  const metadata = await resolveMetadataForFile(context, vscode, doc.uri.fsPath, transport);
  if (!metadata) {
    vscode.window.showErrorMessage(
      'CPQ-BML: could not find CPQ metadata for this function.',
    );
    return;
  }
  if (!metadata.isStandardFunction) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is not a standard function.`,
    );
    return;
  }
  if (!metadata.isOverridden) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is not overridden — nothing to remove.`,
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove the override for "${metadata.variableName}"? The function will revert to the system version and any custom changes will be lost in CPQ.`,
    { modal: true },
    'Remove Override',
  );
  if (confirm !== 'Remove Override') return;

  writeRunHeader(resultsTerminal, 'Remove Override', metadata.variableName);
  writeRunningLine(resultsTerminal, 'Remove Override', metadata.variableName);
  resultsTerminal.show();
  const startedAt = Date.now();

  const nsVarName = metadataLib.namespaceVariableNameFor(metadata);
  const result = await api.setOverride(context, vscode, nsVarName, false, metadata, transport);

  if (!isSuccess(result.statusCode)) {
    const message = describeError(result.body);
    writeTerminalMessage(
      resultsTerminal,
      'Remove override failed: ',
      `${message} (${formatElapsed(startedAt)})`,
      '\x1b[31m',
    );
    resultsTerminal.show();
    vscode.window.showErrorMessage(
      `CPQ-BML: remove override failed (HTTP ${result.statusCode}). ${message}`,
    );
    return;
  }

  // Update sidecar (isOverridden: false) and revert .bml to the system script
  const { scriptText, metadata: updatedMeta } = metadataLib.splitFunctionResponse(result.body);
  if (metadata.commerceProcess) updatedMeta.commerceProcess = metadata.commerceProcess;
  if (metadata.commerceDocument) updatedMeta.commerceDocument = metadata.commerceDocument;
  const metaPath = metadataLib.bmlPathToMetaPath(doc.uri.fsPath);
  metadataLib.writeMetadata(metaPath, updatedMeta);
  metadataLib.writeBmlFile(doc.uri.fsPath, scriptText);

  // Refresh status bar + context keys immediately (active editor has not changed)
  await vscode.commands.executeCommand('cpqBml.internal.refreshStatus');

  resultsTerminal.writeLine(
    `\x1b[33m${getTimestamp()} Override removed — reverted to system version (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  vscode.window.showInformationMessage(
    `CPQ-BML: override removed for "${metadata.variableName}". Local file reverted to the system script.`,
  );
}

module.exports = { runCreateOverride, runRemoveOverride };
