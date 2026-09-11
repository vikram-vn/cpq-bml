const { vscode, safeParseJson, extractStringValue } = require('./cloudVscodeShim');
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

  async function fetchCommerceData() {
    if (!isConfigured(vscodeInstance)) {
      return null;
    }

    const settings = getSettings(vscodeInstance);
    const process = settings.commerceProcess || 'oraclecpqo';
    cachedProcess = process;

    const [
      txActionsRes,
      txRulesRes,
      txAttrsRes,
      txLibsRes,
      lineActionsRes,
      lineRulesRes,
      lineAttrsRes
    ] = await Promise.allSettled([
      api.listCommerceActions(context, vscodeInstance, { process, document: 'transaction', limit: 500 }),
      api.listCommerceRules(context, vscodeInstance, { process, document: 'transaction', limit: 500 }),
      api.listCommerceAttributes(context, vscodeInstance, { process, document: 'transaction', limit: 1000 }),
      api.listLibraryFunctions(context, vscodeInstance, { limit: 1000 }, undefined, { commerceProcess: process, commerceDocument: 'transaction' }),
      api.listCommerceActions(context, vscodeInstance, { process, document: 'transactionLine', limit: 500 }),
      api.listCommerceRules(context, vscodeInstance, { process, document: 'transactionLine', limit: 500 }),
      api.listCommerceAttributes(context, vscodeInstance, { process, document: 'transactionLine', limit: 1000 })
    ]);

    const parseItems = (settled) => {
      if (settled.status !== 'fulfilled' || !settled.value) return [];
      const val = settled.value;
      if (Array.isArray(val)) return val;
      const body = safeParseJson(val.body);
      return Array.isArray(body) ? body : ((body && body.items) || []);
    };

    const data = {
      process,
      transaction: {
        actions: parseItems(txActionsRes),
        rules: parseItems(txRulesRes),
        attributes: parseItems(txAttrsRes),
        libraries: parseItems(txLibsRes).map(fn => ({
          ...fn,
          isCommerce: true,
          commerceProcess: process,
          commerceDocument: 'transaction'
        }))
      },
      transactionLine: {
        actions: parseItems(lineActionsRes),
        rules: parseItems(lineRulesRes),
        attributes: parseItems(lineAttrsRes)
      }
    };

    cachedData = data;
    return data;
  }

  function getTreeItem(element) {
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
      const item = new vscodeInstance.TreeItem(
        `${element.label} (${element.count})`,
        vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.iconPath = new vscodeInstance.ThemeIcon(element.icon);
      item.tooltip = `${element.label} for ${element.docName}`;
      item.contextValue = `cpqCommerceSection_${element.section}`;
      return item;
    }

    if (element.type === 'action') {
      const act = element.data;
      const varName = extractStringValue(act.variableName || act.name, 'action');
      const actionType = extractStringValue(act.actionType || act.type || 'Action');
      const item = new vscodeInstance.TreeItem(varName, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `[${actionType}]`;
      item.tooltip = `${act.label || varName} (${actionType})\n${act.description || ''}\nClick to view action definition`;
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
      const item = new vscodeInstance.TreeItem(varName, vscodeInstance.TreeItemCollapsibleState.None);
      const ret = extractStringValue(fn.returnType, '');
      item.description = ret ? `-> ${ret}` : '';
      item.tooltip = `${fn.name || varName}${ret ? ' -> ' + ret : ''}\n${fn.description || ''}\nClick to pull and open function`;
      item.iconPath = new vscodeInstance.ThemeIcon('cloud-download');
      item.contextValue = 'cpqCommerceLibrary';
      item.command = {
        command: 'cpqBml.cloud.pullFunction',
        title: 'Download and Open Function',
        arguments: [{ data: { ...fn, isCommerce: true, commerceProcess: element.process, commerceDocument: 'transaction' } }]
      };
      return item;
    }

    if (element.type === 'rule') {
      const r = element.data;
      const name = extractStringValue(r.name || r.variableName || r.ruleName, 'Rule');
      const ruleType = extractStringValue(r.ruleType || r.type || 'Rule');
      const item = new vscodeInstance.TreeItem(name, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `[${ruleType}]`;
      item.tooltip = `${name} (${ruleType})\n${r.description || ''}`;
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.contextValue = 'cpqCommerceRule';
      return item;
    }

    if (element.type === 'attribute') {
      const attr = element.data;
      const varName = extractStringValue(attr.variableName || attr.name, 'attribute');
      const dataType = extractStringValue(attr.dataType || attr.type, 'String');
      const item = new vscodeInstance.TreeItem(varName, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `(${dataType})`;
      item.tooltip = `${attr.label || varName} [${dataType}]\n${attr.description || ''}`;
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.contextValue = 'cpqCommerceAttribute';
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

      return [
        { type: 'processHeader', process: proc },
        { type: 'document', docName: 'transaction', process: proc },
        { type: 'document', docName: 'transactionLine', process: proc }
      ];
    }

    if (element.type === 'document') {
      const doc = element.docName;
      const docData = cachedData ? cachedData[doc] : null;

      if (doc === 'transaction') {
        const actionsCount = docData?.actions?.length || 0;
        const libsCount = docData?.libraries?.length || 0;
        const rulesCount = docData?.rules?.length || 0;
        const attrsCount = docData?.attributes?.length || 0;

        return [
          { type: 'section', section: 'actions', label: 'Actions', icon: 'zap', count: actionsCount, docName: doc, process: element.process, items: docData?.actions || [] },
          { type: 'section', section: 'libraries', label: 'Libraries', icon: 'library', count: libsCount, docName: doc, process: element.process, items: docData?.libraries || [] },
          { type: 'section', section: 'rules', label: 'Rules', icon: 'law', count: rulesCount, docName: doc, process: element.process, items: docData?.rules || [] },
          { type: 'section', section: 'attributes', label: 'Attributes', icon: 'symbol-property', count: attrsCount, docName: doc, process: element.process, items: docData?.attributes || [] }
        ];
      }

      if (doc === 'transactionLine') {
        const actionsCount = docData?.actions?.length || 0;
        const rulesCount = docData?.rules?.length || 0;
        const attrsCount = docData?.attributes?.length || 0;

        // Transaction Line does NOT contain libraries!
        return [
          { type: 'section', section: 'actions', label: 'Actions', icon: 'zap', count: actionsCount, docName: doc, process: element.process, items: docData?.actions || [] },
          { type: 'section', section: 'rules', label: 'Rules', icon: 'law', count: rulesCount, docName: doc, process: element.process, items: docData?.rules || [] },
          { type: 'section', section: 'attributes', label: 'Attributes', icon: 'symbol-property', count: attrsCount, docName: doc, process: element.process, items: docData?.attributes || [] }
        ];
      }
    }

    if (element.type === 'section') {
      const items = element.items || [];
      if (items.length === 0) {
        return [{
          type: 'empty',
          label: `No ${element.label.toLowerCase()} found`
        }];
      }

      if (element.section === 'actions') {
        return items.map(act => ({ type: 'action', data: act, docName: element.docName, process: element.process }));
      }
      if (element.section === 'libraries') {
        return items.map(lib => ({ type: 'library', data: lib, docName: element.docName, process: element.process }));
      }
      if (element.section === 'rules') {
        return items.map(r => ({ type: 'rule', data: r, docName: element.docName, process: element.process }));
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

  context.subscriptions.push(treeView, refreshCmd, switchProcCmd);
  return { treeDataProvider, treeView };
}

module.exports = {
  createCommerceExplorer,
  registerCommerceExplorer
};
