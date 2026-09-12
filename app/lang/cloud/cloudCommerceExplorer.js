const { vscode, safeParseJson, extractStringValue, formatNameAndVarName } = require('./cloudVscodeShim');
const api = require('@/lang/rest/api');
const { getSettings, isConfigured } = require('@/lang/rest/config');
const { fetchCommerceFunctions } = require('./cloudExplorerFetch');
const { pullFunctionCommand, diffFunctionCommand, openCommerceActionCommand, switchCommerceProcessCommand } = require('./cloudExplorerCommands');
const { findLocalFunctionFile } = require('./cloudExplorerFiles');

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

  function matchesItem(item, query) {
    if (!item) return false;
    const q = query.toLowerCase();
    const varName = extractStringValue(item.variableName || item.name || item.ruleName, '').toLowerCase();
    const label = extractStringValue(item.label || item.name, '').toLowerCase();
    const type = extractStringValue(item.actionType || item.ruleType || item.dataType || item.type || item.returnType, '').toLowerCase();
    const desc = extractStringValue(item.description, '').toLowerCase();

    return varName.includes(q) || label.includes(q) || type.includes(q) || desc.includes(q);
  }

  async function fetchCommerceData() {
    if (!isConfigured(vscodeInstance)) {
      return null;
    }

    const settings = getSettings(vscodeInstance);
    const process = settings.commerceProcess || 'oraclecpqo';
    cachedProcess = process;

    const parseItems = (settled) => {
      if (settled.status !== 'fulfilled' || !settled.value) return [];
      const val = settled.value;
      if (Array.isArray(val)) return val;
      const body = safeParseJson(val.body !== undefined ? val.body : val);
      return Array.isArray(body) ? body : ((body && body.items) || []);
    };

    let docList = ['transaction', 'transactionLine'];
    try {
      if (typeof api.listCommerceDocuments === 'function') {
        const docRes = await api.listCommerceDocuments(context, vscodeInstance, { process, limit: 50 });
        const docItems = (docRes && docRes.body && docRes.body.items) || (Array.isArray(docRes?.body) ? docRes.body : []);
        if (docItems && docItems.length > 0) {
          const names = docItems.map(d => d.variableName || d.name).filter(Boolean);
          if (names.length > 0) {
            docList = names;
          }
        }
      }
    } catch {}

    const calls = [];
    for (const d of docList) {
      calls.push(api.listCommerceActions(context, vscodeInstance, { process, document: d, limit: 500 }));
      calls.push(api.listCommerceAttributes(context, vscodeInstance, { process, document: d, limit: 1000 }));
      if (d === 'transaction') {
        calls.push(api.listLibraryFunctions(context, vscodeInstance, { limit: 1000 }, undefined, { commerceProcess: process, commerceDocument: 'transaction' }));
      }
    }

    const results = await Promise.allSettled(calls);
    const data = {
      process,
      documentList: docList
    };

    let idx = 0;
    for (const d of docList) {
      const actionsRes = results[idx++];
      const attrsRes = results[idx++];
      let libsRes = null;
      if (d === 'transaction') {
        libsRes = results[idx++];
      }

      data[d] = {
        actions: parseItems(actionsRes),
        attributes: parseItems(attrsRes)
      };

      if (d === 'transaction') {
        data[d].libraries = parseItems(libsRes).map(fn => ({
          ...fn,
          isCommerce: true,
          commerceProcess: process,
          commerceDocument: 'transaction'
        }));
      }
    }

    cachedData = data;
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
      const displayLabel = formatNameAndVarName(name, varName);
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `(${dataType})`;
      item.tooltip = `${name} (${varName}) [${dataType}]\n${attr.description || ''}\nClick to insert variable name at cursor (or copy to clipboard)`;
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.contextValue = 'cpqCommerceAttribute';
      item.command = {
        command: 'cpqBml.cloud.insertOrCopyAttribute',
        title: 'Insert Variable Name at Cursor',
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
    if (!isConfigured(vscodeInstance)) {
      return [{
        type: 'empty',
        label: 'CPQ credentials are not configured'
      }];
    }

    if (!element) {
      if (!cachedData && !isLoading) {
        isLoading = true;
        try {
          await fetchCommerceData();
        } finally {
          isLoading = false;
        }
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
      return nodes;
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

  context.subscriptions.push(treeView, refreshCmd, switchProcCmd, filterCmd, clearFilterCmd, searchCmd);
  return { treeDataProvider, treeView };
}

module.exports = {
  createCommerceExplorer,
  registerCommerceExplorer
};

