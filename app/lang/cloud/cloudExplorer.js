const { vscode, extractStringValue } = require('./cloudVscodeShim');
const path = require('path');
const api = require('@/lang/rest/api');
const { getSettings, getWorkspaceRoot } = require('@/lang/rest/config');
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
  openCommerceActionCommand,
  switchCommerceProcessCommand
} = require('@/lang/cloud/cloudExplorerCommands');
const {
  fetchUtilFunctions,
  fetchCommerceFunctions,
  fetchCommerceActions,
} = require('@/lang/cloud/cloudExplorerFetch');

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
    if (cachedUtilFunctions && cachedCommerceFunctions && cachedCommerceActions) {
      return { util: cachedUtilFunctions, commerce: cachedCommerceFunctions, actions: cachedCommerceActions };
    }
    if (isLoading) {
      return { util: cachedUtilFunctions || [], commerce: cachedCommerceFunctions || [], actions: cachedCommerceActions || [] };
    }
    isLoading = true;

    try {
      const [utilResult, commerceResult, actionsResult] = await Promise.allSettled([
        fetchUtilFunctions(vscodeInstance, context),
        fetchCommerceFunctions(vscodeInstance, context),
        fetchCommerceActions(vscodeInstance, context)
      ]);

      const utilItems = utilResult.status === 'fulfilled' ? utilResult.value : [];
      const commerceItems = commerceResult.status === 'fulfilled' ? commerceResult.value : [];
      const actionItems = actionsResult.status === 'fulfilled' ? actionsResult.value : [];

      cachedUtilFunctions = utilItems;
      cachedCommerceFunctions = commerceItems;
      cachedCommerceActions = actionItems;
      cachedUtilGroups = groupFunctionsByFolder(utilItems);
      cachedCommerceGroups = groupFunctionsByFolder(commerceItems);

      return { util: utilItems, commerce: commerceItems, actions: actionItems };
    } finally {
      isLoading = false;
    }
  }

  const getRoot = () => getWorkspaceRoot(vscodeInstance);

  function getTreeItem(element) {
    if (element.type === 'filterInfo') {
      const item = new vscodeInstance.TreeItem(
        `Filter: "${element.query}" (${element.totalMatches} match${element.totalMatches === 1 ? '' : 'es'})`,
        vscodeInstance.TreeItemCollapsibleState.None
      );
      item.description = 'Click to clear';
      item.tooltip = `Active search filter: "${element.query}"\nFound ${element.totalMatches} matching item(s)\nClick to clear filter`;
      item.iconPath = new vscodeInstance.ThemeIcon('filter');
      item.contextValue = 'cpqCloudFilterInfo';
      item.command = {
        command: 'cpqBml.cloud.clearFilter',
        title: 'Clear Cloud Explorer Filter'
      };
      return item;
    }

    if (element.type === 'category') {
      const isFiltered = Boolean(filterQuery);
      const label = element.isFiltered ? element.label : `${element.label} (${element.count})`;
      const item = new vscodeInstance.TreeItem(
        label,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      if (element.category === 'actions') {
        item.contextValue = 'cpqCloudCategoryActions';
        item.iconPath = new vscodeInstance.ThemeIcon('symbol-event');
      } else if (element.category === 'commerce') {
        item.contextValue = 'cpqCloudCategoryCommerce';
        item.iconPath = new vscodeInstance.ThemeIcon('briefcase');
      } else {
        item.contextValue = 'cpqCloudCategoryUtil';
        item.iconPath = new vscodeInstance.ThemeIcon('library');
      }
      return item;
    }

    if (element.type === 'folder') {
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        `${element.folderName} (${element.count})`,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = element.isCommerce ? 'cpqCloudCommerceFolder' : 'cpqCloudFolder';
      item.iconPath = new vscodeInstance.ThemeIcon('folder');
      return item;
    }

    if (element.type === 'empty') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('info');
      if (element.command) {
        item.command = element.command;
        item.tooltip = element.tooltip || 'Click to switch active Commerce Process / Document';
      }
      return item;
    }

    if (element.type === 'actionFolder') {
      const isFiltered = Boolean(filterQuery);
      const docLabel = element.docName === 'transaction'
        ? 'Transaction (Header)'
        : (element.docName === 'transactionLine' ? 'Transaction Line (Sub-document)' : element.docName);
      const item = new vscodeInstance.TreeItem(
        `${docLabel} (${element.count})`,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Expanded
      );
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-event');
      item.tooltip = `Commerce Actions for document '${element.docName}'`;
      return item;
    }

    if (element.type === 'action') {
      const action = element.data;
      const varName = extractStringValue(action.variableName || action.name, 'action');
      const label = extractStringValue(action.label || action.name || varName, varName);
      const item = new vscodeInstance.TreeItem(label, vscodeInstance.TreeItemCollapsibleState.None);

      const actionType =
        extractStringValue(action.actionType) ||
        extractStringValue(action.type) ||
        'Action';
      item.description = `[${actionType}] ${varName}`;
      const desc = extractStringValue(action.description, '');
      item.tooltip = [
        `Commerce Action: ${label}`,
        `Variable Name: ${varName}`,
        `Action Type: ${actionType}`,
        desc ? `Description: ${desc}` : null,
        `Document: ${action.commerceProcess}/${action.commerceDocument || 'transaction'}`,
        '---',
        'Click to view action definition'
      ].filter(Boolean).join('\n');

      item.iconPath = new vscodeInstance.ThemeIcon('zap', new vscodeInstance.ThemeColor('symbolIcon.eventForeground'));
      item.contextValue = 'cpqCloudCommerceAction';
      item.command = {
        command: 'cpqBml.cloud.openCommerceAction',
        title: 'View Action Definition',
        arguments: [element]
      };
      return item;
    }

    // Function item
    const fn = element.data;
    const varName = extractStringValue(fn.variableName || fn.name, 'function');
    const wsRoot = getRoot();
    const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
    const commerceMetadata = isCommerce
      ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument }
      : null;
    const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName, commerceMetadata, vscodeInstance);

    const label = extractStringValue(fn.name || varName, varName);
    const item = new vscodeInstance.TreeItem(label, vscodeInstance.TreeItemCollapsibleState.None);

    const badges = [];
    const hasStagedTimestamps = Boolean(
      fn.lastModified && fn.lastDeployed && new Date(fn.lastModified) > new Date(fn.lastDeployed)
    );
    const hasDeployedTimestamps = Boolean(
      fn.lastDeployed && (!fn.lastModified || new Date(fn.lastDeployed) >= new Date(fn.lastModified))
    );

    const isStaged = fn.deploymentStatus === 'STAGING' ||
                     fn.deploymentStatus === 'CHANGED' ||
                     fn.status === 'staged' ||
                     fn.isStaged === true ||
                     hasStagedTimestamps;
    const isDeployed = fn.deploymentStatus === 'DEPLOYED' ||
                       fn.status === 'active' ||
                       hasDeployedTimestamps ||
                       (!isStaged && fn.deploymentStatus !== undefined);

    if (isStaged) {
      badges.push('[Staging]');
    } else if (isDeployed) {
      badges.push('[Deployed]');
    }

    if (fn.isOverridden) {
      badges.push('[Overridden]');
    } else if (fn.isStandardFunction) {
      badges.push('[Standard]');
    }

    if (localPath) {
      badges.push('✓ Local');
    } else {
      badges.push('☁ Cloud');
    }

    const returnType = extractStringValue(fn.returnType, '');
    if (returnType) {
      badges.push(`-> ${returnType}`);
    }

    item.description = badges.join(' ');
    item.contextValue = localPath ? 'cpqCloudFunctionSynced' : 'cpqCloudFunctionRemote';

    const deployStatusText = isStaged ? 'Staging (Pending Deployment)' : (isDeployed ? 'Deployed' : 'Unknown');
    const funcTypeText = fn.isOverridden
      ? 'Standard Function (Overridden)'
      : (fn.isStandardFunction ? 'Standard Function' : 'Custom Library Function');

    if (localPath) {
      const procDoc = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util Library';
      item.tooltip = [
        `${varName} [${deployStatusText}]`,
        `Type: ${funcTypeText}`,
        `Environment: ${procDoc}`,
        `Local File: ${path.basename(localPath)}`,
        `Folder: ${fn.folderName || 'Global'}`,
        `Return: ${returnType || 'void'}`,
        '---',
        'Click to open local file in editor'
      ].join('\n');

      if (isStaged) {
        item.iconPath = new vscodeInstance.ThemeIcon('beaker', new vscodeInstance.ThemeColor('problemsWarningIcon.foreground'));
      } else if (fn.isOverridden) {
        item.iconPath = new vscodeInstance.ThemeIcon('diff-modified', new vscodeInstance.ThemeColor('symbolIcon.eventForeground'));
      } else {
        item.iconPath = new vscodeInstance.ThemeIcon('check', new vscodeInstance.ThemeColor('testing.iconPassed'));
      }

      item.command = {
        command: 'vscode.open',
        title: 'Open Local Function',
        arguments: [vscodeInstance.Uri.file(localPath)]
      };
    } else {
      const procDoc = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util Library';
      item.tooltip = [
        `${varName} [Cloud Only - ${deployStatusText}]`,
        `Type: ${funcTypeText}`,
        `Environment: ${procDoc}`,
        `Folder: ${fn.folderName || 'Global'}`,
        `Return: ${fn.returnType || 'void'}`,
        '---',
        'Double-click to download and open'
      ].join('\n');

      if (isStaged) {
        item.iconPath = new vscodeInstance.ThemeIcon('cloud', new vscodeInstance.ThemeColor('problemsWarningIcon.foreground'));
      } else {
        item.iconPath = new vscodeInstance.ThemeIcon('cloud-download', new vscodeInstance.ThemeColor('textLink.foreground'));
      }

      item.command = {
        command: 'cpqBml.cloud.pullFunction',
        title: 'Download and Open Function',
        arguments: [element]
      };
    }

    return item;
  }

  async function getChildren(element) {
    const wsRoot = getRoot();
    if (!wsRoot) {
      return [];
    }

    if (!element) {
      await fetchRemoteFunctions();
      const settings = getSettings(vscodeInstance);
      const commerceProcess = settings.commerceProcess || 'oraclecpqo';
      const commerceDocument = settings.commerceDocument || 'transaction';

      if (filterQuery) {
        const filteredUtil = (cachedUtilFunctions || []).filter(fn => matchesFunction(fn, filterQuery));
        const filteredCommerce = (cachedCommerceFunctions || []).filter(fn => matchesFunction(fn, filterQuery));
        const filteredActions = (cachedCommerceActions || []).filter(act => matchesAction(act, filterQuery));
        const totalMatches = filteredUtil.length + filteredCommerce.length + filteredActions.length;

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
              label: `No functions or actions match "${filterQuery}"`,
              tooltip: 'Click to clear filter',
              command: {
                command: 'cpqBml.cloud.clearFilter',
                title: 'Clear Cloud Explorer Filter'
              }
            }
          ];
        }

        const nodes = [filterNode];
        if (filteredUtil.length > 0) {
          nodes.push({
            type: 'category',
            category: 'util',
            label: `Util Libraries (${filteredUtil.length} match${filteredUtil.length === 1 ? '' : 'es'})`,
            count: filteredUtil.length,
            groups: groupFunctionsByFolder(filteredUtil),
            isFiltered: true
          });
        }
        if (filteredCommerce.length > 0) {
          nodes.push({
            type: 'category',
            category: 'commerce',
            label: `Commerce Libraries (${commerceProcess}/${commerceDocument}) (${filteredCommerce.length} match${filteredCommerce.length === 1 ? '' : 'es'})`,
            count: filteredCommerce.length,
            groups: groupFunctionsByFolder(filteredCommerce),
            commerceProcess,
            commerceDocument,
            isFiltered: true
          });
        }
        if (filteredActions.length > 0) {
          nodes.push({
            type: 'category',
            category: 'actions',
            label: `Commerce Document Actions (${commerceProcess}) (${filteredActions.length} match${filteredActions.length === 1 ? '' : 'es'})`,
            count: filteredActions.length,
            filteredActions,
            commerceProcess,
            commerceDocument,
            isFiltered: true
          });
        }
        return nodes;
      }

      const nodes = [
        {
          type: 'category',
          category: 'util',
          label: 'Util Libraries',
          count: cachedUtilFunctions ? cachedUtilFunctions.length : 0,
          groups: cachedUtilGroups
        },
        {
          type: 'category',
          category: 'commerce',
          label: `Commerce Libraries (${commerceProcess}/${commerceDocument})`,
          count: cachedCommerceFunctions ? cachedCommerceFunctions.length : 0,
          groups: cachedCommerceGroups,
          commerceProcess,
          commerceDocument
        },
        {
          type: 'category',
          category: 'actions',
          label: `Commerce Document Actions (${commerceProcess})`,
          count: cachedCommerceActions ? cachedCommerceActions.length : 0,
          commerceProcess,
          commerceDocument
        }
      ];
      return nodes;
    }

    if (element.type === 'category') {
      if (element.category === 'actions') {
        const actionsToDisplay = element.isFiltered
          ? (element.filteredActions || [])
          : (cachedCommerceActions || []);

        if (!actionsToDisplay || actionsToDisplay.length === 0) {
          return [{
            type: 'empty',
            label: element.isFiltered
              ? `No actions match "${filterQuery}"`
              : 'No commerce document actions found (Click to switch process)',
            command: element.isFiltered ? {
              command: 'cpqBml.cloud.clearFilter',
              title: 'Clear Filter'
            } : {
              command: 'cpqBml.cloud.switchCommerceProcess',
              title: 'Switch Commerce Process'
            }
          }];
        }

        const docGroups = new Map();
        for (const action of actionsToDisplay) {
          const docName = action.commerceDocument || 'transaction';
          if (!docGroups.has(docName)) {
            docGroups.set(docName, []);
          }
          docGroups.get(docName).push(action);
        }

        if (docGroups.size > 1) {
          const docFolders = [];
          for (const [docName, actions] of docGroups.entries()) {
            docFolders.push({
              type: 'actionFolder',
              docName,
              commerceProcess: element.commerceProcess,
              count: actions.length,
              actions
            });
          }
          docFolders.sort((a, b) => a.docName.localeCompare(b.docName));
          return docFolders;
        }

        return actionsToDisplay.map(action => ({
          type: 'action',
          data: action
        }));
      }

      if (!element.groups || element.groups.size === 0) {
        return [{
          type: 'empty',
          label: `No ${element.category === 'commerce' ? 'commerce' : 'util'} functions found`
        }];
      }

      const folderNodes = [];
      for (const [folderName, list] of element.groups.entries()) {
        folderNodes.push({
          type: 'folder',
          category: element.category,
          isCommerce: element.category === 'commerce',
          commerceProcess: element.commerceProcess,
          commerceDocument: element.commerceDocument,
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
    cachedCommerceFunctions = null;
    cachedCommerceActions = null;
    cachedUtilGroups = null;
    cachedCommerceGroups = null;
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
    getCachedFunctions: () => (cachedUtilFunctions || []).concat(cachedCommerceFunctions || []),
    getCachedActions: () => cachedCommerceActions || [],
    getCachedGroups: () => ({ util: cachedUtilGroups, commerce: cachedCommerceGroups })
  };
}

/**
 * Prompts user for a filter string to filter the Cloud Explorer tree in-place.
 */
async function filterExplorerCommand(treeDataProvider, vscodeInstance = vscode) {
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
function clearFilterCommand(treeDataProvider, vscodeInstance = vscode) {
  if (treeDataProvider && treeDataProvider.clearFilter) {
    treeDataProvider.clearFilter();
  }
}

/**
 * Interactive QuickPick search across all CPQ functions and actions.
 */
async function searchExplorerCommand(treeDataProvider, vscodeInstance = vscode, context) {
  if (treeDataProvider && treeDataProvider.fetchRemoteFunctions) {
    await treeDataProvider.fetchRemoteFunctions();
  }

  const functions = treeDataProvider.getCachedFunctions ? (treeDataProvider.getCachedFunctions() || []) : [];
  const actions = treeDataProvider.getCachedActions ? (treeDataProvider.getCachedActions() || []) : [];

  if (functions.length === 0 && actions.length === 0) {
    vscodeInstance.window.showInformationMessage('No functions or actions found in Cloud Explorer.');
    return;
  }

  const wsRoot = getWorkspaceRoot(vscodeInstance);
  const items = [];

  for (const fn of functions) {
    const varName = extractStringValue(fn.variableName || fn.name, 'function');
    const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
    const commerceMetadata = isCommerce ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument } : null;
    const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName, commerceMetadata, vscodeInstance);
    const returnType = extractStringValue(fn.returnType, '');
    const folderName = fn.folderName || fn.namespace || (isCommerce ? fn.commerceDocument || 'transaction' : 'Global');
    const envType = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util';

    const icon = localPath ? '$(check)' : '$(cloud)';
    const label = `${icon} ${varName}`;
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

  for (const act of actions) {
    const varName = extractStringValue(act.variableName || act.name, 'action');
    const actionType = extractStringValue(act.actionType || act.type || 'Action');
    const doc = act.commerceDocument || 'transaction';
    const proc = act.commerceProcess || 'oraclecpqo';

    items.push({
      label: `$(zap) ${varName}`,
      description: `[Action: ${proc}/${doc}] [${actionType}]`,
      detail: act.description || `Commerce Action for ${doc} (click to view definition)`,
      data: act,
      itemType: 'action'
    });
  }

  const currentFilter = treeDataProvider.getFilter ? treeDataProvider.getFilter() : '';
  const filterPromptItem = {
    label: currentFilter ? `$(clear-all) Clear Active Filter ("${currentFilter}")` : '$(filter) Filter Cloud Explorer Tree View...',
    description: currentFilter ? 'Reset tree view to show all functions & actions' : 'Filter the sidebar tree by keyword',
    action: currentFilter ? 'clearFilter' : 'filterTree'
  };
  items.unshift(filterPromptItem);

  const selected = await vscodeInstance.window.showQuickPick(items, {
    placeHolder: 'Search Cloud Explorer functions and actions...',
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
  }
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
    clearFilterCmd
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
  openCommerceActionCommand,
  switchCommerceProcessCommand,
  filterExplorerCommand,
  clearFilterCommand,
  searchExplorerCommand,
  registerCloudExplorer
};
