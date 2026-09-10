let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    TreeItem: function (label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: function () {
      this.event = () => ({ dispose: () => {} });
      this.fire = () => {};
    },
    ThemeIcon: function (id, color) {
      this.id = id;
      this.color = color;
    },
    ThemeColor: function (id) {
      this.id = id;
    },
    window: {
      registerTreeDataProvider: () => ({ dispose: () => {} }),
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      showWarningMessage: () => {},
      showSaveDialog: () => {},
      withProgress: async (opt, task) => task({ report: () => {} })
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: () => {}
    },
    workspace: {
      workspaceFolders: [],
      fs: { writeFile: () => {} }
    },
    Uri: {
      file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
    }
  };
}

const fs = require('fs');
const path = require('path');
const { request } = require('../rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, getSettings } = require('../rest/config');

/**
 * Fetches the list of all Data Tables from the CPQ server.
 */
async function fetchRemoteDataTables(vscodeInstance = vscode, customTransport) {
  const baseUrl = getBaseUrl(vscodeInstance);
  const authHeader = getAuthHeader(vscodeInstance);
  if (!baseUrl || !authHeader) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const pathUrl = `/rest/${version}/customDataTables`;

  const res = await request({
    baseUrl,
    path: pathUrl,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 20000,
    transport: customTransport
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    let body = res.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const items = body.items || (Array.isArray(body) ? body : []);
    return items.map(t => ({
      name: t.name || t.variableName || t.tableName || 'UnknownTable',
      label: t.label || t.description || t.name || 'Data Table',
      description: t.description || '',
      raw: t
    })).sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // If customDataTables returns 404/not supported, fallback to empty list or describe
    return [];
  }
}

/**
 * Fetches schema definition (columns, types, descriptions) for a specific Data Table.
 */
async function fetchTableSchema(tableName, vscodeInstance = vscode, customTransport) {
  const baseUrl = getBaseUrl(vscodeInstance);
  const authHeader = getAuthHeader(vscodeInstance);
  if (!baseUrl || !authHeader) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const pathUrl = `/rest/${version}/customDataTables/${tableName}`;

  const res = await request({
    baseUrl,
    path: pathUrl,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 20000,
    transport: customTransport
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    let body = res.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const columns = body.columns || body.fields || body.items || [];
    return columns.map(c => ({
      name: c.name || c.variableName || 'col',
      type: c.type || c.dataType || 'String',
      label: c.label || c.name || '',
      isPrimaryKey: Boolean(c.isPrimaryKey || c.primaryKey)
    }));
  }

  return [];
}

/**
 * Fetches rows for a Data Table from the live CPQ REST endpoint.
 */
async function fetchTableRows(tableName, { limit = 200, offset = 0, query } = {}, vscodeInstance = vscode, customTransport) {
  const baseUrl = getBaseUrl(vscodeInstance);
  const authHeader = getAuthHeader(vscodeInstance);
  if (!baseUrl || !authHeader) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  // CPQ supports either /rest/v18/custom{TableName} or /rest/v18/customDataTables/{TableName}/records
  let pathUrl = `/rest/${version}/custom${tableName}?limit=${limit}&offset=${offset}`;
  if (query) {
    pathUrl += `&q=${encodeURIComponent(query)}`;
  }

  let res = await request({
    baseUrl,
    path: pathUrl,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 25000,
    transport: customTransport
  });

  if (res.statusCode >= 300 || res.statusCode < 200) {
    // Try alternate endpoint: /customDataTables/{tableName}/records
    const altPath = `/rest/${version}/customDataTables/${tableName}/records?limit=${limit}&offset=${offset}`;
    const altRes = await request({
      baseUrl,
      path: altPath,
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json'
      },
      timeoutMs: getSettings(vscodeInstance).timeoutMs || 25000,
      transport: customTransport
    });
    if (altRes.statusCode >= 200 && altRes.statusCode < 300) {
      res = altRes;
    }
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    let body = res.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    return body.items || (Array.isArray(body) ? body : []);
  }

  return [];
}

/**
 * Pure Factory: Creates the Cloud Data Tables TreeDataProvider.
 */
function createCloudDataTablesProvider(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedTables = null;
  let schemaCache = new Map();
  let isLoading = false;

  async function getTables() {
    if (cachedTables) return cachedTables;
    if (isLoading) return [];
    isLoading = true;
    try {
      cachedTables = await fetchRemoteDataTables(vscodeInstance);
      return cachedTables;
    } catch {
      return [];
    } finally {
      isLoading = false;
    }
  }

  function getTreeItem(element) {
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
      return tables.map(t => ({
        type: 'table',
        data: t
      }));
    }

    if (element.type === 'table') {
      const tableName = element.data.name;
      if (!schemaCache.has(tableName)) {
        try {
          const cols = await fetchTableSchema(tableName, vscodeInstance);
          schemaCache.set(tableName, cols);
        } catch {
          schemaCache.set(tableName, []);
        }
      }
      const columns = schemaCache.get(tableName);
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
async function exportTableCsvCommand(item, vscodeInstance = vscode) {
  const tableName = item?.data?.name || item?.name;
  if (!tableName) return;

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Exporting '${tableName}' records from CPQ Cloud...`,
    cancellable: false
  }, async () => {
    try {
      const rows = await fetchTableRows(tableName, { limit: 1000 }, vscodeInstance);
      if (!rows || rows.length === 0) {
        vscodeInstance.window.showInformationMessage(`Table '${tableName}' contains no records.`);
        return;
      }

      const allKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r).filter(k => k !== 'links'))));
      const csvHeader = allKeys.join(',');
      const csvRows = rows.map(r => allKeys.map(k => JSON.stringify(r[k] !== undefined ? r[k] : '')).join(','));
      const csvContent = [csvHeader, ...csvRows].join('\n');

      const uri = await vscodeInstance.window.showSaveDialog({
        filters: { 'CSV Files': ['csv'] },
        defaultUri: vscodeInstance.Uri.file(`${tableName}.csv`)
      });

      if (uri) {
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
    return exportTableCsvCommand(item, vscodeInstance);
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
