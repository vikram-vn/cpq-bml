const fs = require('fs');
const path = require('path');
const os = require('os');
const { listSnapshots, rollbackSnapshot } = require('@/lang/rest/snapshotManager');
const { fetchRemoteContent } = require('@/lang/rest/deployDiffReviewer');
const metadataLib = require('@/lang/rest/metadata');
const { getExtensionContext, normalizeCommandArgs } = require('@/extensionContext');
const {
  getTimestamp,
  writeRunHeader,
  writeRunningLine,
  resolveMetadataForFile,
  ensureCredentials
} = require('@/lang/rest/commands/shared');

async function runRollbackSnapshot(resultsTerminal, options = {}) {
  const normArgs = normalizeCommandArgs(arguments);
  resultsTerminal = normArgs[0] || resultsTerminal;
  const effectiveOpts = (normArgs.length > 1 ? normArgs[1] : options) || {};
  const transport = effectiveOpts.transport;
  const { vscode } = getExtensionContext();

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'bml') {
    vscode.window.showErrorMessage('CPQ-BML: open a .bml file to roll back.');
    return { success: false, errorMessage: 'No active BML editor.' };
  }

  const doc = editor.document;
  const filePath = doc.uri.fsPath;
  const variableName = metadataLib.variableNameFromBmlPath(filePath);

  const wsFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
  const wsRoot = wsFolder ? wsFolder.uri.fsPath : null;

  const snapshots = listSnapshots(variableName, wsRoot);
  if (snapshots.length === 0) {
    vscode.window.showInformationMessage(`CPQ-BML: No rollback snapshots found for "${variableName}". Snapshots are automatically saved before every deployment or save.`);
    return { success: false, errorMessage: 'No snapshots available.' };
  }

  const items = snapshots.map(s => ({
    label: `$(history) ${s.formattedTime}`,
    description: `Env: ${s.environment}`,
    detail: `Type: ${s.functionType} | ID: ${s.id}`,
    snapshot: s
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Select snapshot to roll back "${variableName}"`
  });

  if (!selected) {
    return { success: false, cancelled: true };
  }

  const s = selected.snapshot;

  const action = await vscode.window.showWarningMessage(
    `Roll back "${variableName}" to version from ${s.formattedTime}?`,
    'Restore Local File',
    'Restore & Deploy to CPQ',
    'Cancel'
  );

  if (!action || action === 'Cancel') {
    return { success: false, cancelled: true };
  }

  const deployToRemote = action === 'Restore & Deploy to CPQ';

  if (resultsTerminal) {
    writeRunHeader(resultsTerminal, 'Rollback Snapshot', variableName);
    writeRunningLine(resultsTerminal, 'Rollback Snapshot', `${variableName} (${s.formattedTime})`);
    resultsTerminal.show();
  }

  const result = await rollbackSnapshot({
    snapshot: s,
    localFilePath: filePath,
    transport,
    deployToRemote
  });

  if (result.success) {
    if (resultsTerminal) {
      resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} ${result.message}\x1b[0m`);
      resultsTerminal.show();
    }
    vscode.window.showInformationMessage(`CPQ-BML: ${result.message}`);
  } else {
    if (resultsTerminal) {
      resultsTerminal.writeLine(`\x1b[31m${getTimestamp()} Rollback failed: ${result.errorMessage}\x1b[0m`);
      resultsTerminal.show();
    }
    vscode.window.showErrorMessage(`CPQ-BML: ${result.errorMessage}`);
  }

  return result;
}

async function runDiffWithRemote(resultsTerminal, options = {}) {
  const normArgs = normalizeCommandArgs(arguments);
  resultsTerminal = normArgs[0] || resultsTerminal;
  const effectiveOpts = (normArgs.length > 1 ? normArgs[1] : options) || {};
  const transport = effectiveOpts.transport;
  const { vscode } = getExtensionContext();

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'bml') {
    vscode.window.showErrorMessage('CPQ-BML: open a .bml file to compare with remote.');
    return { success: false };
  }

  const hasCredentials = await ensureCredentials();
  if (!hasCredentials) {
    return { success: false, errorMessage: 'Credentials not configured.' };
  }

  const doc = editor.document;
  const filePath = doc.uri.fsPath;
  const metadata = await resolveMetadataForFile(filePath, transport);

  if (!metadata) {
    const varName = metadataLib.variableNameFromBmlPath(filePath);
    vscode.window.showErrorMessage(`CPQ-BML: could not find metadata for "${varName}".`);
    return { success: false };
  }

  if (resultsTerminal) {
    resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Fetching live remote version of "${metadata.variableName}"...\x1b[0m`);
    resultsTerminal.show();
  }

  const remoteContent = await fetchRemoteContent(metadata, transport);
  if (remoteContent === null) {
    vscode.window.showWarningMessage(`CPQ-BML: "${metadata.variableName}" does not exist on remote CPQ Cloud or could not be retrieved.`);
    return { success: false };
  }

  const tempDir = path.join(os.tmpdir(), 'cpq-bml-diff');
  if (!fs.existsSync(tempDir)) {
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch {}
  }

  const tempRemotePath = path.join(tempDir, `${metadata.variableName}.live-remote.bml`);
  fs.writeFileSync(tempRemotePath, remoteContent, 'utf8');

  await vscode.commands.executeCommand(
    'vscode.diff',
    vscode.Uri.file(tempRemotePath),
    vscode.Uri.file(filePath),
    `Live Remote ↔ Local: ${metadata.variableName}`
  );

  return { success: true };
}

module.exports = {
  runRollbackSnapshot,
  runDiffWithRemote
};
