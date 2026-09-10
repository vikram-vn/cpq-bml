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
      showTextDocument: async () => {},
      withProgress: async (opt, task) => task({ report: () => {} })
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: () => {}
    },
    workspace: {
      workspaceFolders: [],
      openTextDocument: () => {}
    },
    Uri: {
      file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
    }
  };
}

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const metadataLib = require('@/lang/rest/metadata');
const { getSettings, getUtilLibrariesFolder, getCommerceLibrariesFolder } = require('@/lang/rest/config');

/**
 * Finds local .bml file matching a function variable name in workspace.
 */
function findLocalFunctionFile(workspaceRoot, varName, folderName, commerceMetadata, vscodeInstance) {
  if (!workspaceRoot || !varName) return null;

  const candidatePaths = [];

  if (commerceMetadata && commerceMetadata.commerceProcess && commerceMetadata.commerceDocument) {
    candidatePaths.push(
      path.join(workspaceRoot, 'cpq', 'commerce-libraries', commerceMetadata.commerceProcess, commerceMetadata.commerceDocument, 'libraries', varName, `${varName}.bml`),
      path.join(workspaceRoot, 'library', commerceMetadata.commerceProcess, commerceMetadata.commerceDocument, 'libraries', varName, `${varName}.bml`),
      path.join(workspaceRoot, commerceMetadata.commerceProcess, commerceMetadata.commerceDocument, 'libraries', varName, `${varName}.bml`)
    );
  } else {
    const utilFolder = getUtilLibrariesFolder(vscodeInstance);
    if (folderName) {
      candidatePaths.push(path.join(workspaceRoot, utilFolder, folderName, varName, `${varName}.bml`));
    }
    candidatePaths.push(path.join(workspaceRoot, utilFolder, varName, `${varName}.bml`));

    try {
      const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && /^cpq-/i.test(entry.name)) {
          if (folderName) {
            candidatePaths.push(path.join(workspaceRoot, entry.name, 'util-libraries', folderName, varName, `${varName}.bml`));
          }
          candidatePaths.push(path.join(workspaceRoot, entry.name, 'util-libraries', varName, `${varName}.bml`));
        }
      }
    } catch {
      // Ignore read errors
    }

    candidatePaths.push(
      path.join(workspaceRoot, 'library', folderName || '', varName, `${varName}.bml`),
      path.join(workspaceRoot, 'library', 'util', varName, `${varName}.bml`),
      path.join(workspaceRoot, 'library', varName, `${varName}.bml`),
      path.join(workspaceRoot, 'util', varName, `${varName}.bml`),
      path.join(workspaceRoot, 'bml', 'library', varName, `${varName}.bml`)
    );
  }

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Recursive search inside standard and legacy folders as fallback
  const searchDirs = [
    path.join(workspaceRoot, 'cpq', 'commerce-libraries'),
    path.join(workspaceRoot, 'library')
  ];
  try {
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && /^cpq-/i.test(entry.name)) {
        searchDirs.push(path.join(workspaceRoot, entry.name, 'util-libraries'));
      }
    }
  } catch {}

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      const found = searchFileRecursive(dir, `${varName}.bml`);
      if (found) return found;
    }
  }

  return null;
}

function searchFileRecursive(dir, filename) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const res = searchFileRecursive(fullPath, filename);
        if (res) return res;
      } else if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
        return fullPath;
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Categorizes and formats remote functions into a structured map.
 */
function groupFunctionsByFolder(functions = []) {
  const groups = new Map();

  for (const fn of functions) {
    const folder = fn.folderName || fn.namespace || 'Global';
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder).push(fn);
  }

  // Sort function lists alphabetically
  for (const [folder, list] of groups.entries()) {
    list.sort((a, b) => (a.variableName || a.name || '').localeCompare(b.variableName || b.name || ''));
  }

  return groups;
}

/**
 * Pure Factory: Creates the Cloud Explorer TreeDataProvider.
 */
function createCloudExplorer(vscodeInstance = vscode, context) {
  const onDidChangeTreeDataEmitter = new vscodeInstance.EventEmitter();
  const onDidChangeTreeData = onDidChangeTreeDataEmitter.event;

  let cachedUtilFunctions = null;
  let cachedCommerceFunctions = null;
  let cachedUtilGroups = null;
  let cachedCommerceGroups = null;
  let isLoading = false;

  async function fetchUtilFunctions() {
    let allItems = [];
    let offset = 0;
    const limit = 1000;

    for (;;) {
      const { statusCode, body } = await api.listLibraryFunctions(context, vscodeInstance, { offset, limit });
      if (statusCode < 200 || statusCode >= 300) {
        break;
      }

      let parsed = body;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
      }
      const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
      for (const it of items) {
        it.isCommerce = false;
      }
      allItems = allItems.concat(items);

      const hasMore = parsed && (
        parsed.hasMore === true ||
        (parsed.hasMore === undefined && items.length > 0 && parsed.totalResults !== undefined && offset + items.length < parsed.totalResults) ||
        (parsed.hasMore === undefined && items.length === limit)
      );

      if (!hasMore || items.length === 0) break;
      offset += items.length;
    }
    return allItems;
  }

  async function fetchCommerceFunctions() {
    const settings = getSettings(vscodeInstance);
    const commerceProcess = settings.commerceProcess || 'oraclecpqo';
    const commerceDocument = settings.commerceDocument || 'transaction';
    const commerceMetadata = { commerceProcess, commerceDocument };

    let allItems = [];
    let offset = 0;
    const limit = 1000;

    for (;;) {
      const { statusCode, body } = await api.listLibraryFunctions(
        context,
        vscodeInstance,
        { offset, limit },
        undefined,
        commerceMetadata
      );
      if (statusCode < 200 || statusCode >= 300) {
        break;
      }

      let parsed = body;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
      }
      const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
      for (const it of items) {
        it.isCommerce = true;
        it.commerceProcess = commerceProcess;
        it.commerceDocument = commerceDocument;
      }
      allItems = allItems.concat(items);

      const hasMore = parsed && (
        parsed.hasMore === true ||
        (parsed.hasMore === undefined && items.length > 0 && parsed.totalResults !== undefined && offset + items.length < parsed.totalResults) ||
        (parsed.hasMore === undefined && items.length === limit)
      );

      if (!hasMore || items.length === 0) break;
      offset += items.length;
    }
    return allItems;
  }

  async function fetchRemoteFunctions() {
    if (cachedUtilFunctions && cachedCommerceFunctions) {
      return { util: cachedUtilFunctions, commerce: cachedCommerceFunctions };
    }
    if (isLoading) {
      return { util: cachedUtilFunctions || [], commerce: cachedCommerceFunctions || [] };
    }
    isLoading = true;

    try {
      const [utilResult, commerceResult] = await Promise.allSettled([
        fetchUtilFunctions(),
        fetchCommerceFunctions()
      ]);

      const utilItems = utilResult.status === 'fulfilled' ? utilResult.value : [];
      const commerceItems = commerceResult.status === 'fulfilled' ? commerceResult.value : [];

      cachedUtilFunctions = utilItems;
      cachedCommerceFunctions = commerceItems;
      cachedUtilGroups = groupFunctionsByFolder(utilItems);
      cachedCommerceGroups = groupFunctionsByFolder(commerceItems);

      return { util: utilItems, commerce: commerceItems };
    } finally {
      isLoading = false;
    }
  }

  function getWorkspaceRoot() {
    const folders = vscodeInstance.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  function getTreeItem(element) {
    if (element.type === 'category') {
      const item = new vscodeInstance.TreeItem(
        `${element.label} (${element.count})`,
        element.count > 0 ? vscodeInstance.TreeItemCollapsibleState.Expanded : vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = element.category === 'commerce' ? 'cpqCloudCategoryCommerce' : 'cpqCloudCategoryUtil';
      item.iconPath = new vscodeInstance.ThemeIcon(element.category === 'commerce' ? 'briefcase' : 'library');
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
      return item;
    }

    // Function item
    const fn = element.data;
    const varName = fn.variableName || fn.name;
    const wsRoot = getWorkspaceRoot();
    const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
    const commerceMetadata = isCommerce
      ? { commerceProcess: fn.commerceProcess, commerceDocument: fn.commerceDocument }
      : null;
    const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName, commerceMetadata, vscodeInstance);

    const label = fn.name || varName;
    const item = new vscodeInstance.TreeItem(label, vscodeInstance.TreeItemCollapsibleState.None);

    item.description = fn.returnType ? `-> ${fn.returnType}` : '';
    item.contextValue = localPath ? 'cpqCloudFunctionSynced' : 'cpqCloudFunctionRemote';

    if (localPath) {
      if (isCommerce) {
        const procDoc = `${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}`;
        item.tooltip = `${varName} [Commerce: ${procDoc}]\nLocal: ${path.basename(localPath)}\nFolder: ${fn.folderName || 'Global'}\nReturn: ${fn.returnType || 'void'}`;
      } else {
        item.tooltip = `${varName} (Local: ${path.basename(localPath)})\nFolder: ${fn.folderName || 'Global'}\nReturn: ${fn.returnType || 'void'}`;
      }
      item.iconPath = new vscodeInstance.ThemeIcon('check', new vscodeInstance.ThemeColor('testing.iconPassed'));
      item.command = {
        command: 'vscode.open',
        title: 'Open Local Function',
        arguments: [vscodeInstance.Uri.file(localPath)]
      };
    } else {
      if (isCommerce) {
        const procDoc = `${fn.commerceProcess || 'oraclecpqo'}/${fn.commerceDocument || 'transaction'}`;
        item.tooltip = `${varName} [Cloud Only - Commerce: ${procDoc}]\nFolder: ${fn.folderName || 'Global'}\nReturn: ${fn.returnType || 'void'}\nDouble-click to download and open`;
      } else {
        item.tooltip = `${varName} [Cloud Only]\nFolder: ${fn.folderName || 'Global'}\nReturn: ${fn.returnType || 'void'}\nDouble-click to download and open`;
      }
      item.iconPath = new vscodeInstance.ThemeIcon('cloud-download', new vscodeInstance.ThemeColor('textLink.foreground'));
      item.command = {
        command: 'cpqBml.cloud.pullFunction',
        title: 'Download and Open Function',
        arguments: [element]
      };
    }

    return item;
  }

  async function getChildren(element) {
    const wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
      return [];
    }

    if (!element) {
      // Root level: return categories (Util Libraries and Commerce Libraries)
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
        }
      ];
      return nodes;
    }

    if (element.type === 'category') {
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

    return [];
  }

  function refresh() {
    cachedUtilFunctions = null;
    cachedCommerceFunctions = null;
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

const activePulls = new Set();

/**
 * Handles pulling a cloud function down into the workspace library directory.
 */
async function pullFunctionCommand(item, vscodeInstance = vscode, context) {
  const fn = item?.data || item;
  if (!fn || (!fn.variableName && !fn.name)) {
    vscodeInstance.window.showWarningMessage('No function selected to pull.');
    return;
  }

  const varName = fn.variableName || fn.name;
  const folderName = fn.folderName || fn.namespace || 'util';
  const folders = vscodeInstance.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscodeInstance.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const settings = getSettings(vscodeInstance);
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceProcess = fn.commerceProcess || settings.commerceProcess || 'oraclecpqo';
  const commerceDocument = fn.commerceDocument || settings.commerceDocument || 'transaction';
  const commerceMetadata = isCommerce ? { commerceProcess, commerceDocument } : undefined;
  const pullKey = `${isCommerce ? commerceProcess + '_' + commerceDocument : 'util'}_${varName}`;

  if (activePulls.has(pullKey)) {
    return;
  }
  activePulls.add(pullKey);

  try {
    await vscodeInstance.window.withProgress({
      location: 15, // Notification
      title: `Pulling '${varName}' from CPQ Cloud...`,
      cancellable: false
    }, async () => {
      try {
      const nsVarName = metadataLib.namespaceVariableNameFor(fn);
      let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName, undefined, commerceMetadata);

      if ((res.statusCode < 200 || res.statusCode >= 300) && nsVarName !== varName) {
        // Fallback to simple varName
        res = await api.getLibraryFunction(context, vscodeInstance, varName, undefined, commerceMetadata);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`HTTP ${res.statusCode}: Unable to fetch function content.`);
      }

      const { scriptText, metadata } = metadataLib.splitFunctionResponse(res.body);
      metadata.variableName = metadata.variableName || varName;
      metadata.name = metadata.name || fn.name || varName;

      let targetDir;
      let displayDest;
      if (isCommerce) {
        metadata.commerceProcess = commerceProcess;
        metadata.commerceDocument = commerceDocument;
        metadata.folderName = metadata.folderName || folderName;
        const commerceFolder = getCommerceLibrariesFolder();
        targetDir = path.join(root, commerceFolder, commerceProcess, commerceDocument, 'libraries', varName);
        displayDest = `${commerceFolder}/${commerceProcess}/${commerceDocument}/libraries/${varName}/`;
      } else {
        metadata.folderName = metadata.folderName || folderName;
        const utilFolder = getUtilLibrariesFolder(vscodeInstance);
        targetDir = folderName
          ? path.join(root, utilFolder, folderName, varName)
          : path.join(root, utilFolder, varName);
        displayDest = folderName
          ? `${utilFolder}/${folderName}/${varName}/`
          : `${utilFolder}/${varName}/`;
      }

      fs.mkdirSync(targetDir, { recursive: true });

      const bmlPath = path.join(targetDir, `${varName}.bml`);
      const metaPath = path.join(targetDir, `${varName}-meta.json`);

      fs.writeFileSync(bmlPath, scriptText, 'utf8');
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

      vscodeInstance.window.showInformationMessage(`Successfully pulled '${varName}' to ${displayDest}`);
      const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(bmlPath));
      await vscodeInstance.window.showTextDocument(doc);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to pull '${varName}': ${err.message}`);
    }
  });
  } finally {
    activePulls.delete(pullKey);
  }
}

/**
 * Diffs local function against remote version on CPQ server.
 */
async function diffFunctionCommand(item, vscodeInstance = vscode, context) {
  const fn = item?.data || item;
  if (!fn || (!fn.variableName && !fn.name)) {
    vscodeInstance.window.showWarningMessage('No function selected to diff.');
    return;
  }

  const varName = fn.variableName || fn.name;
  const folderName = fn.folderName || fn.namespace || '';
  const folders = vscodeInstance.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscodeInstance.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }

  const root = folders[0].uri.fsPath;
  const settings = getSettings(vscodeInstance);
  const isCommerce = Boolean(fn.isCommerce || fn.commerceDocument);
  const commerceProcess = fn.commerceProcess || settings.commerceProcess || 'oraclecpqo';
  const commerceDocument = fn.commerceDocument || settings.commerceDocument || 'transaction';
  const commerceMetadata = isCommerce ? { commerceProcess, commerceDocument } : undefined;

  const localFile = findLocalFunctionFile(root, varName, folderName, commerceMetadata, vscodeInstance);
  if (!localFile) {
    vscodeInstance.window.showWarningMessage(`Function '${varName}' is not present locally. Pull it first to compare.`);
    return;
  }

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Fetching remote '${varName}' for side-by-side diff...`,
    cancellable: false
  }, async () => {
    try {
      const nsVarName = metadataLib.namespaceVariableNameFor(fn);
      let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName, undefined, commerceMetadata);
      if ((res.statusCode < 200 || res.statusCode >= 300) && nsVarName !== varName) {
        res = await api.getLibraryFunction(context, vscodeInstance, varName, undefined, commerceMetadata);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`HTTP ${res.statusCode}: Failed to fetch remote function.`);
      }

      const { scriptText } = metadataLib.splitFunctionResponse(res.body);

      // Save remote snapshot in cache for diffing
      const cacheDir = path.join(root, '.cpq', 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const prefix = isCommerce ? `${commerceProcess}_${commerceDocument}_` : '';
      const remoteTempPath = path.join(cacheDir, `${prefix}${varName}.remote.bml`);
      fs.writeFileSync(remoteTempPath, scriptText, 'utf8');

      const localUri = vscodeInstance.Uri.file(localFile);
      const remoteUri = vscodeInstance.Uri.file(remoteTempPath);
      const title = `${varName} (Server <-> Local)`;

      await vscodeInstance.commands.executeCommand('vscode.diff', remoteUri, localUri, title);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Diff failed for '${varName}': ${err.message}`);
    }
  });
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

  context.subscriptions.push(treeView, refreshCmd, pullCmd, diffCmd, openLocalCmd);

  return { treeDataProvider, treeView };
}

module.exports = {
  findLocalFunctionFile,
  groupFunctionsByFolder,
  createCloudExplorer,
  pullFunctionCommand,
  diffFunctionCommand,
  registerCloudExplorer
};

