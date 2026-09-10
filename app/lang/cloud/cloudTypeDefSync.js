let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      withProgress: async (opt, task) => task({ report: () => {} })
    },
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    workspace: { workspaceFolders: [] }
  };
}

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');

function invalidateIntelliSenseCache() {
  try {
    const { invalidateApiData } = require('@/lang/intellisense/apiData');
    if (typeof invalidateApiData === 'function') invalidateApiData();
  } catch (_) {}
  try {
    const { invalidateCategorizedItems } = require('@/lang/intellisense/categorizedItems');
    if (typeof invalidateCategorizedItems === 'function') invalidateCategorizedItems();
  } catch (_) {}
}

/**
 * Normalizes parameter data types from CPQ REST response or meta sidecar.
 */
function normalizeType(typeObj) {
  if (!typeObj) return 'String';
  if (typeof typeObj === 'string') return typeObj;
  if (typeof typeObj === 'object') {
    return typeObj.displayValue || typeObj.name || 'String';
  }
  return 'String';
}

/**
 * Fetches all library function signatures from CPQ Cloud.
 */
async function fetchCloudSignatures(context, vscodeInstance = vscode) {
  let allItems = [];
  let offset = 0;
  const limit = 1000;

  for (;;) {
    const { statusCode, body } = await api.listLibraryFunctions(context, vscodeInstance, { offset, limit });
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`HTTP ${statusCode}: Unable to list library functions for type definitions.`);
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

  return allItems;
}

/**
 * Generates BML interface declaration stubs for `.cpq/cpq.d.bml`.
 */
function generateTypeDefBml(functions = []) {
  const lines = [];
  lines.push('// =========================================================================');
  lines.push('// Oracle CPQ Cloud BML Library Type Definitions');
  lines.push('// Generated automatically by CPQ-BML extension from live instance');
  lines.push(`// Generated At: ${new Date().toISOString()}`);
  lines.push(`// Total Functions: ${functions.length}`);
  lines.push('// =========================================================================\n');

  for (const fn of functions) {
    const varName = fn.variableName || fn.name;
    if (!varName) continue;

    const ns = fn.folderName || fn.namespace || '';
    const retType = normalizeType(fn.returnType);
    const params = Array.isArray(fn.parameters) ? fn.parameters : [];

    const paramStubs = params.map(p => {
      const pType = normalizeType(p.dataType || p.type);
      const pName = p.name || p.variableName || 'arg';
      return `${pType} ${pName}`;
    });

    lines.push('/**');
    lines.push(` * Function: ${varName}`);
    if (fn.name && fn.name !== varName) {
      lines.push(` * Display Name: ${fn.name}`);
    }
    if (ns) {
      lines.push(` * Namespace: ${ns}`);
    }
    if (fn.description) {
      lines.push(` * Description: ${fn.description}`);
    }
    for (const p of params) {
      const pType = normalizeType(p.dataType || p.type);
      const pName = p.name || p.variableName || 'arg';
      lines.push(` * @param ${pName} {${pType}}`);
    }
    lines.push(` * @return {${retType}}`);
    lines.push(' */');

    // Generate util.varName declaration
    lines.push(`${retType} util.${varName}(${paramStubs.join(', ')});`);

    // If namespaced, also declare with namespace
    if (ns && ns.toLowerCase() !== 'util') {
      lines.push(`${retType} util.${ns}.${varName}(${paramStubs.join(', ')});`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generates JSON metadata for IntelliSense and Hover tooltips.
 */
function generateTypeDefJson(functions = []) {
  const data = {};

  for (const fn of functions) {
    const varName = fn.variableName || fn.name;
    if (!varName) continue;

    const ns = fn.folderName || fn.namespace || '';
    const retType = normalizeType(fn.returnType);
    const params = Array.isArray(fn.parameters) ? fn.parameters : [];

    const paramDoc = params.map(p => {
      const pType = normalizeType(p.dataType || p.type);
      const pName = p.name || p.variableName || 'arg';
      return `${pName} [${pType}]`;
    }).join(', ');

    const syntax = `util.${varName}(${paramDoc})`;
    const key = `util.${varName.toLowerCase()}`;

    data[key] = {
      name: `util.${varName}`,
      syntax,
      category: 'function',
      returnType: retType,
      parameters: params,
      description: fn.description || (fn.name ? `${fn.name} (${ns || 'util'})` : `Cloud function ${varName}`),
      namespace: ns,
      source: 'cloud-sync'
    };

    if (ns && ns.toLowerCase() !== 'util') {
      const nsKey = `util.${ns.toLowerCase()}.${varName.toLowerCase()}`;
      data[nsKey] = {
        ...data[key],
        name: `util.${ns}.${varName}`,
        syntax: `util.${ns}.${varName}(${paramDoc})`
      };
    }
  }

  return data;
}

/**
 * Syncs cloud definitions down into the active workspace.
 */
async function syncCloudDefinitions(context, vscodeInstance = vscode) {
  const folders = vscodeInstance.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscodeInstance.window.showErrorMessage('CPQ-BML: Please open a workspace folder before syncing cloud definitions.');
    return;
  }

  const root = folders[0].uri.fsPath;

  return vscodeInstance.window.withProgress({
    location: 15, // Notification
    title: 'Syncing CPQ Cloud Type Definitions & IntelliSense...',
    cancellable: false
  }, async (progress) => {
    try {
      progress.report({ message: 'Fetching remote function signatures...' });
      const functions = await fetchCloudSignatures(context, vscodeInstance);

      progress.report({ message: `Generating declarations for ${functions.length} functions...` });
      const bmlTypeDef = generateTypeDefBml(functions);
      const jsonTypeDef = generateTypeDefJson(functions);

      const cpqDir = path.join(root, '.cpq');
      const cacheDir = path.join(cpqDir, 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });

      const dPath = path.join(cpqDir, 'cpq.d.bml');
      const jsonPath = path.join(cacheDir, 'bml-cloud-functions.json');

      fs.writeFileSync(dPath, bmlTypeDef, 'utf8');
      fs.writeFileSync(jsonPath, JSON.stringify(jsonTypeDef, null, 2), 'utf8');

      // Invalidate IntelliSense caches to pick up newly synced definitions
      invalidateIntelliSenseCache();

      vscodeInstance.window.showInformationMessage(
        `CPQ-BML: Synced ${functions.length} cloud function definitions to .cpq/cpq.d.bml and IntelliSense cache.`
      );
      return { success: true, count: functions.length };
    } catch (err) {
      vscodeInstance.window.showErrorMessage(`CPQ-BML: Cloud definitions sync failed: ${err.message}`);
      throw err;
    }
  });
}

function registerCloudTypeDefCommands(context, vscodeInstance = vscode) {
  const disposable = vscodeInstance.commands.registerCommand('cpqBml.cloud.syncDefinitions', () => {
    return syncCloudDefinitions(context, vscodeInstance);
  });
  context.subscriptions.push(disposable);
}

module.exports = {
  normalizeType,
  fetchCloudSignatures,
  generateTypeDefBml,
  generateTypeDefJson,
  syncCloudDefinitions,
  registerCloudTypeDefCommands
};
