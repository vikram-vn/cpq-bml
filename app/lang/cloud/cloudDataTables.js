const { vscode, safeParseJson, extractStringValue } = require('./cloudVscodeShim');

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { getDataTableFolder } = require('@/lang/rest/config');

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
  let isLoading = false;

  async function getTables() {
    if (cachedTables) return cachedTables;
    if (isLoading) return [];
    isLoading = true;
    try {
      cachedTables = await fetchRemoteDataTables(vscodeInstance, undefined, context);
      return cachedTables;
    } catch {
      return [];
    } finally {
      isLoading = false;
    }
  }

  function getTreeItem(element) {
    if (element.type === 'empty' || element.type === 'empty_column') {
      const item = new vscodeInstance.TreeItem(element.label, vscodeInstance.TreeItemCollapsibleState.None);
      item.iconPath = new vscodeInstance.ThemeIcon('info');
      return item;
    }

    if (element.type === 'table') {
      const item = new vscodeInstance.TreeItem(
        element.data.name,
        vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.description = element.data.label !== element.data.name ? element.data.label : '';
      item.tooltip = `Data Table: ${element.data.name}\n${element.data.description || 'Click to view columns'}`;
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
  const treeView = vscodeInstance.window.registerTreeDataProvider('cpqBml.cloudDataTables', provider);

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

  context.subscriptions.push(treeView, refreshCmd, queryCmd, exportCmd);

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

