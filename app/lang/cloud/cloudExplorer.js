const { vscode } = require('./cloudVscodeShim');
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
    if (element.type === 'category') {
      const item = new vscodeInstance.TreeItem(
        `${element.label} (${element.count})`,
        vscodeInstance.TreeItemCollapsibleState.Collapsed
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
      const item = new vscodeInstance.TreeItem(
        `${element.folderName} (${element.count})`,
        vscodeInstance.TreeItemCollapsibleState.Collapsed
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
      const docLabel = element.docName === 'transaction'
        ? 'Transaction (Header)'
        : (element.docName === 'transactionLine' ? 'Transaction Line (Sub-document)' : element.docName);
      const item = new vscodeInstance.TreeItem(
        `${docLabel} (${element.count})`,
        vscodeInstance.TreeItemCollapsibleState.Expanded
      );
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-event');
      item.tooltip = `Commerce Actions for document '${element.docName}'`;
      return item;
    }

    if (element.type === 'action') {
      const action = element.data;
      const varName = action.variableName || action.name;
      const label = action.label || action.name || varName;
      const item = new vscodeInstance.TreeItem(label, vscodeInstance.TreeItemCollapsibleState.None);

      const actionType = action.type || action.actionType || 'Action';
      item.description = `[${actionType}] ${varName}`;
      item.tooltip = [
        `Commerce Action: ${label}`,
        `Variable Name: ${varName}`,
        `Action Type: ${actionType}`,
        action.description ? `Description: ${action.description}` : null,
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
    const varName = fn.variableName || fn.name;
    const wsRoot = getRoot();
    const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
    const commerceMetadata = isCommerce
      ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument }
      : null;
    const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName, commerceMetadata, vscodeInstance);

    const label = fn.name || varName;
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

    if (fn.returnType) {
      badges.push(`-> ${fn.returnType}`);
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
        `Return: ${fn.returnType || 'void'}`,
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
        if (!cachedCommerceActions || cachedCommerceActions.length === 0) {
          return [{
            type: 'empty',
            label: 'No commerce document actions found (Click to switch process)',
            command: {
              command: 'cpqBml.cloud.switchCommerceProcess',
              title: 'Switch Commerce Process'
            }
          }];
        }

        const docGroups = new Map();
        for (const action of cachedCommerceActions) {
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

        return cachedCommerceActions.map(action => ({
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
    getCachedFunctions: () => (cachedUtilFunctions || []).concat(cachedCommerceFunctions || []),
    getCachedGroups: () => ({ util: cachedUtilGroups, commerce: cachedCommerceGroups })
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

  context.subscriptions.push(treeView, refreshCmd, pullCmd, diffCmd, openLocalCmd, openActionCmd, switchProcCmd);

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
  registerCloudExplorer
};
