const { vscode, safeParseJson, extractStringValue } = require('./cloudVscodeShim');
const api = require('@/lang/rest/api');
const { isConfigured } = require('@/lang/rest/config');

/**
 * Pure Factory: Creates the Parts Explorer TreeDataProvider for CPQ Site-Level Parts Catalog.
 */
function createPartsProvider(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedParts = null;
  let isLoading = false;
  let lastError = null;
  let filterQuery = '';

  function setFilter(query) {
    filterQuery = typeof query === 'string' ? query.trim() : '';
    if (vscodeInstance?.commands?.executeCommand) {
      vscodeInstance.commands.executeCommand('setContext', 'cpqBml.cloudPartsFiltered', Boolean(filterQuery));
    }
    onDidChangeTreeDataEmitter.fire();
  }

  function getFilter() {
    return filterQuery;
  }

  function clearFilter() {
    setFilter('');
  }

  function matchesPart(part, query) {
    if (!part) return false;
    const q = query.toLowerCase();
    const pNum = extractStringValue(part.partNumber || part.id || part.itemNumber, '').toLowerCase();
    const desc = extractStringValue(part.description || part.partDescription, '').toLowerCase();
    const status = extractStringValue(part.status, '').toLowerCase();
    const price = String(part.price || '');

    return pNum.includes(q) || desc.includes(q) || status.includes(q) || price.includes(q);
  }

  async function fetchRemoteParts() {
    if (cachedParts) return cachedParts;
    if (isLoading) return [];
    isLoading = true;
    lastError = null;

    try {
      const res = await api.listParts(context, vscodeInstance, {
        limit: 200,
        orderBy: 'dateModified:desc'
      });
      if (res && res.statusCode >= 200 && res.statusCode < 300) {
        const body = safeParseJson(res.body);
        const items = Array.isArray(body) ? body : ((body && body.items) || []);
        cachedParts = items.map(p => {
          const partNumber = extractStringValue(p.partNumber || p.id || p.itemNumber, 'UnknownPart');
          const description = extractStringValue(p.description || p.partDescription, '');
          const price = p.price !== undefined ? p.price : '';
          const currency = extractStringValue(p.currency || p.currencyCode, '$');
          const status = extractStringValue(p.status, 'Active');
          const units = extractStringValue(p.units, 'Each');
          const dateModified = extractStringValue(p.dateModified || p._date_modified, '');
          return {
            partNumber,
            description,
            price,
            currency,
            status,
            units,
            dateModified,
            data: p
          };
        });
        return cachedParts;
      } else {
        const errText = res?.body ? (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)) : `HTTP ${res?.statusCode}`;
        lastError = errText;
        return [];
      }
    } catch (err) {
      lastError = err.message;
      return [];
    } finally {
      isLoading = false;
    }
  }

  function getTreeItem(element) {
    if (element.type === 'filterInfo') {
      const item = new vscodeInstance.TreeItem(
        `Filter: "${element.query}" (${element.totalMatches} match${element.totalMatches === 1 ? '' : 'es'})`,
        vscodeInstance.TreeItemCollapsibleState.None
      );
      item.description = 'Click to clear';
      item.tooltip = `Active filter: "${element.query}"\nFound ${element.totalMatches} matching part(s)\nClick to clear filter`;
      item.iconPath = new vscodeInstance.ThemeIcon('filter');
      item.contextValue = 'cpqPartsFilterInfo';
      item.command = {
        command: 'cpqBml.parts.clearFilter',
        title: 'Clear Parts Filter'
      };
      return item;
    }

    if (element.type === 'part') {
      const p = element.part;
      const displayLabel = p.partNumber;
      const item = new vscodeInstance.TreeItem(displayLabel, vscodeInstance.TreeItemCollapsibleState.None);

      const descParts = [];
      if (p.price !== '' && p.price !== undefined) {
        const currPrefix = p.currency && p.currency.length === 1 ? p.currency : `${p.currency} `;
        descParts.push(`${currPrefix}${p.price}`);
      }
      if (p.status) descParts.push(p.status);
      if (p.description) descParts.push(p.description);

      item.description = descParts.join(' • ');

      const tooltipLines = [
        `Part Number: ${p.partNumber}`,
        p.description ? `Description: ${p.description}` : null,
        p.price !== '' ? `Price: ${p.currency} ${p.price}` : null,
        p.status ? `Status: ${p.status}` : null,
        p.units ? `Units: ${p.units}` : null,
        p.dateModified ? `Modified: ${p.dateModified}` : null,
        '---',
        'Click to inspect part payload'
      ].filter(Boolean);

      item.tooltip = tooltipLines.join('\n');
      item.iconPath = new vscodeInstance.ThemeIcon('package');
      item.contextValue = 'cpqCloudPart';
      item.command = {
        command: 'cpqBml.parts.inspectPart',
        title: 'Inspect Part',
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
      const parts = await fetchRemoteParts();
      if (lastError && (!parts || parts.length === 0)) {
        return [{
          type: 'empty',
          label: `Error loading parts: ${lastError}`
        }];
      }

      const nodes = [];
      const filtered = filterQuery
        ? parts.filter(p => matchesPart(p, filterQuery))
        : parts;

      if (filterQuery) {
        nodes.push({
          type: 'filterInfo',
          query: filterQuery,
          totalMatches: filtered.length
        });
      }

      if (filtered.length === 0) {
        nodes.push({
          type: 'empty',
          label: filterQuery ? 'No matching parts in catalog' : 'No parts found in CPQ site catalog'
        });
        return nodes;
      }

      for (const p of filtered) {
        nodes.push({
          type: 'part',
          part: p
        });
      }

      return nodes;
    }

    return [];
  }

  function refresh() {
    cachedParts = null;
    lastError = null;
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
    fetchRemoteParts,
    getCachedParts: () => cachedParts
  };
}

/**
 * Inspects a part: fetches full details and opens as JSON in editor.
 */
async function inspectPartCommand(item, vscodeInstance = vscode, context) {
  const part = item?.part || item?.data || item;
  if (!part) {
    vscodeInstance.window?.showWarningMessage?.('No part selected.');
    return;
  }

  const pNum = extractStringValue(part.partNumber || part.id || part.itemNumber, '');
  if (!pNum) {
    vscodeInstance.window?.showWarningMessage?.('Selected item does not have a valid Part Number.');
    return;
  }

  await vscodeInstance.window.withProgress({
    location: (vscodeInstance.ProgressLocation && vscodeInstance.ProgressLocation.Notification) || 15,
    title: `Fetching CPQ Part ${pNum}...`,
    cancellable: false
  }, async () => {
    let payload = null;
    try {
      if (typeof api.getPart === 'function') {
        const res = await api.getPart(context, vscodeInstance, pNum);
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          payload = safeParseJson(res.body);
        }
      }
    } catch (_) {}

    if (!payload) {
      payload = part.data || part;
    }

    const formatted = JSON.stringify(payload, null, 2);
    const doc = await vscodeInstance.workspace.openTextDocument({
      language: 'json',
      content: formatted
    });
    await vscodeInstance.window.showTextDocument(doc);
  });
}

/**
 * Copies the Part Number to the clipboard.
 */
async function copyPartNumberCommand(item, vscodeInstance = vscode) {
  const part = item?.part || item?.data || item;
  if (!part) return;
  const pNum = extractStringValue(part.partNumber || part.id || part.itemNumber, '');
  if (!pNum) return;

  if (vscodeInstance.env && vscodeInstance.env.clipboard) {
    await vscodeInstance.env.clipboard.writeText(pNum);
    vscodeInstance.window?.showInformationMessage?.(`Copied Part Number "${pNum}" to clipboard.`);
  }
}

/**
 * Inserts the Part Number into the active text editor at current cursor.
 */
async function insertPartNumberCommand(item, vscodeInstance = vscode) {
  const part = item?.part || item?.data || item;
  if (!part) return;
  const pNum = extractStringValue(part.partNumber || part.id || part.itemNumber, '');
  if (!pNum) return;

  const editor = vscodeInstance.window?.activeTextEditor;
  if (editor) {
    await editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, pNum);
    });
  } else {
    await copyPartNumberCommand(item, vscodeInstance);
  }
}

function registerCloudParts(context, vscodeInstance = vscode) {
  const treeDataProvider = createPartsProvider(vscodeInstance, context);
  const treeView = vscodeInstance.window.registerTreeDataProvider('cpqBml.cloudParts', treeDataProvider);

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.refresh', () => {
    treeDataProvider.refresh();
  });

  const filterCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.filterExplorer', async () => {
    const current = treeDataProvider.getFilter();
    const query = await vscodeInstance.window.showInputBox({
      prompt: 'Filter CPQ Site Parts Catalog',
      placeHolder: 'e.g. PART-100, Cable, Active, 250...',
      value: current,
      ignoreFocusOut: true
    });
    if (query !== undefined) {
      treeDataProvider.setFilter(query);
    }
  });

  const clearFilterCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.clearFilter', () => {
    treeDataProvider.clearFilter();
  });

  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.searchExplorer', async () => {
    const parts = await treeDataProvider.fetchRemoteParts();
    if (!parts || parts.length === 0) {
      vscodeInstance.window?.showInformationMessage?.('No parts available to search.');
      return;
    }
    const items = parts.map(p => ({
      label: `$(package) ${p.partNumber}`,
      description: [p.price ? `${p.currency}${p.price}` : '', p.status].filter(Boolean).join(' • '),
      detail: p.description,
      part: p
    }));

    const selected = await vscodeInstance.window.showQuickPick(items, {
      placeHolder: 'Search CPQ Parts Catalog...',
      matchOnDescription: true,
      matchOnDetail: true
    });
    if (selected) {
      await inspectPartCommand(selected, vscodeInstance, context);
    }
  });

  const inspectCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.inspectPart', (item) => {
    return inspectPartCommand(item, vscodeInstance, context);
  });

  const copyCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.copyPartNumber', (item) => {
    return copyPartNumberCommand(item, vscodeInstance);
  });

  const insertCmd = vscodeInstance.commands.registerCommand('cpqBml.parts.insertPartNumber', (item) => {
    return insertPartNumberCommand(item, vscodeInstance);
  });

  context.subscriptions.push(
    treeView,
    refreshCmd,
    filterCmd,
    clearFilterCmd,
    searchCmd,
    inspectCmd,
    copyCmd,
    insertCmd
  );

  return { treeDataProvider, treeView };
}

module.exports = {
  createPartsProvider,
  registerCloudParts,
  inspectPartCommand,
  copyPartNumberCommand,
  insertPartNumberCommand
};
