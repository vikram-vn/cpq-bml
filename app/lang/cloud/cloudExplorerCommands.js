const { vscode, safeParseJson } = require('./cloudVscodeShim');
const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const metadataLib = require('@/lang/rest/metadata');
const { getSettings, getWorkspaceRoot, getUtilLibrariesFolder, getCommerceLibrariesFolder } = require('@/lang/rest/config');
const { findLocalFunctionFile } = require('@/lang/cloud/cloudExplorerFiles');

const activePulls = new Set();

function getUriFromFile(filePath, vscodeInstance) {
  if (vscodeInstance?.Uri?.file) return vscodeInstance.Uri.file(filePath);
  if (vscode?.Uri?.file) return vscode.Uri.file(filePath);
  return { fsPath: filePath, path: filePath };
}

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
        const doc = await vscodeInstance.workspace.openTextDocument(getUriFromFile(bmlPath, vscodeInstance));
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

      const localUri = getUriFromFile(localFile, vscodeInstance);
      const remoteUri = getUriFromFile(remoteTempPath, vscodeInstance);
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
  const doc = await vscodeInstance.workspace.openTextDocument(getUriFromFile(localFile, vscodeInstance));
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
        const doc = await vscodeInstance.workspace.openTextDocument(getUriFromFile(metaPath, vscodeInstance));
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

/**
 * Inserts or copies attribute variable name to active cursor or clipboard.
 */
async function insertOrCopyAttributeCommand(item, vscodeInstance = vscode) {
  const data = item?.data || item;
  if (!data) return;
  const varName = data.variableName || data.name || data.id || (typeof data === 'string' ? data : '');
  if (!varName) return;
  const { insertTextAtActiveCursor } = require('./cloudSnippets');
  await insertTextAtActiveCursor(varName, vscodeInstance);
}

/**
 * Copies variable name explicitly to clipboard.
 */
async function copyVariableNameCommand(item, vscodeInstance = vscode) {
  const data = item?.data || item;
  if (!data) return;
  const varName = data.variableName || data.name || data.id || (typeof data === 'string' ? data : '');
  if (!varName) return;
  if (vscodeInstance?.env?.clipboard?.writeText) {
    await vscodeInstance.env.clipboard.writeText(varName);
  }
  if (vscodeInstance?.window?.showInformationMessage) {
    vscodeInstance.window.showInformationMessage(`Copied variable name "${varName}" to clipboard.`);
  }
}

/**
 * Copies table name explicitly to clipboard.
 */
async function copyTableNameCommand(item, vscodeInstance = vscode) {
  const data = item?.data || item;
  if (!data) return;
  const tableName = data.name || data.tableName || data.variableName || (typeof data === 'string' ? data : '');
  if (!tableName) return;
  if (vscodeInstance?.env?.clipboard?.writeText) {
    await vscodeInstance.env.clipboard.writeText(tableName);
  }
  if (vscodeInstance?.window?.showInformationMessage) {
    vscodeInstance.window.showInformationMessage(`Copied table name "${tableName}" to clipboard.`);
  }
}

/**
 * Generates and inserts a type-safe BMQL query block for a Data Table.
 */
async function generateBmqlQueryCommand(item, vscodeInstance = vscode, context) {
  const data = item?.data || item;
  if (!data) return;
  const tableName = data.name || data.tableName || 'my_table';
  let columns = data.columns || [];

  if (columns.length === 0 && context) {
    try {
      const res = await api.getDataTable(context, vscodeInstance, tableName);
      if (res && res.statusCode >= 200 && res.statusCode < 300) {
        const schema = safeParseJson(res.body);
        if (schema && schema.columns) {
          columns = schema.columns;
        }
      }
    } catch {}
  }

  const { generateBmqlQuerySnippet, insertTextAtActiveCursor } = require('./cloudSnippets');
  const snippet = generateBmqlQuerySnippet(tableName, columns);
  await insertTextAtActiveCursor(snippet, vscodeInstance);
}

/**
 * Extracts BML script from a Commerce Action and opens it in a .bml editor.
 */
async function openActionBmlCommand(item, vscodeInstance = vscode, context) {
  const action = item?.data || item;
  if (!action) return;
  const proc = action.commerceProcess || 'oraclecpqo';
  const doc = action.commerceDocument || 'transaction';
  const actionVar = action.variableName;

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Extracting BML script for action '${actionVar || action.name}'...`,
    cancellable: false
  }, async () => {
    try {
      let data = action;
      if (actionVar && !data.scriptText && !data.bmlScript) {
        try {
          const res = await api.getCommerceAction(context, vscodeInstance, actionVar, { process: proc, document: doc });
          if (res && res.statusCode >= 200 && res.statusCode < 300) {
            data = safeParseJson(res.body, action);
          }
        } catch {}
      }

      let bmlText = data.scriptText || data.bmlScript || data.modifyScript || data.validationScript || data.script;
      if (!bmlText && typeof data === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'string' && (key.toLowerCase().includes('script') || key.toLowerCase().includes('bml')) && val.trim().length > 0) {
            bmlText = val;
            break;
          }
        }
      }

      if (!bmlText) {
        vscodeInstance?.window?.showInformationMessage?.(`Action '${actionVar}' does not contain an embedded BML script. Opening JSON definition.`);
        return openCommerceActionCommand(item, vscodeInstance, context);
      }

      const root = getWorkspaceRoot(vscodeInstance);
      if (root) {
        const actionDir = path.join(root, 'cpq', 'commerce', proc, 'actions');
        fs.mkdirSync(actionDir, { recursive: true });
        const filePath = path.join(actionDir, `${actionVar}.bml`);
        fs.writeFileSync(filePath, bmlText, 'utf8');
        const docObj = await vscodeInstance.workspace.openTextDocument(getUriFromFile(filePath, vscodeInstance));
        await vscodeInstance.window.showTextDocument(docObj);
      } else {
        const docObj = await vscodeInstance.workspace.openTextDocument({
          content: bmlText,
          language: 'bml'
        });
        await vscodeInstance.window.showTextDocument(docObj);
      }
    } catch (err) {
      vscodeInstance?.window?.showErrorMessage?.(`Failed to extract action BML: ${err.message}`);
    }
  });
}

/**
 * Extracts BML script from a Configuration Rule and opens it in a .bml editor.
 */
async function openRuleBmlCommand(item, vscodeInstance = vscode, context) {
  const rule = item?.data || item;
  if (!rule) return;
  const ruleVar = rule.variableName || rule.name || 'rule';
  const fam = rule.productFamily || 'general';

  const scriptText = rule.scriptText || rule.bmlScript || rule.conditionScript || rule.actionScript || rule.script;
  if (!scriptText) {
    vscodeInstance.window.showInformationMessage(`Configuration Rule '${ruleVar}' does not contain an embedded BML script.`);
    return;
  }

  const root = getWorkspaceRoot(vscodeInstance);
  if (root) {
    const ruleDir = path.join(root, 'cpq', 'config', fam, 'rules');
    fs.mkdirSync(ruleDir, { recursive: true });
    const filePath = path.join(ruleDir, `${ruleVar}.bml`);
    fs.writeFileSync(filePath, scriptText, 'utf8');
    const docObj = await vscodeInstance.workspace.openTextDocument(getUriFromFile(filePath, vscodeInstance));
    await vscodeInstance.window.showTextDocument(docObj);
  } else {
    const docObj = await vscodeInstance.workspace.openTextDocument({
      content: scriptText,
      language: 'bml'
    });
    await vscodeInstance.window.showTextDocument(docObj);
  }
}

/**
 * Captures live quote data for a transaction and writes a local test fixture in test/fixtures/.
 */
async function createTestFixtureCommand(item, vscodeInstance = vscode, context) {
  const tx = item?.data || item;
  if (!tx) {
    vscodeInstance.window.showWarningMessage('No transaction selected.');
    return;
  }

  const rawTxId = tx._id || tx.transactionID_t || tx.transactionId;
  const txId = String(rawTxId || '').trim();
  if (!txId) {
    vscodeInstance.window.showWarningMessage('Transaction ID is missing.');
    return;
  }

  const root = getWorkspaceRoot(vscodeInstance);
  if (!root) {
    vscodeInstance.window.showErrorMessage('Please open a workspace folder to save test fixtures.');
    return;
  }

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Capturing transaction '${txId}' as local test fixture...`,
    cancellable: false
  }, async () => {
    try {
      const settings = getSettings(vscodeInstance);
      const process = settings.commerceProcess || 'oraclecpqo';
      const document = settings.commerceDocument || 'transaction';

      let payload = tx;
      try {
        const res = await api.getTransaction(context, vscodeInstance, txId, { process, document, timeoutMs: 30000 });
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          payload = safeParseJson(res.body) || tx;
        }
      } catch {}

      const fixturesDir = path.join(root, 'test', 'fixtures');
      fs.mkdirSync(fixturesDir, { recursive: true });

      const safeId = txId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fixtureJsonPath = path.join(fixturesDir, `transaction_${safeId}.json`);
      fs.writeFileSync(fixtureJsonPath, JSON.stringify(payload, null, 2), 'utf8');

      const testBmlPath = path.join(fixturesDir, `transaction_${safeId}.test.bml`);
      if (!fs.existsSync(testBmlPath)) {
        const sampleBml = `// Test fixture harness for Transaction ${txId}\n` +
          `// Load mock data from transaction_${safeId}.json\n` +
          `transactionId = "${txId}";\n` +
          `status = "${payload.status_t || 'Draft'}";\n\n` +
          `// Write your test assertions below:\n` +
          `print("Running transaction test fixture for " + transactionId);\n` +
          `return true;\n`;
        fs.writeFileSync(testBmlPath, sampleBml, 'utf8');
      }

      const openChoice = await vscodeInstance?.window?.showInformationMessage?.(
        `Created test fixture 'test/fixtures/transaction_${safeId}.json'`,
        'Open Fixture JSON',
        'Open Test Harness'
      );
      if (openChoice === 'Open Fixture JSON') {
        const doc = await vscodeInstance.workspace.openTextDocument(getUriFromFile(fixtureJsonPath, vscodeInstance));
        await vscodeInstance.window.showTextDocument(doc);
      } else if (openChoice === 'Open Test Harness') {
        const doc = await vscodeInstance.workspace.openTextDocument(getUriFromFile(testBmlPath, vscodeInstance));
        await vscodeInstance.window.showTextDocument(doc);
      }
    } catch (err) {
      vscodeInstance?.window?.showErrorMessage?.(`Failed to create test fixture: ${err.message}`);
    }
  });
}

module.exports = {
  pullFunctionCommand,
  diffFunctionCommand,
  deployFunctionCommand,
  viewFunctionMetadataCommand,
  openCommerceActionCommand,
  switchCommerceProcessCommand,
  insertOrCopyAttributeCommand,
  copyVariableNameCommand,
  copyTableNameCommand,
  generateBmqlQueryCommand,
  openActionBmlCommand,
  openRuleBmlCommand,
  createTestFixtureCommand,
};
