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
const api = require('../rest/api');
const metadataLib = require('../rest/metadata');
const { getSettings } = require('../rest/config');

/**
 * Finds local .bml file matching a function variable name in workspace.
 */
function findLocalFunctionFile(workspaceRoot, varName, folderName) {
  if (!workspaceRoot || !varName) return null;

  const candidatePaths = [
    path.join(workspaceRoot, 'library', folderName || '', varName, `${varName}.bml`),
    path.join(workspaceRoot, 'library', 'util', varName, `${varName}.bml`),
    path.join(workspaceRoot, 'library', varName, `${varName}.bml`),
    path.join(workspaceRoot, 'util', varName, `${varName}.bml`),
    path.join(workspaceRoot, 'bml', 'library', varName, `${varName}.bml`)
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Recursive search inside library folder as fallback
  const libDir = path.join(workspaceRoot, 'library');
  if (fs.existsSync(libDir)) {
    const found = searchFileRecursive(libDir, `${varName}.bml`);
    if (found) return found;
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

  let cachedFunctions = null;
  let cachedGroups = null;
  let isLoading = false;

  async function fetchRemoteFunctions() {
    if (cachedFunctions) return cachedFunctions;
    if (isLoading) return [];
    isLoading = true;

    try {
      let allItems = [];
      let offset = 0;
      const limit = 1000;

      for (;;) {
        const { statusCode, body } = await api.listLibraryFunctions(context, vscodeInstance, { offset, limit });
        if (statusCode < 200 || statusCode >= 300) {
          throw new Error(`HTTP ${statusCode}: Failed to fetch cloud functions.`);
        }

        let parsed = body;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
        }
        const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
        allItems = allItems.concat(items);

        const hasMore = parsed && (
          parsed.hasMore === true ||
          (parsed.hasMore === undefined && items.length > 0 && parsed.totalResults !== undefined && offset + items.length < parsed.totalResults) ||
          (parsed.hasMore === undefined && items.length === limit)
        );

        if (!hasMore || items.length === 0) break;
        offset += items.length;
      }

      cachedFunctions = allItems;
      cachedGroups = groupFunctionsByFolder(allItems);
      return cachedFunctions;
    } finally {
      isLoading = false;
    }
  }

  function getWorkspaceRoot() {
    const folders = vscodeInstance.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  function getTreeItem(element) {
    if (element.type === 'folder') {
      const item = new vscodeInstance.TreeItem(
        `${element.folderName} (${element.count})`,
        vscodeInstance.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = 'cpqCloudFolder';
      item.iconPath = new vscodeInstance.ThemeIcon('folder');
      return item;
    }

    // Function item
    const fn = element.data;
    const varName = fn.variableName || fn.name;
    const wsRoot = getWorkspaceRoot();
    const localPath = findLocalFunctionFile(wsRoot, varName, fn.folderName);

    const label = fn.name || varName;
    const item = new vscodeInstance.TreeItem(label, vscodeInstance.TreeItemCollapsibleState.None);

    item.description = fn.returnType ? `-> ${fn.returnType}` : '';
    item.contextValue = localPath ? 'cpqCloudFunctionSynced' : 'cpqCloudFunctionRemote';

    if (localPath) {
      item.tooltip = `${varName} (Local: ${path.basename(localPath)})\nFolder: ${fn.folderName || 'Global'}\nReturn: ${fn.returnType || 'void'}`;
      item.iconPath = new vscodeInstance.ThemeIcon('check', new vscodeInstance.ThemeColor('testing.iconPassed'));
      item.command = {
        command: 'vscode.open',
        title: 'Open Local Function',
        arguments: [vscodeInstance.Uri.file(localPath)]
      };
    } else {
      item.tooltip = `${varName} [Cloud Only]\nFolder: ${fn.folderName || 'Global'}\nReturn: ${fn.returnType || 'void'}`;
      item.iconPath = new vscodeInstance.ThemeIcon('cloud-download', new vscodeInstance.ThemeColor('textLink.foreground'));
    }

    return item;
  }

  async function getChildren(element) {
    const wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
      return [];
    }

    if (!element) {
      // Root level: return folders
      await fetchRemoteFunctions();
      if (!cachedGroups || cachedGroups.size === 0) {
        return [];
      }

      const folderNodes = [];
      for (const [folderName, list] of cachedGroups.entries()) {
        folderNodes.push({
          type: 'folder',
          folderName,
          count: list.length,
          functions: list
        });
      }

      folderNodes.sort((a, b) => a.folderName.localeCompare(b.folderName));
      return folderNodes;
    }

    if (element.type === 'folder') {
      return element.functions.map(fn => ({
        type: 'function',
        data: fn
      }));
    }

    return [];
  }

  function refresh() {
    cachedFunctions = null;
    cachedGroups = null;
    onDidChangeTreeDataEmitter.fire();
  }

  return {
    onDidChangeTreeData,
    getTreeItem,
    getChildren,
    refresh,
    getCachedFunctions: () => cachedFunctions,
    getCachedGroups: () => cachedGroups
  };
}

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
  const pullFolder = settings.pullFolder || 'library';

  await vscodeInstance.window.withProgress({
    location: 15, // Notification
    title: `Pulling '${varName}' from CPQ Cloud...`,
    cancellable: false
  }, async () => {
    try {
      const nsVarName = metadataLib.namespaceVariableNameFor(fn);
      let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName);

      if (res.statusCode < 200 || res.statusCode >= 300) {
        // Fallback to simple varName
        res = await api.getLibraryFunction(context, vscodeInstance, varName);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`HTTP ${res.statusCode}: Unable to fetch function content.`);
      }

      const { scriptText, metadata } = metadataLib.splitFunctionResponse(res.body);
      metadata.variableName = metadata.variableName || varName;
      metadata.folderName = metadata.folderName || folderName;
      metadata.name = metadata.name || fn.name || varName;

      const targetDir = path.join(root, pullFolder, folderName, varName);
      fs.mkdirSync(targetDir, { recursive: true });

      const bmlPath = path.join(targetDir, `${varName}.bml`);
      const metaPath = path.join(targetDir, `${varName}-meta.json`);

      fs.writeFileSync(bmlPath, scriptText, 'utf8');
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

      vscodeInstance.window.showInformationMessage(`Successfully pulled '${varName}' to ${pullFolder}/${folderName}/${varName}/`);
      const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(bmlPath));
      await vscodeInstance.window.showTextDocument(doc);
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`Failed to pull '${varName}': ${err.message}`);
    }
  });
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
  const localFile = findLocalFunctionFile(root, varName, folderName);
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
      let res = await api.getLibraryFunction(context, vscodeInstance, nsVarName);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res = await api.getLibraryFunction(context, vscodeInstance, varName);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`HTTP ${res.statusCode}: Failed to fetch remote function.`);
      }

      const { scriptText } = metadataLib.splitFunctionResponse(res.body);

      // Save remote snapshot in cache for diffing
      const cacheDir = path.join(root, '.cpq', 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      const remoteTempPath = path.join(cacheDir, `${varName}.remote.bml`);
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
    const local = findLocalFunctionFile(root, fn.variableName || fn.name, fn.folderName);
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
