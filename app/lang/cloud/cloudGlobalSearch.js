const { vscode, safeParseJson } = require('./cloudVscodeShim');

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { isConfigured, getSettings } = require('@/lang/rest/config');
const { IGNORED_FOLDERS } = require('@/lang/intellisense/workspaceIndex');

/**
 * Recursively scans directory for .bml files.
 */
function findWorkspaceBmlFiles(dir, maxDepth = 6, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.charCodeAt(0) === 46 || IGNORED_FOLDERS.has(entry.name.toLowerCase())) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findWorkspaceBmlFiles(full, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && (entry.name.endsWith('.bml') || entry.name.endsWith('.bmlt'))) {
        results.push(full);
      }
    }
  } catch {
    // Ignore read errors
  }
  return results;
}

/**
 * Searches local workspace .bml files for query string.
 */
function searchLocalWorkspaceBml(workspaceRoot, query) {
  const matches = [];
  const files = findWorkspaceBmlFiles(workspaceRoot);
  const lower = query.toLowerCase();

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        if (lineText.toLowerCase().includes(lower)) {
          matches.push({
            file: filePath,
            relPath: path.relative(workspaceRoot, filePath).replace(/\\/g, '/'),
            line: i + 1,
            lineText: lineText.trim(),
            source: 'Local Workspace'
          });
        }
      }
    } catch {
      // Ignore file read error
    }
  }

  return matches;
}

/**
 * Interactive Global BML Search runner across entire CPQ system.
 */
async function runGlobalBmlSearch(context, vscodeInstance = vscode, prefilledQuery) {
  let query = prefilledQuery;
  if (!query) {
    query = await vscodeInstance.window.showInputBox({
      prompt: 'Search BML scripts across entire CPQ system',
      placeHolder: 'e.g. calculateDiscount, urldata, myCustomUtil...',
      ignoreFocusOut: true
    });
  }

  if (!query || !query.trim()) {
    return;
  }
  query = query.trim();

  const folders = vscodeInstance.workspace.workspaceFolders;
  const workspaceRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : null;

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Searching CPQ system for "${query}"...`,
    cancellable: false
  }, async (progress) => {
    let cloudResults = [];
    let dataTableResults = [];
    let transactionResults = [];
    let cloudAvailable = false;

    if (isConfigured(vscodeInstance)) {
      progress.report({ message: 'Querying CPQ Cloud 26A+ Search API, Data Tables & Transactions...' });
      
      const searchPromises = [
        // 1. Search BML Scripts & Actions
        (async () => {
          try {
            const res = await api.searchBmlScripts(context, vscodeInstance, {
              query,
              limit: 100
            });

            if (res.statusCode >= 200 && res.statusCode < 300) {
              cloudAvailable = true;
              const parsed = safeParseJson(res.body);
              const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
              cloudResults = items.map(it => {
                const snippet = it.snippet || (it.scriptText ? it.scriptText.slice(0, 120).trim() : '');
                let name = it.name || it.variableName || it.scriptName;
                let type = it.componentType || it.scriptType;
                let proc = it.commerceProcess || '';
                let doc = it.commerceDocument || '';

                if (it.path && typeof it.path === 'string') {
                  const parts = it.path.includes(' : ') ? it.path.split(' : ') : it.path.split('/');
                  if (!name) name = parts[parts.length - 1];
                  if (!type) type = parts[0];
                  if (!proc && parts.length > 2) proc = parts[1];
                  if (!doc && parts.length > 3) doc = parts[2];
                }
                if (!name) name = 'Script';
                if (!type) type = 'Cloud Script';

                return {
                  category: 'script',
                  name,
                  type,
                  process: proc,
                  document: doc,
                  snippet,
                  scriptText: it.scriptText,
                  source: 'CPQ Cloud',
                  path: it.path,
                  raw: it
                };
              });
            }
          } catch {
            // Ignore script search error
          }
        })(),

        // 2. Search CPQ Data Tables
        (async () => {
          try {
            const dtRes = await api.listDataTables(context, vscodeInstance, { limit: 500 });
            if (dtRes && dtRes.statusCode >= 200 && dtRes.statusCode < 300) {
              const parsed = safeParseJson(dtRes.body);
              const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
              const lower = query.toLowerCase();
              dataTableResults = items
                .filter(it => {
                  const name = String(it.name || it.variableName || it.tableName || '').toLowerCase();
                  const label = String(it.label || it.description || '').toLowerCase();
                  const desc = String(it.description || '').toLowerCase();
                  return name.includes(lower) || label.includes(lower) || desc.includes(lower);
                })
                .map(it => ({
                  category: 'datatable',
                  name: it.name || it.variableName || it.tableName,
                  label: it.label || it.name,
                  description: it.description || '',
                  source: 'CPQ Data Tables',
                  raw: it
                }));
            }
          } catch {
            // Ignore datatable search error
          }
        })(),

        // 3. Search Transactions
        (async () => {
          try {
            const txRes = await api.getTransactions(context, vscodeInstance, {
              limit: 50,
              fields: '_id,transactionID_t,status_t,customer_t,transactionName_t'
            });
            if (txRes && txRes.statusCode >= 200 && txRes.statusCode < 300) {
              const parsed = safeParseJson(txRes.body);
              const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
              const lower = query.toLowerCase();
              transactionResults = items
                .filter(it => {
                  const id = String(it.transactionID_t || it._id || '').toLowerCase();
                  const cust = String(it.customer_t || '').toLowerCase();
                  const name = String(it.transactionName_t || '').toLowerCase();
                  const status = String(it.status_t || '').toLowerCase();
                  return id.includes(lower) || cust.includes(lower) || name.includes(lower) || status.includes(lower);
                })
                .map(it => ({
                  category: 'transaction',
                  name: it.transactionID_t || it._id,
                  id: it._id,
                  transactionID_t: it.transactionID_t,
                  customer: it.customer_t,
                  status: it.status_t,
                  source: 'Recent Transactions',
                  raw: it
                }));
            }
          } catch {
            // Ignore transaction search error
          }
        })()
      ];

      await Promise.allSettled(searchPromises);
    }

    // Local workspace search
    progress.report({ message: 'Searching local BML workspace...' });
    const localResults = workspaceRoot ? searchLocalWorkspaceBml(workspaceRoot, query) : [];

    // Combine results for quick pick
    const quickPickItems = [];

    // Add Cloud Script Results
    if (cloudResults.length > 0) {
      quickPickItems.push({
        label: `Cloud Matches (${cloudResults.length})`,
        kind: -1 // Separator
      });

      for (const item of cloudResults) {
        quickPickItems.push({
          label: `$(cloud) ${item.name}`,
          description: `[${item.type}] ${item.process ? item.process + '/' + item.document : ''}`,
          detail: item.snippet || 'Click to view full BML script',
          data: item
        });
      }
    }

    // Add Data Table Results
    if (dataTableResults.length > 0) {
      quickPickItems.push({
        label: `Data Table Matches (${dataTableResults.length})`,
        kind: -1 // Separator
      });

      for (const item of dataTableResults) {
        quickPickItems.push({
          label: `$(database) ${item.name}`,
          description: item.label !== item.name ? item.label : 'Data Table',
          detail: item.description || 'Click to query table in BMQL Live Console or export CSV',
          data: item
        });
      }
    }

    // Add Transaction Results
    if (transactionResults.length > 0) {
      quickPickItems.push({
        label: `Transaction Matches (${transactionResults.length})`,
        kind: -1 // Separator
      });

      for (const item of transactionResults) {
        quickPickItems.push({
          label: `$(history) ${item.name}`,
          description: item.status ? `[${item.status}]` : 'Transaction',
          detail: item.customer ? `Customer: ${item.customer}` : 'Click to inspect transaction details',
          data: item
        });
      }
    }

    // Add Local Results
    if (localResults.length > 0) {
      quickPickItems.push({
        label: `Local Workspace Matches (${localResults.length})`,
        kind: -1 // Separator
      });

      for (const item of localResults) {
        quickPickItems.push({
          label: `$(file-code) ${path.basename(item.file)}:${item.line}`,
          description: item.relPath,
          detail: item.lineText,
          data: item
        });
      }
    }

    if (quickPickItems.length === 0) {
      vscodeInstance.window.showInformationMessage(`No matches found for "${query}" across CPQ system.`);
      return;
    }

    const totalMatches = cloudResults.length + dataTableResults.length + transactionResults.length + localResults.length;

    // Show interactive quick pick
    const selected = await vscodeInstance.window.showQuickPick(quickPickItems, {
      placeHolder: `Found ${totalMatches} match(es) across scripts, data tables, transactions & local workspace for "${query}"`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected || !selected.data) return;

    const data = selected.data;

    if (data.category === 'datatable') {
      const actionChoice = await vscodeInstance.window.showQuickPick([
        { label: '$(play) Query Table in BMQL Live Console', action: 'query' },
        { label: '$(cloud-download) Export Table to CSV', action: 'export' },
        { label: '$(json) View Table Schema Definition', action: 'schema' }
      ], { placeHolder: `Action for Data Table: ${data.name}` });

      if (!actionChoice) return;

      if (actionChoice.action === 'query') {
        if (vscodeInstance.commands?.executeCommand) {
          await vscodeInstance.commands.executeCommand('cpqBml.cloud.queryDataTable', { data: data.raw || { name: data.name } });
        }
      } else if (actionChoice.action === 'export') {
        if (vscodeInstance.commands?.executeCommand) {
          await vscodeInstance.commands.executeCommand('cpqBml.cloud.exportDataTableCsv', { data: data.raw || { name: data.name } });
        }
      } else if (actionChoice.action === 'schema') {
        const doc = await vscodeInstance.workspace.openTextDocument({
          content: JSON.stringify(data.raw, null, 2),
          language: 'json'
        });
        await vscodeInstance.window.showTextDocument(doc);
      }
      return;
    }

    if (data.category === 'transaction') {
      const actionChoice = await vscodeInstance.window.showQuickPick([
        { label: '$(inspect) Inspect Transaction Details', action: 'inspect' },
        { label: '$(debug-alt) Debug Active BML on this Transaction', action: 'debug' },
        { label: '$(copy) Copy Transaction ID to Clipboard', action: 'copy' }
      ], { placeHolder: `Action for Transaction: ${data.name}` });

      if (!actionChoice) return;

      if (actionChoice.action === 'inspect') {
        if (vscodeInstance.commands?.executeCommand) {
          await vscodeInstance.commands.executeCommand('cpqBml.cloud.inspectTransaction', { data: data.raw });
        }
      } else if (actionChoice.action === 'debug') {
        if (vscodeInstance.commands?.executeCommand) {
          await vscodeInstance.commands.executeCommand('cpqBml.cloud.debugOnTransaction', { data: data.raw });
        }
      } else if (actionChoice.action === 'copy') {
        if (vscodeInstance.commands?.executeCommand) {
          await vscodeInstance.commands.executeCommand('cpqBml.cloud.copyTransactionId', { data: data.raw });
        }
      }
      return;
    }

    if (data.file) {
      // Local workspace file match -> open at line
      const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(data.file));
      const editor = await vscodeInstance.window.showTextDocument(doc);
      if (editor && data.line && vscodeInstance.Position && vscodeInstance.Range) {
        const pos = new vscodeInstance.Position(data.line - 1, 0);
        editor.selection = new vscodeInstance.Range(pos, pos);
        if (typeof editor.revealRange === 'function') {
          editor.revealRange(new vscodeInstance.Range(pos, pos));
        }
      }
    } else if (data.scriptText) {
      // Cloud script content -> open as document
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: data.scriptText,
        language: 'bml'
      });
      await vscodeInstance.window.showTextDocument(doc);
    } else if (data.raw) {
      // Other cloud payload
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: JSON.stringify(data.raw, null, 2),
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(doc);
    }
  });
}

function registerCloudGlobalSearch(context, vscodeInstance = vscode) {
  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.globalSearch', (prefilled) => {
    return runGlobalBmlSearch(context, vscodeInstance, typeof prefilled === 'string' ? prefilled : undefined);
  });

  context.subscriptions.push(searchCmd);
  return { searchCmd };
}

module.exports = {
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
  runGlobalBmlSearch,
  registerCloudGlobalSearch
};
