const fs = require('fs');
const path = require('path');
const os = require('os');
const api = require('@/lang/rest/api');
const metadataLib = require('@/lang/rest/metadata');
const { isSuccess } = require('@/lang/rest/commands/shared');

/**
 * Fetches the current live BML content of a function from CPQ Cloud.
 */
async function fetchRemoteContent(metadata, transport) {
  if (!metadata || !metadata.variableName) return null;

  try {
    if (metadata.commerceDocument) {
      const res = await api.getCommerceRule(
        metadata.commerceProcess,
        metadata.commerceDocument,
        metadata.variableName,
        transport
      );
      if (isSuccess(res.statusCode) && res.body) {
        return res.body.scriptText || res.body.bml || res.body.conditionScriptText || '';
      }
      return null;
    }

    const nsVarName = metadataLib.namespaceVariableNameFor(metadata);
    const res = await api.getLibraryFunction(nsVarName, transport);
    if (isSuccess(res.statusCode) && res.body) {
      return res.body.scriptText || res.body.bml || '';
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Interactively reviews differences between local and live remote BML before deployment.
 */
async function compareAndPromptPreDeploy({
  vscode,
  localPath,
  localContent,
  metadata,
  transport
}) {
  const remoteContent = await fetchRemoteContent(metadata, transport);

  // If function doesn't exist remotely yet, proceed directly
  if (remoteContent === null) {
    return { canProceed: true, remoteContent: '', isNew: true };
  }

  const normalizedLocal = (localContent || '').replace(/\r\n/g, '\n').trim();
  const normalizedRemote = (remoteContent || '').replace(/\r\n/g, '\n').trim();

  // If local and remote are identical
  if (normalizedLocal === normalizedRemote) {
    const action = await vscode.window.showInformationMessage(
      `"${metadata.variableName}" is already identical to the live remote version on CPQ Cloud.`,
      'Deploy Anyway',
      'Cancel'
    );
    return {
      canProceed: action === 'Deploy Anyway',
      remoteContent,
      isIdentical: true
    };
  }

  // Remote differs: offer diff review or immediate deploy
  const choice = await vscode.window.showWarningMessage(
    `"${metadata.variableName}" differs from the current live remote version on CPQ Cloud.`,
    'Deploy to CPQ',
    'Review Diff First',
    'Cancel'
  );

  if (choice === 'Deploy to CPQ') {
    return { canProceed: true, remoteContent, isNew: false };
  }

  if (choice === 'Review Diff First') {
    const tempDir = path.join(os.tmpdir(), 'cpq-bml-predeploy-diff');
    if (!fs.existsSync(tempDir)) {
      try { fs.mkdirSync(tempDir, { recursive: true }); } catch {}
    }

    const tempRemotePath = path.join(tempDir, `${metadata.variableName}.live-remote.bml`);
    fs.writeFileSync(tempRemotePath, remoteContent, 'utf8');

    if (vscode.commands && typeof vscode.commands.executeCommand === 'function') {
      await vscode.commands.executeCommand(
        'vscode.diff',
        vscode.Uri.file(tempRemotePath),
        vscode.Uri.file(localPath),
        `Live Remote ↔ Local (To Deploy): ${metadata.variableName}`
      );
    }

    const postDiffChoice = await vscode.window.showInformationMessage(
      `After reviewing diff for "${metadata.variableName}", proceed with deploying local changes to live CPQ?`,
      'Deploy to CPQ',
      'Cancel'
    );

    return {
      canProceed: postDiffChoice === 'Deploy to CPQ',
      remoteContent,
      isNew: false
    };
  }

  return { canProceed: false, remoteContent, isNew: false };
}

module.exports = {
  fetchRemoteContent,
  compareAndPromptPreDeploy
};
