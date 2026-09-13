const { vscode, safeParseJson, extractStringValue, formatNameAndVarName } = require('./cloudVscodeShim');

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { getDataTableFolder } = require('@/lang/rest/config');
const { createCloudDragAndDropController } = require('./cloudDragAndDrop');

/**
 * Fetches the list of all Data Tables from the CPQ server.
 */
async function fetchRemoteDataTables(vscodeInstance = vscode, customTransport, context) {
  let ctx = context;
  let vsc = vscodeInstance;
  let transport = customTransport;

  if (vscodeInstance && (vscodeInstance.secrets || vscodeInstance.subscriptions)) {
    ctx = vscodeInstance;
    vsc = customTransport || vscode;
    transport = context;
  }

  try {
    const res = await api.listDataTables(ctx, vsc, { limit: 1000 }, transport);
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      const body = safeParseJson(res.body);
      const items = body.items || (Array.isArray(body) ? body : []);
      return items.map(t => {
        const name = extractStringValue(t.name || t.variableName || t.tableName, 'UnknownTable');
        const label = extractStringValue(t.label || t.description || t.name, name);
        const description = extractStringValue(t.description, '');
        const folder = extractStringValue(t.folder, '');
        return {
          name,
          label,
          description,
          folder,
          raw: t
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch remote data tables:', err);
    return [];
  }
}

/**
 * Fetches schema definition (columns, types, descriptions) for a specific Data Table.
 */
async function fetchTableSchema(tableName, vscodeInstance = vscode, customTransport, context) {
  let ctx = context;
  let vsc = vscodeInstance;
  let transport = customTransport;

  if (vscodeInstance && (vscodeInstance.secrets || vscodeInstance.subscriptions)) {
    ctx = vscodeInstance;
    vsc = customTransport || vscode;
    transport = context;
  }

  try {
    const res = await api.getDataTableSchema(ctx, vsc, tableName, transport);
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      const body = safeParseJson(res.body);
      const columns = body.columns || body.fields || body.items || [];
      return columns.map(c => ({
        name: extractStringValue(c.name || c.variableName, 'col'),
        type: extractStringValue(c.type || c.dataType, 'String'),
        label: extractStringValue(c.label || c.name, ''),
        isPrimaryKey: Boolean(c.isPrimaryKey || c.primaryKey)
      }));
    }
    return [];
  } catch (err) {
    console.warn(`Failed to fetch schema for table ${tableName}:`, err);
    return [];
  }
}

/**
 * Fetches rows for a Data Table from the live CPQ REST endpoint.
 */
async function fetchTableRows(tableName, { limit = 200, offset = 0, query } = {}, vscodeInstance = vscode, customTransport, context) {
  let ctx = context;
  let vsc = vscodeInstance;
  let transport = customTransport;

  if (vscodeInstance && (vscodeInstance.secrets || vscodeInstance.subscriptions)) {
    ctx = vscodeInstance;
    vsc = customTransport || vscode;
    transport = context;
  }

  try {
    const res = await api.getDataTableRows(ctx, vsc, tableName, { limit, offset, q: query }, transport);
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      const body = safeParseJson(res.body);
      return body.items || (Array.isArray(body) ? body : []);
    }
    return [];
  } catch (err) {
    console.warn(`Failed to fetch rows for table ${tableName}:`, err);
    return [];
  }
}

/**
 * Pure Factory: Creates the Cloud Data Tables TreeDataProvider.
 */
function createCloudDataTablesProvider(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedTables = null;
  const schemaCache = new Map();
  let filterQuery = '';

  function setFilter(query) {
    filterQuery = typeof query === 'string' ? query.trim() : '';
    if (vscodeInstance?.commands?.executeCommand) {
      vscodeInstance.commands.executeCommand('setContext', 'cpqBml.cloudDataTablesFiltered', Boolean(filterQuery));
    }
    onDidChangeTreeDataEmitter.fire();
  }

  function getFilter() {
    return filterQuery;
  }

  function clearFilter() {
    setFilter('');
  }

  function matchesTable(t, query) {
    if (!t) return false;
    const q = query.toLowerCase();
    const name = extractStringValue(t.name, '').toLowerCase();
    const label = extractStringValue(t.label, '').toLowerCase();
    const desc = extractStringValue(t.description, '').toLowerCase();
    return name.includes(q) || label.includes(q) || desc.includes(q);
  }

  async function getTables() {
    if (!cachedTables) {
      cachedTables = await fetchRemoteDataTables(vscodeInstance, undefined, context);
    }
    return cachedTables;
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
      item.contextValue = 'cpqDataTablesFilterInfo';
      item.command = {
        command: 'cpqBml.dataTables.clearFilter',
        title: 'Clear Data Tables Filter'
      };
      return item;
    }

    if (element.type === 'empty' || element.type === 'empty_column') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('info');
      return item;
    }

    if (element.type === 'table') {
      const displayLabel = formatNameAndVarName(element.data.label, element.data.name);
      const isFiltered = Boolean(filterQuery);
      const item = new vscodeInstance.TreeItem(
        displayLabel,
        isFiltered ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.tooltip = `Data Table: ${element.data.label || element.data.name} (${element.data.name})\n${element.data.description || 'Click to view columns'}`;
      item.contextValue = 'cpqCloudDataTable';
      item.iconPath = new vscodeInstance.ThemeIcon('database', new vscodeInstance.ThemeColor('symbolIcon.classForeground'));
      return item;
    }

    if (element.type === 'column') {
      const col = element.data;
      const label = `${col.name}${col.isPrimaryKey ? ' [PK]' : ''}`;
      const item = new vscodeInstance.TreeItem(label, vscodeInstance.TreeItemCollapsibleState.None);
      item.description = col.type || 'String';
      item.iconPath = new vscodeInstance.ThemeIcon(col.isPrimaryKey ? 'key' : 'symbol-field');
      item.contextValue = 'cpqCloudDataTableColumn';
      item.tooltip = `${col.name} (${col.type || 'String'})${col.isPrimaryKey ? ' [Primary Key]' : ''}\nClick to insert column name at cursor (or copy to clipboard)`;
      item.command = {
        command: 'cpqBml.cloud.insertOrCopyAttribute',
        title: 'Insert Column Name at Cursor',
        arguments: [{ data: { variableName: col.name } }]
      };
      return item;
    }

    return new vscodeInstance.TreeItem('Unknown');
  }

  async function getChildren(element) {
    if (!element) {
      // Root level: return tables
      const tables = await getTables();
      if (!tables || tables.length === 0) {
        return [{
          type: 'empty',
          label: 'No Data Tables found (Check connection / credentials)'
        }];
      }

      const items = [];
      if (filterQuery) {
        const matches = tables.filter(t => matchesTable(t, filterQuery));
        items.push({
          type: 'filterInfo',
          query: filterQuery,
          totalMatches: matches.length
        });
        for (const t of matches) {
          items.push({ type: 'table', data: t });
        }
        return items;
      }

      return tables.map(t => ({
        type: 'table',
        data: t
      }));
    }

    if (element.type === 'empty') {
      return [];
    }

    if (element.type === 'table') {
      const tableName = element.data.name;
      if (!schemaCache.has(tableName)) {
        try {
          const cols = await fetchTableSchema(tableName, vscodeInstance, undefined, context);
          schemaCache.set(tableName, cols);
        } catch {
          schemaCache.set(tableName, []);
        }
      }
      const columns = schemaCache.get(tableName);
      if (!columns || columns.length === 0) {
        return [{
          type: 'empty_column',
          label: 'No columns found'
        }];
      }
      return columns.map(c => ({
        type: 'column',
        tableName,
        data: c
      }));
    }

    return [];
  }

  function refresh() {
    cachedTables = null;
    schemaCache.clear();
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
    getTables,
    getCachedTables: () => cachedTables
  };
}

/**
 * Exports data table rows to a CSV file.
 */
async function exportTableCsvCommand(item, vscodeInstance = vscode, customTransport, context) {
  const tableName = item?.data?.name || item?.name;
  if (!tableName) return;

  let ctx = context;
  let vsc = vscodeInstance;
  let transport = customTransport;

  if (vscodeInstance && (vscodeInstance.secrets || vscodeInstance.subscriptions)) {
    ctx = vscodeInstance;
    vsc = customTransport || vscode;
    transport = context;
  }

  await vsc.window.withProgress({
    location: 15,
    title: `Exporting '${tableName}' records from CPQ Cloud...`,
    cancellable: false
  }, async () => {
    try {
      const rows = await fetchTableRows(tableName, { limit: 1000 }, vsc, transport, ctx);
      if (!rows || rows.length === 0) {
        vscodeInstance.window.showInformationMessage(`Table '${tableName}' contains no records.`);
        return;
      }

      const allKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r).filter(k => k !== 'links'))));
      const csvHeader = allKeys.join(',');
      const csvRows = rows.map(r => allKeys.map(k => JSON.stringify(r[k] !== undefined ? r[k] : '')).join(','));
      const csvContent = [csvHeader, ...csvRows].join('\n');

      const folders = vscodeInstance.workspace && vscodeInstance.workspace.workspaceFolders;
      const workspaceRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : null;
      let defaultPath = `${tableName}.csv`;
      if (workspaceRoot) {
        const dtDir = getDataTableFolder(workspaceRoot, vscodeInstance);
        fs.mkdirSync(dtDir, { recursive: true });
        defaultPath = path.join(dtDir, `${tableName}.csv`);
      }

      const uri = await vscodeInstance.window.showSaveDialog({
        filters: { 'CSV Files': ['csv'] },
        defaultUri: vscodeInstance.Uri.file(defaultPath)
      });

      if (uri) {
        if (path.isAbsolute(uri.fsPath)) {
          fs.mkdirSync(path.dirname(uri.fsPath), { recursive: true });
        }
        if (vscodeInstance.workspace.fs && vscodeInstance.workspace.fs.writeFile) {
          await vscodeInstance.workspace.fs.writeFile(uri, Buffer.from(csvContent, 'utf8'));
        } else {
          fs.writeFileSync(uri.fsPath, csvContent, 'utf8');
        }
        vscodeInstance.window.showInformationMessage(`Exported ${rows.length} rows to ${path.basename(uri.fsPath)}`);
      }
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to export table '${tableName}': ${err.message}`);
    }
  });
}

function registerCloudDataTables(context, vscodeInstance = vscode) {
  const provider = createCloudDataTablesProvider(vscodeInstance, context);
  const dragAndDropController = createCloudDragAndDropController(vscodeInstance, 'datatable');
  const treeView = vscodeInstance.window.createTreeView
    ? vscodeInstance.window.createTreeView('cpqBml.cloudDataTables', {
        treeDataProvider: provider,
        dragAndDropController,
        canSelectMany: true,
      })
    : vscodeInstance.window.registerTreeDataProvider('cpqBml.cloudDataTables', provider);

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.refreshDataTables', () => {
    provider.refresh();
  });

  const queryCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.queryDataTable', async (item) => {
    const tableName = item?.data?.name || item?.name;
    if (tableName) {
      const doc = await vscodeInstance.workspace.openTextDocument({
        language: 'bml',
        content: `// Query ${tableName}\nresults = bmql("SELECT * FROM ${tableName}");\n`
      });
      await vscodeInstance.window.showTextDocument(doc);
    }
  });

  const exportCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.exportDataTableCsv', (item) => {
    return exportTableCsvCommand(item, vscodeInstance, undefined, context);
  });

  const filterCmd = vscodeInstance.commands.registerCommand('cpqBml.dataTables.filterExplorer', async () => {
    const current = provider.getFilter();
    const query = await vscodeInstance.window.showInputBox({
      prompt: 'Filter Data Tables',
      placeHolder: 'e.g. pricing, parts, discount...',
      value: current,
      ignoreFocusOut: true
    });
    if (query !== undefined) {
      provider.setFilter(query);
    }
  });

  const clearFilterCmd = vscodeInstance.commands.registerCommand('cpqBml.dataTables.clearFilter', () => {
    provider.clearFilter();
  });

  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.dataTables.searchExplorer', () => {
    return vscodeInstance.commands.executeCommand('cpqBml.cloud.searchExplorer');
  });

  context.subscriptions.push(treeView, refreshCmd, queryCmd, exportCmd, filterCmd, clearFilterCmd, searchCmd);

  return { provider, treeView };
}

module.exports = {
  fetchRemoteDataTables,
  fetchTableSchema,
  fetchTableRows,
  createCloudDataTablesProvider,
  exportTableCsvCommand,
  registerCloudDataTables
};

