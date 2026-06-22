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

  const { metadata: updatedMeta } = metadataLib.splitFunctionResponse(result.body);
  if (metadata.commerceProcess) updatedMeta.commerceProcess = metadata.commerceProcess;
  if (metadata.commerceDocument) updatedMeta.commerceDocument = metadata.commerceDocument;
  const metaPath = metadataLib.bmlPathToMetaPath(doc.uri.fsPath);
  metadataLib.writeMetadata(metaPath, updatedMeta);

  await vscode.commands.executeCommand('cpqBml.internal.refreshStatus');

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Override created (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  vscode.window.showInformationMessage(
    `CPQ-BML: override created for "${metadata.variableName}". You can now edit and save it.`,
  );
}

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

  const { scriptText, metadata: updatedMeta } = metadataLib.splitFunctionResponse(result.body);
  if (metadata.commerceProcess) updatedMeta.commerceProcess = metadata.commerceProcess;
  if (metadata.commerceDocument) updatedMeta.commerceDocument = metadata.commerceDocument;
  const metaPath = metadataLib.bmlPathToMetaPath(doc.uri.fsPath);
  metadataLib.writeMetadata(metaPath, updatedMeta);
  metadataLib.writeBmlFile(doc.uri.fsPath, scriptText);

  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === doc && typeof vscode.window.activeTextEditor.edit === 'function') {
    await vscode.window.activeTextEditor.edit(editBuilder => {
      const lastLine = doc.lineCount - 1;
      const fullRange = new vscode.Range(0, 0, lastLine, doc.lineAt(lastLine).text.length);
      editBuilder.replace(fullRange, scriptText);
    });
  }

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
