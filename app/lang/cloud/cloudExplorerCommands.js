const { vscode, safeParseJson } = require('./cloudVscodeShim');
const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const metadataLib = require('@/lang/rest/metadata');
const { getSettings, getWorkspaceRoot, getUtilLibrariesFolder, getCommerceLibrariesFolder } = require('@/lang/rest/config');
const { findLocalFunctionFile } = require('@/lang/cloud/cloudExplorerFiles');

const activePulls = new Set();

/**
 * Handles pulling a cloud function down into the workspace library directory.
 */
async function pullFunctionCommand(item, vscodeInstance = vscode, context) {
  const fn = item?.data || item;
  if (!fn || (!fn.variableName && !fn.name)) {
    vscodeInstance.window.showWarningMessage('No function selected to pull.');
    return;
  }

  const varName = fn.variableName || fn.name;
  const folderName = fn.folderName || fn.namespace || 'util';
  const root = getWorkspaceRoot(vscodeInstance);
  if (!root) {
    vscodeInstance.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }
  const settings = getSettings(vscodeInstance);
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceProcess = fn.commerceProcess || settings.commerceProcess || 'oraclecpqo';
  const commerceDocument = fn.commerceDocument || settings.commerceDocument || 'transaction';
  const commerceMetadata = isCommerce ? { commerceProcess, commerceDocument } : undefined;
  const pullKey = `${isCommerce ? commerceProcess + '_' + commerceDocument : 'util'}_${varName}`;

  if (activePulls.has(pullKey)) {
    return;
  }
  activePulls.add(pullKey);

  try {
    await vscodeInstance.window.withProgress({
      location: 15,
      title: `Pulling '${varName}' from CPQ Cloud...`,
      cancellable: false
    }, async () => {
      try {
        const nsVarName = metadataLib.namespaceVariableNameFor(fn);
        let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName, undefined, commerceMetadata);

        if ((res.statusCode < 200 || res.statusCode >= 300) && nsVarName !== varName) {
          res = await api.getLibraryFunction(context, vscodeInstance, varName, undefined, commerceMetadata);
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(`HTTP ${res.statusCode}: Unable to fetch function content.`);
        }

        const { scriptText, metadata } = metadataLib.splitFunctionResponse(res.body);
        metadata.variableName = metadata.variableName || varName;
        metadata.name = metadata.name || fn.name || varName;

        let targetDir;
        let displayDest;
        if (isCommerce) {
          metadata.commerceProcess = commerceProcess;
          metadata.commerceDocument = commerceDocument || 'transaction';
          metadata.folderName = metadata.folderName || folderName;
          const commerceFolder = getCommerceLibrariesFolder(vscodeInstance, commerceProcess);
          targetDir = path.join(root, commerceFolder, varName);
          displayDest = `${commerceFolder}/${varName}/`;
        } else {
          metadata.folderName = metadata.folderName || folderName;
          const utilFolder = getUtilLibrariesFolder(vscodeInstance);
          targetDir = folderName
            ? path.join(root, utilFolder, folderName, varName)
            : path.join(root, utilFolder, varName);
          displayDest = folderName
            ? `${utilFolder}/${folderName}/${varName}/`
            : `${utilFolder}/${varName}/`;
        }

        fs.mkdirSync(targetDir, { recursive: true });

        const bmlPath = path.join(targetDir, `${varName}.bml`);
        const metaPath = path.join(targetDir, `${varName}-meta.json`);

        fs.writeFileSync(bmlPath, scriptText, 'utf8');
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

        vscodeInstance.window.showInformationMessage(`Successfully pulled '${varName}' to ${displayDest}`);
        const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(bmlPath));
        await vscodeInstance.window.showTextDocument(doc);
      } catch (err) {
        vscodeInstance.window.showErrorMessage(`Failed to pull '${varName}': ${err.message}`);
      }
    });
  } finally {
    activePulls.delete(pullKey);
  }
}

/**
 * Diffs local function against remote version on CPQ server.
 */
async function diffFunctionCommand(item, vscodeInstance = vscode, context) {
  const fn = item?.data || item;
  if (!fn || (!fn.variableName && !fn.name)) {
    vscodeInstance.window.showWarningMessage('No function selected to diff.');
    return;
  }

  const varName = fn.variableName || fn.name;
  const folderName = fn.folderName || fn.namespace || '';
  const root = getWorkspaceRoot(vscodeInstance);
  if (!root) {
    vscodeInstance.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }
  const settings = getSettings(vscodeInstance);
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceProcess = fn.commerceProcess || settings.commerceProcess || 'oraclecpqo';
  const commerceDocument = fn.commerceDocument || settings.commerceDocument || 'transaction';
  const commerceMetadata = isCommerce ? { commerceProcess, commerceDocument } : undefined;

  const localFile = findLocalFunctionFile(root, varName, folderName, commerceMetadata, vscodeInstance);
  if (!localFile) {
    vscodeInstance.window.showWarningMessage(`Function '${varName}' is not present locally. Pull it first to compare.`);
    return;
  }

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Fetching remote '${varName}' for side-by-side diff...`,
    cancellable: false
  }, async () => {
    try {
      const nsVarName = metadataLib.namespaceVariableNameFor(fn);
      let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName, undefined, commerceMetadata);
      if ((res.statusCode < 200 || res.statusCode >= 300) && nsVarName !== varName) {
        res = await api.getLibraryFunction(context, vscodeInstance, varName, undefined, commerceMetadata);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`HTTP ${res.statusCode}: Failed to fetch remote function.`);
      }

      const { scriptText } = metadataLib.splitFunctionResponse(res.body);

      const cacheDir = path.join(root, 'cpq', 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const prefix = isCommerce ? `${commerceProcess}_${commerceDocument}_` : '';
      const remoteTempPath = path.join(cacheDir, `${prefix}${varName}.remote.bml`);
      fs.writeFileSync(remoteTempPath, scriptText, 'utf8');

      const localUri = vscodeInstance.Uri.file(localFile);
      const remoteUri = vscodeInstance.Uri.file(remoteTempPath);
      const title = `${varName} (Server <-> Local)`;

      await vscodeInstance.commands.executeCommand('vscode.diff', remoteUri, localUri, title);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Diff failed for '${varName}': ${err.message}`);
    }
  });
}

/**
 * Opens a commerce document action definition in a JSON editor.
 */
async function openCommerceActionCommand(item, vscodeInstance = vscode, context) {
  const action = item?.data || item;
  if (!action) return;
  const proc = action.commerceProcess || 'oraclecpqo';
  const doc = action.commerceDocument || 'transaction';
  const actionVar = action.variableName;

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Loading action '${actionVar || action.name}' definition...`,
    cancellable: false
  }, async () => {
    try {
      let data = action;
      if (actionVar) {
        const res = await api.getCommerceAction(context, vscodeInstance, actionVar, { process: proc, document: doc });
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          data = safeParseJson(res.body, action);
        }
      }
      const formatted = JSON.stringify(data, null, 2);
      const docObj = await vscodeInstance.workspace.openTextDocument({
        content: formatted,
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(docObj);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to load action '${actionVar}': ${err.message}`);
    }
  });
}

/**
 * Prompts user to select or enter a commerce process and document, updating active target and refreshing tree views.
 */
async function switchCommerceProcessCommand(vscodeInstance = vscode, context) {
  let processes = [];
  try {
    const res = await api.listCommerceProcesses(context, vscodeInstance);
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      const body = safeParseJson(res.body);
      processes = Array.isArray(body) ? body : ((body && (body.items || body.processes || body.data)) || []);
    }
  } catch {}

  const picks = processes.map(p => ({
    label: p.name || p.variableName,
    description: p.variableName,
    detail: p.description || ''
  }));

  picks.push({
    label: '$(edit) Enter custom process name...',
    description: 'Manual input'
  });

  const selectedProc = await vscodeInstance.window.showQuickPick(picks, {
    placeHolder: 'Select Commerce Process'
  });
  if (!selectedProc) return;

  let processVar = selectedProc.description === 'Manual input' ? null : selectedProc.description || selectedProc.label;
  if (!processVar) {
    processVar = await vscodeInstance.window.showInputBox({
      prompt: 'Enter Commerce Process variable name (e.g. oraclecpqo)',
      value: 'oraclecpqo'
    });
    if (!processVar) return;
  }

  let documents = [];
  try {
    const docRes = await api.listCommerceDocuments(context, vscodeInstance, { process: processVar, limit: 50 });
    if (docRes && docRes.statusCode >= 200 && docRes.statusCode < 300) {
      const body = safeParseJson(docRes.body);
      documents = Array.isArray(body) ? body : ((body && (body.items || body.documents || body.data)) || []);
    }
  } catch {}

  let docVar = 'transaction';
  if (documents.length > 0) {
    const docPicks = documents.map(d => ({
      label: d.name || d.variableName,
      description: d.variableName
    }));
    const selectedDoc = await vscodeInstance.window.showQuickPick(docPicks, {
      placeHolder: `Select Document for process '${processVar}'`
    });
    if (selectedDoc) {
      docVar = selectedDoc.description || selectedDoc.label;
    }
  }

  const { setActiveCommerceTarget } = require('@/lang/cloud/cloudExplorerFiles');
  setActiveCommerceTarget({ process: processVar, document: docVar });

  if (vscodeInstance.commands && vscodeInstance.commands.executeCommand) {
    vscodeInstance.commands.executeCommand('cpqBml.cloud.refresh');
    vscodeInstance.commands.executeCommand('cpqBml.cloud.refreshTransactions');
  }

  vscodeInstance.window.showInformationMessage(`Active commerce target set to '${processVar}/${docVar}'`);
}

/**
 * Deploys a local library function to CPQ Cloud from the explorer.
 */
async function deployFunctionCommand(item, vscodeInstance = vscode, context) {
  const fn = item?.data || item;
  if (!fn || (!fn.variableName && !fn.name)) {
    vscodeInstance.window.showWarningMessage('No function selected to deploy.');
    return;
  }

  const varName = fn.variableName || fn.name;
  const folderName = fn.folderName || fn.namespace || '';
  const root = getWorkspaceRoot(vscodeInstance);
  if (!root) {
    vscodeInstance.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }
  const settings = getSettings(vscodeInstance);
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceProcess = fn.commerceProcess || settings.commerceProcess || 'oraclecpqo';
  const commerceDocument = fn.commerceDocument || settings.commerceDocument || 'transaction';
  const commerceMetadata = isCommerce ? { commerceProcess, commerceDocument } : undefined;

  const localFile = findLocalFunctionFile(root, varName, folderName, commerceMetadata, vscodeInstance);
  if (!localFile) {
    const choice = await vscodeInstance.window.showWarningMessage(
      `Function '${varName}' is not present locally. Pull it first to deploy.`,
      'Pull Now'
    );
    if (choice === 'Pull Now') {
      await pullFunctionCommand(item, vscodeInstance, context);
    }
    return;
  }

  // Open the local file and trigger deployment
  const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(localFile));
  await vscodeInstance.window.showTextDocument(doc);
  await vscodeInstance.commands.executeCommand('cpqBml.rest.deployCurrentFile');
}

/**
 * Opens function metadata (-meta.json or remote metadata) in editor.
 */
async function viewFunctionMetadataCommand(item, vscodeInstance = vscode, context) {
  const fn = item?.data || item;
  if (!fn || (!fn.variableName && !fn.name)) {
    vscodeInstance.window.showWarningMessage('No function selected.');
    return;
  }

  const varName = fn.variableName || fn.name;
  const folderName = fn.folderName || fn.namespace || '';
  const root = getWorkspaceRoot(vscodeInstance);
  const settings = getSettings(vscodeInstance);
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceProcess = fn.commerceProcess || settings.commerceProcess || 'oraclecpqo';
  const commerceDocument = fn.commerceDocument || settings.commerceDocument || 'transaction';
  const commerceMetadata = isCommerce ? { commerceProcess, commerceDocument } : undefined;

  // 1. Check if local -meta.json exists
  if (root) {
    const localFile = findLocalFunctionFile(root, varName, folderName, commerceMetadata, vscodeInstance);
    if (localFile) {
      const metaPath = localFile.replace(/\.bml$/, '-meta.json');
      if (fs.existsSync(metaPath)) {
        const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(metaPath));
        await vscodeInstance.window.showTextDocument(doc);
        return;
      }
    }
  }

  // 2. Otherwise, fetch remote metadata
  await vscodeInstance.window.withProgress({
    location: (vscodeInstance.ProgressLocation && vscodeInstance.ProgressLocation.Notification) || 15,
    title: `Loading metadata for '${varName}'...`,
    cancellable: false
  }, async () => {
    try {
      const nsVarName = metadataLib.namespaceVariableNameFor(fn);
      let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName, undefined, commerceMetadata);
      if ((res.statusCode < 200 || res.statusCode >= 300) && nsVarName !== varName) {
        res = await api.getLibraryFunction(context, vscodeInstance, varName, undefined, commerceMetadata);
      }

      let metadata = fn;
      if (res && res.statusCode >= 200 && res.statusCode < 300) {
        const parsed = metadataLib.splitFunctionResponse(res.body);
        metadata = parsed.metadata || safeParseJson(res.body, fn);
      }

      const formatted = JSON.stringify(metadata, null, 2);
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: formatted,
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(doc);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to load metadata for '${varName}': ${err.message}`);
    }
  });
}

module.exports = {
  pullFunctionCommand,
  diffFunctionCommand,
  deployFunctionCommand,
  viewFunctionMetadataCommand,
  openCommerceActionCommand,
  switchCommerceProcessCommand
};
