const { vscode, safeParseJson, extractStringValue, formatNameAndVarName } = require('@/lang/cloud/cloudVscodeShim');
const api = require('@/lang/rest/api');
const { getSettings, isConfigured, getWorkspaceRoot } = require('@/lang/rest/config');
const { fetchCommerceFunctions } = require('@/lang/cloud/cloudExplorerFetch');
const { pullFunctionCommand, diffFunctionCommand, openCommerceActionCommand, switchCommerceProcessCommand } = require('@/lang/cloud/cloudExplorerCommands');
const { findLocalFunctionFile } = require('@/lang/cloud/cloudExplorerFiles');
const { inspectItemAccordingToPreference } = require('@/lang/cloud/cloudInspectorPanel');
const { fetchCommerceData: fetchRemoteData, inspectIntegrationCommand, matchesItem, fetchAttributeMenuItems } = require('@/lang/cloud/cloudCommerceData');

/**
 * Pure Factory: Creates the Commerce Explorer TreeDataProvider.
 */
function createCommerceExplorer(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedProcess = null;
  let cachedData = null;
  let isLoading = false;
  let filterQuery = '';

  function setFilter(query) {
    filterQuery = typeof query === 'string' ? query.trim() : '';
    if (vscodeInstance?.commands?.executeCommand) {
      vscodeInstance.commands.executeCommand('setContext', 'cpqBml.commerceExplorerFiltered', Boolean(filterQuery));
    }
    onDidChangeTreeDataEmitter.fire();
  }

  function getFilter() {
    return filterQuery;
  }

  function clearFilter() {
    setFilter('');
  }

  async function fetchCommerceData() {
    const data = await fetchRemoteData(vscodeInstance, context);
    if (data) {
      cachedProcess = data.process;
      cachedData = data;
    }
    return data;
  }

  function getTreeItem(element) {
    if (element.type === 'filterInfo') {
      const item = new vscodeInstance.TreeItem(
        `Filter: "${element.query}" (${element.totalMatches} match${element.totalMatches === 1 ? '' : 'es'})`,
        vscodeInstance.TreeItemCollapsibleState.None
      );
      item.description = 'Click to clear';
      item.tooltip = `Active search filter: "${element.query}"\nFound ${element.totalMatches} matching item(s)\nClick to clear filter`;
      item.iconPath = new vscodeInstance.ThemeIcon('filter');
      item.contextValue = 'cpqCommerceFilterInfo';
      item.command = {
        command: 'cpqBml.commerce.clearFilter',
        title: 'Clear Commerce Filter'
      };
      return item;
    }

    if (element.type === 'processHeader') {
      const item = new vscodeInstance.TreeItem(
        `Process: ${element.process}`,
        vscodeInstance.TreeItemCollapsibleState.None
      );
      item.description = '(Click to switch)';
      item.tooltip = `Active Commerce Process: ${element.process}\nClick to switch to a different process`;
      item.iconPath = new vscodeInstance.ThemeIcon('arrow-swap');
      item.command = {
        command: 'cpqBml.commerce.switchProcess',
        title: 'Switch Active Commerce Process'
      };
      item.contextValue = 'cpqCommerceProcessHeader';
      return item;
    }

    if (element.type === 'document') {
      const label = element.docName === 'transaction'
        ? 'Transaction'
        : 'Transaction Line';
      const item = new vscodeInstance.TreeItem(
        label,
        vscodeInstance.TreeItemCollapsibleState.Expanded
      );
      item.iconPath = new vscodeInstance.ThemeIcon(element.docName === 'transaction' ? 'file-text' : 'list-unordered');
      item.tooltip = `Commerce Document: ${element.docName}`;
      item.contextValue = 'cpqCommerceDocument';
      return item;
    }

    if (element.type === 'section') {
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        `${element.label} (${element.count})`,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.iconPath = new vscodeInstance.ThemeIcon(element.icon);
      item.tooltip = `${element.label} for ${element.docName}`;
      item.contextValue = `cpqCommerceSection_${element.section}`;
      return item;
    }

    if (element.type === 'action') {
      const act = element.data;
      const varName = extractStringValue(act.variableName || act.name, 'action');
      const name = extractStringValue(act.label || act.name || varName, varName);
      const actionType = extractStringValue(act.actionType || act.type || 'Action');
      const displayLabel = formatNameAndVarName(name, varName);
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `[${actionType}]`;
      item.tooltip = `${name} (${varName}) [${actionType}]\n${act.description || ''}\nClick to view action definition`;
      item.iconPath = new vscodeInstance.ThemeIcon('zap');
      item.contextValue = 'cpqCommerceAction';
      item.command = {
        command: 'cpqBml.cloud.openCommerceAction',
        title: 'View Action Definition',
        arguments: [{ data: { ...act, commerceProcess: element.process, commerceDocument: element.docName } }]
      };
      return item;
    }

    if (element.type === 'library') {
      const fn = element.data;
      const varName = extractStringValue(fn.variableName || fn.name, 'function');
      const name = extractStringValue(fn.name || varName, varName);
      const displayLabel = formatNameAndVarName(name, varName);
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      const ret = extractStringValue(fn.returnType, '');
      item.description = ret ? `-> ${ret}` : '';
      item.tooltip = `${name} (${varName})${ret ? ' -> ' + ret : ''}\n${fn.description || ''}\nClick to pull and open function`;
      item.iconPath = new vscodeInstance.ThemeIcon('cloud-download');
      item.contextValue = 'cpqCommerceLibrary';
      item.command = {
        command: 'cpqBml.cloud.pullFunction',
        title: 'Download and Open Function',
        arguments: [{ data: { ...fn, isCommerce: true, commerceProcess: element.process, commerceDocument: 'transaction' } }]
      };
      return item;
    }


    if (element.type === 'attribute') {
      const attr = element.data;
      const varName = extractStringValue(attr.variableName || attr.name, 'attribute');
      const name = extractStringValue(attr.label || attr.name || varName, varName);
      const dataType = extractStringValue(attr.dataType || attr.type, 'String');
      const isMenu = dataType.toLowerCase().includes('menu') || dataType.toLowerCase().includes('select');
      const menuOpts = (Array.isArray(attr.menuOptions) && attr.menuOptions.length > 0)
        ? attr.menuOptions
        : (Array.isArray(attr.menuItems) && attr.menuItems.length > 0)
          ? attr.menuItems
          : (Array.isArray(attr.values) && attr.values.length > 0)
            ? attr.values
            : null;
      const hasOptions = Array.isArray(menuOpts) && menuOpts.length > 0;

      const displayLabel = formatNameAndVarName(name, varName);
      const collapsibleState = (isMenu || hasOptions)
        ? vscodeInstance.TreeItemCollapsibleState.Collapsed
        : vscodeInstance.TreeItemCollapsibleState.None;

      const item = new vscodeInstance.TreeItem(displayLabel, collapsibleState);
      item.description = `(${dataType})`;

      let optionsSummary = '';
      if (hasOptions) {
        const preview = menuOpts.slice(0, 8).map(o => {
          if (typeof o === 'object' && o !== null) {
            return o.displayValue || o.label || o.name || o.value || o.id;
          }
          return String(o);
        }).join(', ');
        optionsSummary = `\n\nMenu Options (${menuOpts.length}):\n${preview}${menuOpts.length > 8 ? '...' : ''}`;
      }

      item.tooltip = `${name} (${varName}) [${dataType}]\n${attr.description || ''}${optionsSummary}\nClick to insert variable name at cursor (or copy to clipboard)`;
      item.iconPath = new vscodeInstance.ThemeIcon(isMenu ? 'symbol-enum' : 'symbol-property');
      item.contextValue = isMenu ? 'cpqCommerceMenuAttribute' : 'cpqCommerceAttribute';
      item.command = {
        command: 'cpqBml.cloud.insertOrCopyAttribute',
        title: 'Insert Variable Name at Cursor',
        arguments: [element]
      };
      return item;
    }

    if (element.type === 'menuOption') {
      const opt = element.data;
      const val = typeof opt === 'object' && opt !== null
        ? (opt.value !== undefined ? opt.value : (opt.id !== undefined ? opt.id : opt.name || opt.label || ''))
        : String(opt);
      const label = typeof opt === 'object' && opt !== null
        ? (opt.displayValue || opt.label || opt.name || val)
        : String(opt);
      const display = label && val && String(label) !== String(val) ? `${label} (${val})` : String(val || label);
      const item = new vscodeInstance.TreeItem(display, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-enum-member');
      item.tooltip = `Menu Option: "${val}"\nClick to insert "${val}" into active BML editor at cursor`;
      item.contextValue = 'cpqCommerceMenuOption';
      item.command = {
        command: 'cpqBml.cloud.insertOrCopyAttribute',
        title: 'Insert Option Value',
        arguments: [{ data: { variableName: `"${val}"` } }]
      };
      return item;
    }

    if (element.type === 'processIntegrations') {
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        `Integrations (${element.count})`,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.iconPath = new vscodeInstance.ThemeIcon('plug');
      item.tooltip = `Commerce Process Integrations for ${element.process} (e.g. Salesforce, Oracle Engagement Cloud, Custom BML/REST)`;
      item.contextValue = 'cpqCommerceSection_integrations';
      return item;
    }

    if (element.type === 'integration') {
      const itg = element.data;
      const varName = extractStringValue(itg.variableName || itg.name, 'integration');
      const name = extractStringValue(itg.name || itg.label || varName, varName);
      const intType = extractStringValue(itg.integrationType || itg.type || 'Integration');
      const displayLabel = formatNameAndVarName(name, varName);
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `[${intType}]`;
      item.tooltip = `${name} (${varName}) [${intType}]\n${itg.description || ''}\n${itg.endpointUrl ? 'Endpoint: ' + itg.endpointUrl + '\n' : ''}Click to inspect integration definition`;
      item.iconPath = new vscodeInstance.ThemeIcon('plug');
      item.contextValue = 'cpqCommerceIntegration';
      item.command = {
        command: 'cpqBml.cloud.inspectIntegration',
        title: 'Inspect Integration',
        arguments: [element]
      };
      return item;
    }

    if (element.type === 'empty') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('info');
      return item;
    }

    return new vscodeInstance.TreeItem('Unknown', vscodeInstance.TreeItemCollapsibleState.None);
  }

  async function getChildren(element) {
    if (!element) {
      if (!cachedData && !isLoading) {
        isLoading = true;
        try {
          await fetchCommerceData();
        } finally {
          isLoading = false;
        }
      }

      if (!cachedData) {
        if (!isConfigured(vscodeInstance)) {
          return [{
            type: 'empty',
            label: 'CPQ credentials are not configured'
          }];
        }
        return [{
          type: 'empty',
          label: 'No commerce data loaded'
        }];
      }

      const proc = cachedProcess || getSettings(vscodeInstance).commerceProcess || 'oraclecpqo';
      const nodes = [];

      if (filterQuery && cachedData) {
        let matchCount = 0;
        const allItems = [];
        const docNames = (cachedData.documentList && cachedData.documentList.length > 0)
          ? cachedData.documentList
          : ['transaction', 'transactionLine'];
        for (const d of docNames) {
          const docObj = cachedData[d];
          if (docObj) {
            if (docObj.actions) allItems.push(...docObj.actions);
            if (docObj.libraries) allItems.push(...docObj.libraries);
            if (docObj.attributes) allItems.push(...docObj.attributes);
          }
        }
        if (cachedData.integrations) {
          allItems.push(...cachedData.integrations);
        }
        matchCount = allItems.filter(it => matchesItem(it, filterQuery)).length;
        nodes.push({ type: 'filterInfo', query: filterQuery, totalMatches: matchCount });
      }

      const docNames = (cachedData?.documentList && cachedData.documentList.length > 0)
        ? cachedData.documentList
        : ['transaction', 'transactionLine'];

      nodes.push({ type: 'processHeader', process: proc });
      for (const d of docNames) {
        nodes.push({ type: 'document', docName: d, process: proc });
      }

      // Add Integrations section at Commerce Process level
      const allIntegrations = cachedData?.integrations || [];
      const filteredIntegrations = filterQuery
        ? allIntegrations.filter(it => matchesItem(it, filterQuery))
        : allIntegrations;
      if (filteredIntegrations.length > 0) {
        nodes.push({
          type: 'processIntegrations',
          process: proc,
          count: filteredIntegrations.length,
          items: filteredIntegrations
        });
      }
      return nodes;
    }

    if (element.type === 'processIntegrations') {
      const items = element.items || [];
      if (items.length === 0) {
        return [{
          type: 'empty',
          label: filterQuery ? 'No matching integrations' : 'No integrations configured for this process'
        }];
      }
      return items.map(itg => ({
        type: 'integration',
        data: itg,
        process: element.process
      }));
    }

    if (element.type === 'document') {
      const doc = element.docName;
      const docData = cachedData ? cachedData[doc] : null;

      const filterList = (arr) => {
        if (!filterQuery) return arr || [];
        return (arr || []).filter(it => matchesItem(it, filterQuery));
      };

      const filteredActions = filterList(docData?.actions);
      const filteredAttrs = filterList(docData?.attributes);

      if (doc === 'transaction') {
        const filteredLibs = filterList(docData?.libraries);
        const sections = [
          { type: 'section', section: 'actions', label: 'Actions', icon: 'zap', count: filteredActions.length, docName: doc, process: element.process, items: filteredActions },
          { type: 'section', section: 'libraries', label: 'Libraries', icon: 'library', count: filteredLibs.length, docName: doc, process: element.process, items: filteredLibs },
          { type: 'section', section: 'attributes', label: 'Attributes', icon: 'symbol-property', count: filteredAttrs.length, docName: doc, process: element.process, items: filteredAttrs }
        ];
        return filterQuery ? sections.filter(s => s.count > 0) : sections;
      }

      const sections = [
        { type: 'section', section: 'actions', label: 'Actions', icon: 'zap', count: filteredActions.length, docName: doc, process: element.process, items: filteredActions },
        { type: 'section', section: 'attributes', label: 'Attributes', icon: 'symbol-property', count: filteredAttrs.length, docName: doc, process: element.process, items: filteredAttrs }
      ];
      return filterQuery ? sections.filter(s => s.count > 0) : sections;
    }

    if (element.type === 'section') {
      const items = element.items || [];
      if (items.length === 0) {
        return [{
          type: 'empty',
          label: filterQuery ? `No matching ${element.label.toLowerCase()}` : `No ${element.label.toLowerCase()} found`
        }];
      }

      if (element.section === 'actions') {
        return items.map(act => ({ type: 'action', data: act, docName: element.docName, process: element.process }));
      }
      if (element.section === 'libraries') {
        return items.map(lib => ({ type: 'library', data: lib, docName: element.docName, process: element.process }));
      }
      if (element.section === 'attributes') {
        return items.map(attr => ({ type: 'attribute', data: attr, docName: element.docName, process: element.process }));
      }
    }

    if (element.type === 'attribute') {
      const attr = element.data;
      let menuOpts = (Array.isArray(attr.menuOptions) && attr.menuOptions.length > 0)
        ? attr.menuOptions
        : (Array.isArray(attr.menuItems) && attr.menuItems.length > 0)
          ? attr.menuItems
          : (Array.isArray(attr.values) && attr.values.length > 0)
            ? attr.values
            : null;

      if (!menuOpts || menuOpts.length === 0) {
        const items = await fetchAttributeMenuItems(attr, element, vscodeInstance, context);
        if (items) menuOpts = items;
      }

      if (Array.isArray(menuOpts) && menuOpts.length > 0) {
        return menuOpts.map(opt => ({
          type: 'menuOption',
          data: opt,
          attrName: attr.variableName || attr.name,
          process: element.process,
          docName: element.docName
        }));
      }
      return [];
    }

    return [];
  }

  function refresh() {
    cachedData = null;
    cachedProcess = null;
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
    fetchCommerceData,
    getCachedData: () => cachedData
  };
}

function registerCommerceExplorer(context, vscodeInstance = vscode) {
  const treeDataProvider = createCommerceExplorer(vscodeInstance, context);
  const treeView = vscodeInstance.window.registerTreeDataProvider('cpqBml.commerceExplorer', treeDataProvider);

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.refresh', () => {
    treeDataProvider.refresh();
  });

  const switchProcCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.switchProcess', async () => {
    await switchCommerceProcessCommand(vscodeInstance, context);
    treeDataProvider.refresh();
  });

  const filterCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.filterExplorer', async () => {
    const current = treeDataProvider.getFilter();
    const query = await vscodeInstance.window.showInputBox({
      prompt: 'Filter Commerce Explorer (actions, rules, attributes, libraries)',
      placeHolder: 'e.g. cleanSave, pricingRule, transactionID...',
      value: current,
      ignoreFocusOut: true
    });
    if (query !== undefined) {
      treeDataProvider.setFilter(query);
    }
  });

  const clearFilterCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.clearFilter', () => {
    treeDataProvider.clearFilter();
  });

  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.searchExplorer', () => {
    return vscodeInstance.commands.executeCommand('cpqBml.cloud.searchExplorer');
  });

  const inspectIntegrationCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.inspectIntegration', (item) => {
    return inspectIntegrationCommand(item, vscodeInstance, context);
  });

  context.subscriptions.push(treeView, refreshCmd, switchProcCmd, filterCmd, clearFilterCmd, searchCmd, inspectIntegrationCmd);
  return { treeDataProvider, treeView };
}

module.exports = {
  createCommerceExplorer,
  registerCommerceExplorer,
  inspectIntegrationCommand
};

