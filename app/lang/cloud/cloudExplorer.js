const { vscode, extractStringValue, formatNameAndVarName } = require('@/lang/cloud/cloudVscodeShim');
const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { getSettings, getWorkspaceRoot, isConfigured } = require('@/lang/rest/config');
const {
  findLocalFunctionFile,
  groupFunctionsByFolder,
  findLocalCommerceProcesses,
  resolveCommerceTargets,
  getActiveCommerceTarget,
  setActiveCommerceTarget,
} = require('@/lang/cloud/cloudExplorerFiles');
const {
  pullFunctionCommand,
  diffFunctionCommand,
  deployFunctionCommand,
  debugFunctionCommand,
  debugConfigureFunctionCommand,
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
} = require('@/lang/cloud/cloudExplorerCommands');
const {
  fetchUtilFunctions,
  fetchCommerceFunctions,
  fetchCommerceActions,
} = require('@/lang/cloud/cloudExplorerFetch');
const { buildCloudTreeItem } = require('@/lang/cloud/cloudExplorerTreeItem');
const {
  filterExplorerCommand,
  clearFilterCommand,
  searchExplorerCommand,
} = require('@/lang/cloud/cloudExplorerSearch');


/**
 * Pure Factory: Creates the Cloud Explorer TreeDataProvider.
 */
function createCloudExplorer(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedUtilFunctions = null;
  let cachedCommerceFunctions = null;
  let cachedCommerceActions = null;
  let cachedUtilGroups = null;
  let cachedCommerceGroups = null;
  let isLoading = false;
  let filterQuery = '';

  function setFilter(query) {
    filterQuery = typeof query === 'string' ? query.trim() : '';
    if (vscodeInstance?.commands?.executeCommand) {
      vscodeInstance.commands.executeCommand('setContext', 'cpqBml.cloudExplorerFiltered', Boolean(filterQuery));
    }
    onDidChangeTreeDataEmitter.fire();
  }

  function getFilter() {
    return filterQuery;
  }

  function clearFilter() {
    setFilter('');
  }

  function matchesFunction(fn, query) {
    if (!fn) return false;
    const q = query.toLowerCase();
    const varName = extractStringValue(fn.variableName || fn.name, '').toLowerCase();
    const name = extractStringValue(fn.name, '').toLowerCase();
    const folder = extractStringValue(fn.folderName || fn.namespace, '').toLowerCase();
    const returnType = extractStringValue(fn.returnType, '').toLowerCase();
    const desc = extractStringValue(fn.description, '').toLowerCase();
    const proc = extractStringValue(fn.commerceProcess, '').toLowerCase();
    const doc = extractStringValue(fn.commerceDocument, '').toLowerCase();

    return varName.includes(q) ||
      name.includes(q) ||
      folder.includes(q) ||
      returnType.includes(q) ||
      desc.includes(q) ||
      proc.includes(q) ||
      doc.includes(q);
  }

  function matchesAction(action, query) {
    if (!action) return false;
    const q = query.toLowerCase();
    const varName = extractStringValue(action.variableName || action.name, '').toLowerCase();
    const label = extractStringValue(action.label || action.name, '').toLowerCase();
    const actionType = extractStringValue(action.actionType || action.type, '').toLowerCase();
    const desc = extractStringValue(action.description, '').toLowerCase();
    const proc = extractStringValue(action.commerceProcess, '').toLowerCase();
    const doc = extractStringValue(action.commerceDocument, '').toLowerCase();

    return varName.includes(q) ||
      label.includes(q) ||
      actionType.includes(q) ||
      desc.includes(q) ||
      proc.includes(q) ||
      doc.includes(q);
  }

  async function fetchRemoteFunctions() {
    if (cachedUtilFunctions) {
      return { util: cachedUtilFunctions };
    }
    if (isLoading) {
      return { util: cachedUtilFunctions || [] };
    }
    isLoading = true;

    try {
      const utilItems = await fetchUtilFunctions(vscodeInstance, context);
      cachedUtilFunctions = Array.isArray(utilItems) ? utilItems : [];
      cachedUtilGroups = groupFunctionsByFolder(cachedUtilFunctions);
      return { util: cachedUtilFunctions };
    } catch {
      cachedUtilFunctions = [];
      cachedUtilGroups = new Map();
      return { util: [] };
    } finally {
      isLoading = false;
    }
  }

  const getRoot = () => getWorkspaceRoot(vscodeInstance);

  function getTreeItem(element) {
    return buildCloudTreeItem(element, vscodeInstance, filterQuery, getRoot);
  }


  async function getChildren(element) {
    const wsRoot = getRoot();
    if (!wsRoot) {
      return [];
    }

    if (!element) {
      await fetchRemoteFunctions();

      if (filterQuery) {
        const filteredUtil = (cachedUtilFunctions || []).filter(fn => matchesFunction(fn, filterQuery));
        const totalMatches = filteredUtil.length;

        const filterNode = {
          type: 'filterInfo',
          query: filterQuery,
          totalMatches
        };

        if (totalMatches === 0) {
          return [
            filterNode,
            {
              type: 'empty',
              label: `No util functions match "${filterQuery}"`,
              tooltip: 'Click to clear filter',
              command: {
                command: 'cpqBml.cloud.clearFilter',
                title: 'Clear Cloud Explorer Filter'
              }
            }
          ];
        }

        const groups = groupFunctionsByFolder(filteredUtil);
        const folderNodes = [];
        for (const [folderName, list] of groups.entries()) {
          folderNodes.push({
            type: 'folder',
            category: 'util',
            folderName,
            count: list.length,
            functions: list,
            isFiltered: true
          });
        }
        folderNodes.sort((a, b) => a.folderName.localeCompare(b.folderName));
        return [filterNode, ...folderNodes];
      }

      if (!cachedUtilGroups || cachedUtilGroups.size === 0) {
        return [{
          type: 'empty',
          label: 'No util libraries found'
        }];
      }

      const folderNodes = [];
      for (const [folderName, list] of cachedUtilGroups.entries()) {
        folderNodes.push({
          type: 'folder',
          category: 'util',
          folderName,
          count: list.length,
          functions: list
        });
      }
      folderNodes.sort((a, b) => a.folderName.localeCompare(b.folderName));
      return folderNodes;
    }

    if (element.type === 'category') {
      const groups = element.groups || (element.functions ? groupFunctionsByFolder(element.functions) : cachedUtilGroups);
      if (!groups || groups.size === 0) {
        return [{
          type: 'empty',
          label: 'No util functions found'
        }];
      }
      const folderNodes = [];
      for (const [folderName, list] of groups.entries()) {
        folderNodes.push({
          type: 'folder',
          category: element.category || 'util',
          isCommerce: element.category === 'commerce',
          folderName,
          count: list.length,
          functions: list
        });
      }
      folderNodes.sort((a, b) => a.folderName.localeCompare(b.folderName));
      return folderNodes;
    }

    if (element.type === 'folder') {
      return (element.functions || []).map(fn => ({
        type: 'function',
        data: fn
      }));
    }

    if (element.type === 'actionFolder') {
      return (element.actions || []).map(action => ({
        type: 'action',
        data: action
      }));
    }

    return [];
  }

  function refresh() {
    cachedUtilFunctions = null;
    cachedUtilGroups = null;
    onDidChangeTreeDataEmitter.fire();
  }

  return {
    onDidChangeTreeData,
    getTreeItem,
    getChildren,
    refresh,
    setFilter,
    getFilter,
    clearFilter,
    fetchRemoteFunctions,
    getCachedFunctions: () => cachedUtilFunctions || [],
    getCachedActions: () => [],
    getCachedGroups: () => ({ util: cachedUtilGroups })
  };
}

function registerCloudExplorer(context, vscodeInstance = vscode) {
  const treeDataProvider = createCloudExplorer(vscodeInstance, context);
  const treeView = vscodeInstance.window.registerTreeDataProvider('cpqBml.cloudExplorer', treeDataProvider);

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.refresh', () => {
    treeDataProvider.refresh();
  });

  const pullCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.pullFunction', (item) => {
    return pullFunctionCommand(item, vscodeInstance, context).then(() => treeDataProvider.refresh());
  });

  const diffCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.diffFunction', (item) => {
    return diffFunctionCommand(item, vscodeInstance, context);
  });

  const openLocalCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.openLocal', async (item) => {
    const fn = item?.data || item;
    if (!fn) return;
    const folders = vscodeInstance.workspace.workspaceFolders;
    const root = folders && folders.length > 0 ? folders[0].uri.fsPath : null;
    const commerceMetadata = (fn.isCommerce || fn.commerceDocument)
      ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument }
      : null;
    const local = findLocalFunctionFile(root, fn.variableName || fn.name, fn.folderName, commerceMetadata, vscodeInstance);
    if (local) {
      const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(local));
      await vscodeInstance.window.showTextDocument(doc);
    } else {
      vscodeInstance.window.showInformationMessage(`Function '${fn.variableName || fn.name}' is only on the Cloud.`);
    }
  });

  const openActionCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.openCommerceAction', (item) => {
    return openCommerceActionCommand(item, vscodeInstance, context);
  });

  const switchProcCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.switchCommerceProcess', () => {
    return switchCommerceProcessCommand(vscodeInstance, context);
  });

  const searchExplorerCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.searchExplorer', () => {
    return searchExplorerCommand(treeDataProvider, vscodeInstance, context);
  });

  const filterExplorerCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.filterExplorer', () => {
    return filterExplorerCommand(treeDataProvider, vscodeInstance);
  });

  const clearFilterCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.clearFilter', () => {
    return clearFilterCommand(treeDataProvider, vscodeInstance);
  });

  const deployCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.deployFunction', (item) => {
    return deployFunctionCommand(item, vscodeInstance, context);
  });

  const debugCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.debugFunction', (item) => {
    return debugFunctionCommand(item, vscodeInstance, context);
  });

  const debugConfigureCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.debugConfigureFunction', (item) => {
    return debugConfigureFunctionCommand(item, vscodeInstance, context);
  });

  const viewMetaCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.viewFunctionMetadata', (item) => {
    return viewFunctionMetadataCommand(item, vscodeInstance, context);
  });

  const insertAttrCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.insertOrCopyAttribute', (item) => {
    return insertOrCopyAttributeCommand(item, vscodeInstance);
  });

  const copyVarCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.copyVariableName', (item) => {
    return copyVariableNameCommand(item, vscodeInstance);
  });

  const copyTableCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.copyTableName', (item) => {
    return copyTableNameCommand(item, vscodeInstance);
  });

  const generateBmqlCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.generateBmqlQuery', (item) => {
    return generateBmqlQueryCommand(item, vscodeInstance, context);
  });

  const openActionBmlCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.openActionBml', (item) => {
    return openActionBmlCommand(item, vscodeInstance, context);
  });

  const openRuleBmlCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.openRuleBml', (item) => {
    return openRuleBmlCommand(item, vscodeInstance, context);
  });

  const createFixtureCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.createTestFixture', (item) => {
    return createTestFixtureCommand(item, vscodeInstance, context);
  });

  context.subscriptions.push(
    treeView,
    refreshCmd,
    pullCmd,
    diffCmd,
    openLocalCmd,
    openActionCmd,
    switchProcCmd,
    searchExplorerCmd,
    filterExplorerCmd,
    clearFilterCmd,
    deployCmd,
    debugCmd,
    debugConfigureCmd,
    viewMetaCmd,
    insertAttrCmd,
    copyVarCmd,
    copyTableCmd,
    generateBmqlCmd,
    openActionBmlCmd,
    openRuleBmlCmd,
    createFixtureCmd
  );

  return { treeDataProvider, treeView };
}

module.exports = {
  findLocalFunctionFile,
  groupFunctionsByFolder,
  findLocalCommerceProcesses,
  resolveCommerceTargets,
  getActiveCommerceTarget,
  setActiveCommerceTarget,
  createCloudExplorer,
  pullFunctionCommand,
  diffFunctionCommand,
  deployFunctionCommand,
  debugFunctionCommand,
  debugConfigureFunctionCommand,
  viewFunctionMetadataCommand,
  openCommerceActionCommand,
  switchCommerceProcessCommand,
  filterExplorerCommand,
  clearFilterCommand,
  searchExplorerCommand,
  insertOrCopyAttributeCommand,
  copyVariableNameCommand,
  copyTableNameCommand,
  generateBmqlQueryCommand,
  openActionBmlCommand,
  openRuleBmlCommand,
  createTestFixtureCommand,
  registerCloudExplorer
};
