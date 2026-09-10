const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { getSettings, getUtilLibrariesFolder } = require('@/lang/rest/config');

let activeCommerceTarget = null;

function getActiveCommerceTarget() {
  return activeCommerceTarget;
}

function setActiveCommerceTarget(target) {
  activeCommerceTarget = target;
}

/**
 * Scans local workspace for existing commerce process and document folders.
 */
function findLocalCommerceProcesses(workspaceRoot) {
  if (!workspaceRoot) return [];
  const results = [];
  const seen = new Set();

  function checkDir(baseDir) {
    if (!fs.existsSync(baseDir)) return;
    try {
      const procEntries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const proc of procEntries) {
        if (!proc.isDirectory()) continue;
        const procPath = path.join(baseDir, proc.name);
        try {
          const docEntries = fs.readdirSync(procPath, { withFileTypes: true });
          for (const doc of docEntries) {
            if (!doc.isDirectory()) continue;
            if (doc.name.startsWith('.')) continue;
            const key = `${proc.name}/${doc.name}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ process: proc.name, document: doc.name });
            }
          }
        } catch {}
      }
    } catch {}
  }

  checkDir(path.join(workspaceRoot, 'cpq', 'commerce-libraries'));
  checkDir(path.join(workspaceRoot, 'library'));
  return results;
}

/**
 * Dynamically resolves active commerce processes and documents from session, config, local workspace, or live server.
 */
async function resolveCommerceTargets(vscodeInstance, context, forceRemote = false) {
  const settings = getSettings(vscodeInstance);
  const configuredProcess = settings.commerceProcess;
  const configuredDocument = settings.commerceDocument || 'transaction';

  if (activeCommerceTarget && !forceRemote) {
    return [activeCommerceTarget];
  }

  if (configuredProcess && configuredProcess !== 'oraclecpqo' && !forceRemote) {
    return [{ process: configuredProcess, document: configuredDocument }];
  }

  const folders = vscodeInstance && vscodeInstance.workspace && vscodeInstance.workspace.workspaceFolders;
  const wsRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  const localTargets = findLocalCommerceProcesses(wsRoot);
  if (localTargets.length > 0 && !forceRemote) {
    activeCommerceTarget = localTargets[0];
    return localTargets;
  }

  try {
    const res = await api.listCommerceProcesses(context, vscodeInstance);
    if (res && res.statusCode >= 200 && res.statusCode < 300) {
      let body = res.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const items = Array.isArray(body) ? body : ((body && (body.items || body.processes || body.data)) || []);
      if (items.length > 0) {
        const discovered = [];
        for (const it of items) {
          const procVar = it.variableName || it.name || it.id;
          if (!procVar) continue;
          let docVar = 'transaction';
          try {
            const docRes = await api.listCommerceDocuments(context, vscodeInstance, { process: procVar, limit: 10 });
            if (docRes && docRes.statusCode >= 200 && docRes.statusCode < 300) {
              let docBody = docRes.body;
              if (typeof docBody === 'string') {
                try { docBody = JSON.parse(docBody); } catch { docBody = {}; }
              }
              const docItems = Array.isArray(docBody) ? docBody : ((docBody && (docBody.items || docBody.documents)) || []);
              if (docItems.length > 0) {
                docVar = docItems[0].variableName || docItems[0].name || 'transaction';
              }
            }
          } catch {}
          discovered.push({ process: procVar, document: docVar });
        }
        if (discovered.length > 0) {
          activeCommerceTarget = discovered[0];
          return discovered;
        }
      }
    }
  } catch {}

  const fallback = { process: configuredProcess || 'oraclecpqo', document: configuredDocument };
  return [fallback];
}

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
    } catch {}

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
  } catch {}
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

  for (const [folder, list] of groups.entries()) {
    list.sort((a, b) => (a.variableName || a.name || '').localeCompare(b.variableName || b.name || ''));
  }

  return groups;
}

module.exports = {
  findLocalCommerceProcesses,
  resolveCommerceTargets,
  findLocalFunctionFile,
  searchFileRecursive,
  groupFunctionsByFolder,
  getActiveCommerceTarget,
  setActiveCommerceTarget,
};
