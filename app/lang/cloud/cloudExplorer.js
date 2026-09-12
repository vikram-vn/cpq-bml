const { vscode, extractStringValue, formatNameAndVarName } = require('./cloudVscodeShim');
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
      const displayLabel = formatNameAndVarName(label, varName);
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);

      const actionType =
        extractStringValue(action.actionType) ||
        extractStringValue(action.type) ||
        'Action';
      item.description = `[${actionType}]`;
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

    const name = extractStringValue(fn.name || varName, varName);
    const displayLabel = formatNameAndVarName(name, varName);
    const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);

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

    let isLocallyModified = false;
    if (localPath) {
      try {
        const localStat = fs.statSync(localPath);
        const metaPath = localPath.replace(/\.bml$/, '-meta.json');
        if (fs.existsSync(metaPath)) {
          const metaStat = fs.statSync(metaPath);
          if (localStat.mtimeMs > metaStat.mtimeMs + 1000) {
            isLocallyModified = true;
          }
        }
      } catch {}
    }

    if (localPath) {
      if (isLocallyModified) {
        badges.push('● Modified');
      } else {
        badges.push('✓ Synced');
      }
    } else {
      badges.push('☁ Cloud');
    }

    const returnType = extractStringValue(fn.returnType, '');
    if (returnType) {
      badges.push(`-> ${returnType}`);
    }

    item.description = badges.join(' ');
    item.contextValue = localPath
      ? (isLocallyModified ? 'cpqCloudFunctionModified' : 'cpqCloudFunctionSynced')
      : 'cpqCloudFunctionRemote';

    const deployStatusText = isStaged ? 'Staging (Pending Deployment)' : (isDeployed ? 'Deployed' : 'Unknown');
    const funcTypeText = fn.isOverridden
      ? 'Standard Function (Overridden)'
      : (fn.isStandardFunction ? 'Standard Function' : 'Custom Library Function');

    if (localPath) {
      const procDoc = isCommerce ? `Commerce: ${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}` : 'Util Library';
      item.tooltip = [
        `${varName} [${deployStatusText}]`,
        `Status: ${isLocallyModified ? 'Modified locally (pending deploy)' : 'In-sync with Cloud'}`,
        `Type: ${funcTypeText}`,
        `Environment: ${procDoc}`,
        `Local File: ${path.basename(localPath)}`,
        `Folder: ${fn.folderName || 'Global'}`,
        `Return: ${returnType || 'void'}`,
        '---',
        'Click to open local file in editor'
      ].join('\n');

      if (isLocallyModified) {
        item.iconPath = new vscodeInstance.ThemeIcon('diff-modified', new vscodeInstance.ThemeColor('gitDecoration.modifiedResourceForeground'));
      } else if (isStaged) {
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
 * Interactive QuickPick search across all Cloud Explorer sections (Functions, Actions, Rules, Attributes, Data Tables).
 */
async function searchExplorerCommand(treeDataProvider, vscodeInstance = vscode, context) {
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

  // 3. Search other sections if CPQ is configured
  if (isConfigured(vscodeInstance)) {
    const settings = getSettings(vscodeInstance);
    const proc = settings.commerceProcess || 'oraclecpqo';

    try {
      const [txActionsRes, txAttrsRes, dataTablesRes, configFamiliesRes, configAttrsRes] = await Promise.allSettled([
        api.listCommerceActions(context, vscodeInstance, { process: proc, document: 'transaction', limit: 100 }),
        api.listCommerceAttributes(context, vscodeInstance, { process: proc, document: 'transaction', limit: 100 }),
        api.listDataTables(context, vscodeInstance, { limit: 100 }),
        api.listProductFamilies(context, vscodeInstance, { limit: 50 }),
        api.listConfigurationAttributes(context, vscodeInstance, { limit: 100 })
      ]);

      // Actions
      if (txActionsRes.status === 'fulfilled' && txActionsRes.value?.body) {
        const body = typeof txActionsRes.value.body === 'string' ? JSON.parse(txActionsRes.value.body) : txActionsRes.value.body;
        const actionItems = body.items || (Array.isArray(body) ? body : []);
        for (const act of actionItems) {
          const varName = extractStringValue(act.variableName || act.name, 'action');
          const name = extractStringValue(act.label || act.name || varName, varName);
          const displayLabel = formatNameAndVarName(name, varName);
          const actionType = extractStringValue(act.type?.displayValue || act.type || act.actionType, 'Action');
          items.push({
            label: `$(zap) ${displayLabel}`,
            description: `[Commerce Action: ${proc}/transaction] [${actionType}]`,
            detail: act.description || `Commerce Action: ${name}`,
            data: act,
            itemType: 'action'
          });
        }
      }

      // Attributes
      if (txAttrsRes.status === 'fulfilled' && txAttrsRes.value?.body) {
        const body = typeof txAttrsRes.value.body === 'string' ? JSON.parse(txAttrsRes.value.body) : txAttrsRes.value.body;
        const attrItems = body.items || (Array.isArray(body) ? body : []);
        for (const attr of attrItems) {
          const varName = extractStringValue(attr.variableName || attr.name, 'attr');
          const name = extractStringValue(attr.label || attr.name || varName, varName);
          const displayLabel = formatNameAndVarName(name, varName);
          const dataType = extractStringValue(attr.dataType || attr.type, 'String');
          items.push({
            label: `$(symbol-property) ${displayLabel}`,
            description: `[Commerce Attr: ${proc}/transaction] [${dataType}]`,
            detail: attr.description || `Commerce Attribute (${dataType})`,
            data: attr,
            itemType: 'attribute'
          });
        }
      }

      // Configuration Families
      if (configFamiliesRes.status === 'fulfilled' && configFamiliesRes.value?.body) {
        const body = typeof configFamiliesRes.value.body === 'string' ? JSON.parse(configFamiliesRes.value.body) : configFamiliesRes.value.body;
        const famItems = body.items || (Array.isArray(body) ? body : []);
        for (const fam of famItems) {
          const varName = extractStringValue(fam.variableName || fam.name, 'family');
          const name = extractStringValue(fam.label || fam.name || varName, varName);
          const displayLabel = formatNameAndVarName(name, varName);
          items.push({
            label: `$(package) ${displayLabel}`,
            description: '[Config Product Family]',
            detail: fam.description || `Product Family: ${name}`,
            data: fam,
            itemType: 'configFamily'
          });
        }
      }

      // Configuration Attributes
      if (configAttrsRes.status === 'fulfilled' && configAttrsRes.value?.body) {
        const body = typeof configAttrsRes.value.body === 'string' ? JSON.parse(configAttrsRes.value.body) : configAttrsRes.value.body;
        const cAttrItems = body.items || (Array.isArray(body) ? body : []);
        for (const attr of cAttrItems) {
          const varName = extractStringValue(attr.variableName || attr.name, 'attr');
          const name = extractStringValue(attr.label || attr.name || varName, varName);
          const displayLabel = formatNameAndVarName(name, varName);
          const dataType = extractStringValue(attr.dataType || attr.type, 'String');
          items.push({
            label: `$(symbol-property) ${displayLabel}`,
            description: `[Config Attr] [${dataType}]`,
            detail: attr.description || `Configuration Attribute (${dataType})`,
            data: attr,
            itemType: 'attribute'
          });
        }
      }

      // Data Tables
      if (dataTablesRes.status === 'fulfilled' && dataTablesRes.value?.body) {
        const body = typeof dataTablesRes.value.body === 'string' ? JSON.parse(dataTablesRes.value.body) : dataTablesRes.value.body;
        const dtItems = body.items || (Array.isArray(body) ? body : []);
        for (const dt of dtItems) {
          const tableName = extractStringValue(dt.name || dt.variableName, 'table');
          const label = extractStringValue(dt.label || dt.description || tableName, tableName);
          const displayLabel = formatNameAndVarName(label, tableName);
          items.push({
            label: `$(database) ${displayLabel}`,
            description: '[CPQ Data Table]',
            detail: dt.description || `Data Table: ${tableName} (click to query in BMQL)`,
            data: dt,
            itemType: 'dataTable'
          });
        }
      }
    } catch {
      // best effort auxiliary items
    }
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
