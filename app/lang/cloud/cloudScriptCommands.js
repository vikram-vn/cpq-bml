'use strict';

const fs = require('fs');
const path = require('path');
const { vscode, safeParseJson } = require('@/lang/cloud/cloudVscodeShim');
const api = require('@/lang/rest/api');
const { getSettings, getWorkspaceRoot } = require('@/lang/rest/config');
const { insertTextAtActiveCursor, generateBmqlQuerySnippet } = require('@/lang/cloud/cloudSnippets');

function getUriFromFile(filePath, vscodeInstance) {
  if (vscodeInstance?.Uri?.file) return vscodeInstance.Uri.file(filePath);
  if (vscode?.Uri?.file) return vscode.Uri.file(filePath);
  return { fsPath: filePath, path: filePath };
}

/**
 * Inserts or copies attribute variable name to active cursor or clipboard.
 */
async function insertOrCopyAttributeCommand(item, vscodeInstance = vscode) {
  const data = item?.data || item;
  if (!data) return;
  const varName = data.variableName || data.name || data.id || (typeof data === 'string' ? data : '');
  if (!varName) return;
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
        const { openCommerceActionCommand } = require('@/lang/cloud/cloudExplorerCommands');
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
  getUriFromFile,
  insertOrCopyAttributeCommand,
  copyVariableNameCommand,
  copyTableNameCommand,
  generateBmqlQueryCommand,
  openActionBmlCommand,
  openRuleBmlCommand,
  createTestFixtureCommand
};
