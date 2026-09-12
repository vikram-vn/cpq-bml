const { vscode, safeParseJson, extractStringValue, formatNameAndVarName } = require('./cloudVscodeShim');
const api = require('@/lang/rest/api');
const { isConfigured } = require('@/lang/rest/config');

/**
 * Pure Factory: Creates the Configuration Product Families Explorer TreeDataProvider.
 * Implements Swagger architecture for CPQ Configuration:
 * /allProductFamilySetups -> Product Families -> Attributes, Rules & Product Lines -> Models -> Attributes & Rules
 */
function createConfigExplorer(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedFamilies = null;
  let isLoading = false;
  let filterQuery = '';

  function setFilter(query) {
    filterQuery = typeof query === 'string' ? query.trim() : '';
    if (vscodeInstance?.commands?.executeCommand) {
      vscodeInstance.commands.executeCommand('setContext', 'cpqBml.configExplorerFiltered', Boolean(filterQuery));
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
    const type = extractStringValue(item.ruleType || item.dataType || item.type, '').toLowerCase();
    const desc = extractStringValue(item.description, '').toLowerCase();

    return varName.includes(q) || label.includes(q) || type.includes(q) || desc.includes(q);
  }

  async function fetchProductFamilies() {
    if (!isConfigured(vscodeInstance)) {
      return [];
    }

    try {
      const res = await api.listProductFamilies(context, vscodeInstance, { limit: 100 });
      if (res && res.statusCode >= 200 && res.statusCode < 300) {
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        cachedFamilies = items;
        return items;
      }
      return [];
    } catch (err) {
      console.warn('Failed to fetch product families:', err);
      return [];
    }
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
      item.contextValue = 'cpqConfigFilterInfo';
      item.command = {
        command: 'cpqBml.config.clearFilter',
        title: 'Clear Configuration Filter'
      };
      return item;
    }

    if (element.type === 'globalAttributesFolder') {
      const item = new vscodeInstance.TreeItem('Global Attributes', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.description = '_allProductFamilies';
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.tooltip = 'Global Configuration Attributes (_allProductFamilies)';
      item.contextValue = 'cpqConfigGlobalAttributes';
      return item;
    }

    if (element.type === 'productFamily') {
      const pf = element.data;
      const varName = extractStringValue(pf.variableName || pf.name, 'family');
      const label = extractStringValue(pf.label || pf.name, varName);
      const displayLabel = formatNameAndVarName(label, varName);
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        displayLabel,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.tooltip = `Product Family: ${label} (${varName})`;
      item.iconPath = new vscodeInstance.ThemeIcon('folder');
      item.contextValue = 'cpqConfigProductFamily';
      return item;
    }

    if (element.type === 'familyAttributesFolder') {
      const item = new vscodeInstance.TreeItem('Attributes', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.tooltip = `Attributes for Product Family ${element.productFamily}`;
      item.contextValue = 'cpqConfigFamilyAttributes';
      return item;
    }

    if (element.type === 'familyRulesFolder') {
      const item = new vscodeInstance.TreeItem('Rules', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.tooltip = `Configuration Rules for Product Family ${element.productFamily}`;
      item.contextValue = 'cpqConfigFamilyRules';
      return item;
    }

    if (element.type === 'productLinesFolder') {
      const item = new vscodeInstance.TreeItem('Product Lines', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('list-tree');
      item.tooltip = `Product Lines for Product Family ${element.productFamily}`;
      item.contextValue = 'cpqConfigProductLines';
      return item;
    }

    if (element.type === 'productLine') {
      const pl = element.data;
      const varName = extractStringValue(pl.variableName || pl.name, 'line');
      const label = extractStringValue(pl.label || pl.name, varName);
      const displayLabel = formatNameAndVarName(label, varName);
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        displayLabel,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.tooltip = `Product Line: ${label} (${varName})`;
      item.iconPath = new vscodeInstance.ThemeIcon('folder');
      item.contextValue = 'cpqConfigProductLine';
      return item;
    }

    if (element.type === 'lineAttributesFolder') {
      const item = new vscodeInstance.TreeItem('Attributes', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.tooltip = `Attributes for Product Line ${element.productLine}`;
      item.contextValue = 'cpqConfigLineAttributes';
      return item;
    }

    if (element.type === 'lineRulesFolder') {
      const item = new vscodeInstance.TreeItem('Rules', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.tooltip = `Configuration Rules for Product Line ${element.productLine}`;
      item.contextValue = 'cpqConfigLineRules';
      return item;
    }

    if (element.type === 'modelsFolder') {
      const item = new vscodeInstance.TreeItem('Models', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('package');
      item.tooltip = `Models for Product Line ${element.productLine}`;
      item.contextValue = 'cpqConfigModels';
      return item;
    }

    if (element.type === 'model') {
      const m = element.data;
      const varName = extractStringValue(m.variableName || m.name, 'model');
      const label = extractStringValue(m.label || m.name, varName);
      const displayLabel = formatNameAndVarName(label, varName);
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        displayLabel,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.tooltip = `Configuration Model: ${label} (${varName})`;
      item.iconPath = new vscodeInstance.ThemeIcon('package');
      item.contextValue = 'cpqConfigModel';
      return item;
    }

    if (element.type === 'modelAttributesFolder') {
      const item = new vscodeInstance.TreeItem('Attributes', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.tooltip = `Attributes for Model ${element.model}`;
      item.contextValue = 'cpqConfigModelAttributes';
      return item;
    }

    if (element.type === 'modelBomRulesFolder') {
      const item = new vscodeInstance.TreeItem('BOM Mapping Rules', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.tooltip = `BOM Mapping Rules for Model ${element.model}`;
      item.contextValue = 'cpqConfigModelBomRules';
      return item;
    }

    if (element.type === 'modelRulesFolder') {
      const item = new vscodeInstance.TreeItem('Rules', vscodeInstance.TreeItemCollapsibleState.Collapsed);
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.tooltip = `Configuration Rules for Model ${element.model}`;
      item.contextValue = 'cpqConfigModelRules';
      return item;
    }

    if (element.type === 'attribute') {
      const attr = element.data;
      const varName = extractStringValue(attr.variableName || attr.name, 'attr');
      const label = extractStringValue(attr.label || attr.name, varName);
      const displayLabel = formatNameAndVarName(label, varName);
      const dataType = extractStringValue(attr.dataType || attr.type, 'String');
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `(${dataType})`;
      item.tooltip = `${label} (${varName}) [${dataType}]\n${attr.description || ''}`;
      item.iconPath = new vscodeInstance.ThemeIcon('symbol-property');
      item.contextValue = 'cpqConfigAttribute';
      return item;
    }

    if (element.type === 'bomRule') {
      const r = element.data;
      const varName = extractStringValue(r.variableName || r.ruleId || r.name, 'bomRule');
      const label = extractStringValue(r.label || r.name, varName);
      const displayLabel = formatNameAndVarName(label, varName);
      const ruleType = extractStringValue(
        r.ruleType && r.ruleType.displayValue ? r.ruleType.displayValue : (r.ruleType || 'BOM Rule')
      );
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `[${ruleType}]`;
      const bomTarget = r.bomVariableName ? `\nTarget BOM: ${r.bomVariableName}` : '';
      item.tooltip = `${label} (${varName}) [${ruleType}]${bomTarget}\n${r.description || ''}`;
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.contextValue = 'cpqConfigBomRule';
      return item;
    }

    if (element.type === 'rule') {
      const r = element.data;
      const varName = extractStringValue(r.variableName || r.name, 'rule');
      const label = extractStringValue(r.name || r.label, varName);
      const displayLabel = formatNameAndVarName(label, varName);
      const ruleType = extractStringValue(r.ruleType || r.type || 'Rule');
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = `[${ruleType}]`;
      item.tooltip = `${label} (${varName}) [${ruleType}]\n${r.description || ''}`;
      item.iconPath = new vscodeInstance.ThemeIcon('law');
      item.contextValue = 'cpqConfigRule';
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

    // Root: List all Product Families and Global Attributes
    if (!element) {
      if (!cachedFamilies && !isLoading) {
        isLoading = true;
        try {
          await fetchProductFamilies();
        } finally {
          isLoading = false;
        }
      }

      if (!cachedFamilies || cachedFamilies.length === 0) {
        return [{
          type: 'empty',
          label: 'No product families found'
        }];
      }

      const items = [];

      if (filterQuery && cachedFamilies) {
        const matches = cachedFamilies.filter(f => matchesItem(f, filterQuery));
        items.push({
          type: 'filterInfo',
          query: filterQuery,
          totalMatches: matches.length
        });
      }

      items.push({
        type: 'globalAttributesFolder',
        allProductFamilies: '_allProductFamilies'
      });

      const displayFamilies = filterQuery
        ? cachedFamilies.filter(f => matchesItem(f, filterQuery))
        : cachedFamilies;

      for (const pf of displayFamilies) {
        items.push({
          type: 'productFamily',
          data: pf,
          familyVarName: pf.variableName || pf.name
        });
      }

      return items;
    }

    // Global Configuration Attributes (_allProductFamilies)
    if (element.type === 'globalAttributesFolder') {
      try {
        const res = await api.listConfigurationAttributes(context, vscodeInstance, { limit: 1000 });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No global attributes' }];
        }
        return items.map(attr => ({ type: 'attribute', data: attr }));
      } catch {
        return [{ type: 'empty', label: 'Failed to fetch global attributes' }];
      }
    }

    // Under Product Family: Attributes, Rules, Product Lines
    if (element.type === 'productFamily') {
      const fam = element.familyVarName;
      return [
        { type: 'familyAttributesFolder', productFamily: fam },
        { type: 'familyRulesFolder', productFamily: fam },
        { type: 'productLinesFolder', productFamily: fam }
      ];
    }

    // Product Family Attributes
    if (element.type === 'familyAttributesFolder') {
      try {
        const res = await api.listProductFamilyAttributes(context, vscodeInstance, { productFamily: element.productFamily });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No family attributes' }];
        }
        return items.map(attr => ({ type: 'attribute', data: attr }));
      } catch {
        return [{ type: 'empty', label: 'Failed to fetch family attributes' }];
      }
    }

    // Product Family Rules
    if (element.type === 'familyRulesFolder') {
      try {
        const res = await api.listProductFamilyRules(context, vscodeInstance, { productFamily: element.productFamily });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No family rules' }];
        }
        return items.map(r => ({ type: 'rule', data: r }));
      } catch {
        return [{ type: 'empty', label: 'No family rules found' }];
      }
    }

    // Product Lines under Product Family
    if (element.type === 'productLinesFolder') {
      try {
        const res = await api.listProductLines(context, vscodeInstance, { productFamily: element.productFamily });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No product lines found' }];
        }
        return items.map(pl => ({
          type: 'productLine',
          data: pl,
          productFamily: element.productFamily,
          lineVarName: pl.variableName || pl.name
        }));
      } catch {
        return [{ type: 'empty', label: 'Failed to fetch product lines' }];
      }
    }

    // Under Product Line: Attributes, Rules, Models
    if (element.type === 'productLine') {
      return [
        { type: 'lineAttributesFolder', productFamily: element.productFamily, productLine: element.lineVarName },
        { type: 'lineRulesFolder', productFamily: element.productFamily, productLine: element.lineVarName },
        { type: 'modelsFolder', productFamily: element.productFamily, productLine: element.lineVarName }
      ];
    }

    // Product Line Attributes
    if (element.type === 'lineAttributesFolder') {
      try {
        const res = await api.listProductLineAttributes(context, vscodeInstance, {
          productFamily: element.productFamily,
          productLine: element.productLine
        });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No line attributes' }];
        }
        return items.map(attr => ({ type: 'attribute', data: attr }));
      } catch {
        return [{ type: 'empty', label: 'Failed to fetch line attributes' }];
      }
    }

    // Product Line Rules
    if (element.type === 'lineRulesFolder') {
      try {
        const res = await api.listProductLineRules(context, vscodeInstance, {
          productFamily: element.productFamily,
          productLine: element.productLine
        });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No product line rules' }];
        }
        return items.map(r => ({ type: 'rule', data: r }));
      } catch {
        return [{ type: 'empty', label: 'No product line rules found' }];
      }
    }

    // Models under Product Line
    if (element.type === 'modelsFolder') {
      try {
        const res = await api.listModels(context, vscodeInstance, {
          productFamily: element.productFamily,
          productLine: element.productLine
        });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No models found' }];
        }
        return items.map(m => ({
          type: 'model',
          data: m,
          productFamily: element.productFamily,
          productLine: element.productLine,
          modelVarName: m.variableName || m.name
        }));
      } catch {
        return [{ type: 'empty', label: 'Failed to fetch models' }];
      }
    }

    // Under Model: Attributes, BOM Mapping Rules, Rules
    if (element.type === 'model') {
      return [
        { type: 'modelAttributesFolder', productFamily: element.productFamily, productLine: element.productLine, model: element.modelVarName },
        { type: 'modelBomRulesFolder', productFamily: element.productFamily, productLine: element.productLine, model: element.modelVarName },
        { type: 'modelRulesFolder', productFamily: element.productFamily, productLine: element.productLine, model: element.modelVarName }
      ];
    }

    // Model Attributes
    if (element.type === 'modelAttributesFolder') {
      try {
        const res = await api.listModelAttributes(context, vscodeInstance, {
          productFamily: element.productFamily,
          productLine: element.productLine,
          model: element.model
        });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No model attributes' }];
        }
        return items.map(attr => ({ type: 'attribute', data: attr }));
      } catch {
        return [{ type: 'empty', label: 'Failed to fetch model attributes' }];
      }
    }

    // Model BOM Mapping Rules
    if (element.type === 'modelBomRulesFolder') {
      try {
        const res = await api.listModelBomMappingRules(context, vscodeInstance, {
          productFamily: element.productFamily,
          productLine: element.productLine,
          model: element.model
        });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No BOM mapping rules found' }];
        }
        return items.map(r => ({ type: 'bomRule', data: r }));
      } catch {
        return [{ type: 'empty', label: 'No BOM mapping rules found' }];
      }
    }

    // Model Rules
    if (element.type === 'modelRulesFolder') {
      try {
        const res = await api.listModelRules(context, vscodeInstance, {
          productFamily: element.productFamily,
          productLine: element.productLine,
          model: element.model
        });
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        if (items.length === 0) {
          return [{ type: 'empty', label: 'No model rules' }];
        }
        return items.map(r => ({ type: 'rule', data: r }));
      } catch {
        return [{ type: 'empty', label: 'No model rules found' }];
      }
    }

    return [];
  }

  function refresh() {
    cachedFamilies = null;
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
    fetchProductFamilies,
    getCachedFamilies: () => cachedFamilies
  };
}

function registerConfigExplorer(context, vscodeInstance = vscode) {
  const treeDataProvider = createConfigExplorer(vscodeInstance, context);
  const treeView = vscodeInstance.window.registerTreeDataProvider('cpqBml.configExplorer', treeDataProvider);

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.config.refresh', () => {
    treeDataProvider.refresh();
  });

  const filterCmd = vscodeInstance.commands.registerCommand('cpqBml.config.filterExplorer', async () => {
    const current = treeDataProvider.getFilter();
    const query = await vscodeInstance.window.showInputBox({
      prompt: 'Filter Configuration Explorer (families, lines, models, rules, attributes)',
      placeHolder: 'e.g. telecom, router, bandwidth, compatibility...',
      value: current,
      ignoreFocusOut: true
    });
    if (query !== undefined) {
      treeDataProvider.setFilter(query);
    }
  });

  const clearFilterCmd = vscodeInstance.commands.registerCommand('cpqBml.config.clearFilter', () => {
    treeDataProvider.clearFilter();
  });

  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.config.searchExplorer', () => {
    return vscodeInstance.commands.executeCommand('cpqBml.cloud.searchExplorer');
  });

  context.subscriptions.push(treeView, refreshCmd, filterCmd, clearFilterCmd, searchCmd);
  return { treeDataProvider, treeView };
}

module.exports = {
  createConfigExplorer,
  registerConfigExplorer
};
