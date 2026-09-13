'use strict';

const path = require('path');
const { extractStringValue, formatNameAndVarName } = require('@/lang/cloud/cloudVscodeShim');
const { getWorkspaceRoot } = require('@/lang/rest/config');
const { findLocalFunctionFile } = require('@/lang/cloud/cloudExplorerFiles');
const {
  pullFunctionCommand,
  openCommerceActionCommand
} = require('@/lang/cloud/cloudExplorerCommands');

/**
 * Prompts user for a filter string to filter the Cloud Explorer tree in-place.
 */
async function filterExplorerCommand(treeDataProvider, vscodeInstance) {
  const currentFilter = treeDataProvider.getFilter ? (treeDataProvider.getFilter() || '') : '';
  const query = await vscodeInstance.window.showInputBox({
    title: 'Filter Cloud Explorer',
    prompt: 'Filter functions and actions by name, folder, type, or description',
    placeHolder: 'e.g. quote, calc, util, abo...',
    value: currentFilter,
    ignoreFocusOut: true
  });

  if (query === undefined) {
    return;
  }

  if (!query.trim()) {
    if (treeDataProvider.clearFilter) treeDataProvider.clearFilter();
  } else {
    if (treeDataProvider.setFilter) treeDataProvider.setFilter(query.trim());
  }
}

/**
 * Clears the active Cloud Explorer tree filter.
 */
function clearFilterCommand(treeDataProvider, vscodeInstance) {
  if (treeDataProvider && treeDataProvider.clearFilter) {
    treeDataProvider.clearFilter();
  }
}

/**
 * Interactive QuickPick search across all Cloud Explorer sections (Functions, Actions, Rules, Attributes, Data Tables).
 */
async function searchExplorerCommand(treeDataProvider, vscodeInstance, context) {
  if (treeDataProvider && treeDataProvider.fetchRemoteFunctions) {
    await treeDataProvider.fetchRemoteFunctions();
  }

  const functions = treeDataProvider.getCachedFunctions ? (treeDataProvider.getCachedFunctions() || []) : [];
  const actions = treeDataProvider.getCachedActions ? (treeDataProvider.getCachedActions() || []) : [];

  const wsRoot = getWorkspaceRoot(vscodeInstance);
  const items = [];

  // 1. Functions (Util & Commerce)
  for (const fn of functions) {
    const varName = extractStringValue(fn.variableName || fn.name, 'function');
    const name = extractStringValue(fn.name || varName, varName);
    const displayLabel = formatNameAndVarName(name, varName);
    const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
    const commerceMetadata = isCommerce ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument } : null;
    const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName, commerceMetadata, vscodeInstance);
    const returnType = extractStringValue(fn.returnType, '');
    const folderName = fn.folderName || fn.namespace || (isCommerce ? fn.commerceDocument || 'transaction' : 'Global');
    const envType = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util';

    const icon = localPath ? '$(check)' : '$(cloud)';
    const label = `${icon} ${displayLabel}`;
    const statusBadge = localPath ? '✓ Local' : '☁ Cloud';
    const descParts = [`[${envType}]`, folderName];
    if (returnType) descParts.push(`-> ${returnType}`);
    descParts.push(statusBadge);

    items.push({
      label,
      description: descParts.join(' '),
      detail: fn.description || (localPath ? `Local: ${path.basename(localPath)}` : 'Cloud function (click to pull and open)'),
      data: fn,
      itemType: 'function',
      localPath
    });
  }

  // 2. Actions (Commerce)
  for (const act of actions) {
    const varName = extractStringValue(act.variableName || act.name, 'action');
    const name = extractStringValue(act.label || act.name || varName, varName);
    const displayLabel = formatNameAndVarName(name, varName);
    const actionType = extractStringValue(act.actionType || act.type || 'Action');
    const doc = act.commerceDocument || 'transaction';
    const proc = act.commerceProcess || 'oraclecpqo';

    items.push({
      label: `$(zap) ${displayLabel}`,
      description: `[Action: ${proc}/${doc}] [${actionType}]`,
      detail: act.description || `Commerce Action for ${doc} (click to view definition)`,
      data: act,
      itemType: 'action'
    });
  }

  // 3. Auxiliary items
  if (context) {
    try {
      const dtItems = context.workspaceState?.get('cpqCloudDataTablesCache');
      if (Array.isArray(dtItems)) {
        for (const dt of dtItems) {
          const tableName = dt.name || dt.variableName;
          const displayLabel = formatNameAndVarName(dt.description || tableName, tableName);
          items.push({
            label: `$(database) ${displayLabel}`,
            description: '[CPQ Data Table]',
            detail: dt.description || `Data Table: ${tableName} (click to query in BMQL)`,
            data: dt,
            itemType: 'dataTable'
          });
        }
      }
    } catch {}
  }

  if (items.length === 0) {
    vscodeInstance.window.showInformationMessage('No items found in Cloud Explorer.');
    return;
  }

  const currentFilter = treeDataProvider.getFilter ? treeDataProvider.getFilter() : '';
  const filterPromptItem = {
    label: currentFilter ? `$(clear-all) Clear Active Filter ("${currentFilter}")` : '$(filter) Filter Cloud Explorer Tree View...',
    description: currentFilter ? 'Reset tree view to show all functions & actions' : 'Filter the sidebar tree by keyword',
    action: currentFilter ? 'clearFilter' : 'filterTree'
  };
  items.unshift(filterPromptItem);

  const selected = await vscodeInstance.window.showQuickPick(items, {
    placeHolder: 'Search across all sections (functions, actions, rules, attributes, tables)...',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selected) return;

  if (selected.action === 'filterTree') {
    return filterExplorerCommand(treeDataProvider, vscodeInstance);
  }
  if (selected.action === 'clearFilter') {
    return clearFilterCommand(treeDataProvider, vscodeInstance);
  }

  if (selected.itemType === 'function') {
    if (selected.localPath) {
      const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(selected.localPath));
      await vscodeInstance.window.showTextDocument(doc);
    } else {
      await pullFunctionCommand(selected, vscodeInstance, context);
      treeDataProvider.refresh();
    }
  } else if (selected.itemType === 'action') {
    await openCommerceActionCommand(selected, vscodeInstance, context);
  } else if (selected.itemType === 'dataTable') {
    const tableName = selected.data?.name || selected.data?.variableName;
    if (tableName) {
      const doc = await vscodeInstance.workspace.openTextDocument({
        language: 'bml',
        content: `// Query ${tableName}\nresults = bmql("SELECT * FROM ${tableName}");\n`
      });
      await vscodeInstance.window.showTextDocument(doc);
    }
  } else if (selected.itemType === 'rule') {
    const r = selected.data;
    const name = r.name || r.variableName || 'Rule';
    vscodeInstance.window.showInformationMessage(`Rule: ${name} [${r.ruleType || 'Commerce Rule'}]\n${r.description || ''}`);
  } else if (selected.itemType === 'attribute') {
    const a = selected.data;
    const name = a.label || a.variableName || 'Attribute';
    vscodeInstance.window.showInformationMessage(`Attribute: ${name} (${a.variableName}) [${a.dataType || 'String'}]\n${a.description || ''}`);
  } else if (selected.itemType === 'configFamily') {
    const f = selected.data;
    vscodeInstance.window.showInformationMessage(`Product Family: ${f.label || f.variableName} (${f.variableName})`);
  }
}

module.exports = {
  filterExplorerCommand,
  clearFilterCommand,
  searchExplorerCommand,
};
