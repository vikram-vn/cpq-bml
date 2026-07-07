const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

/**
 * Workspace Index
 *
 * Scans all *.bml and *-meta.json files in the workspace to build an
 * in-memory map of util.* and commerce.* function definitions.
 *
 * Used by:
 *  - Go-to-Definition provider
 *  - Find-All-References provider
 *  - Rename provider
 *  - Hover documentation for workspace functions
 */

let _index = null; // Map<qualifiedName, { filePath, line, parameters, returnType, docHeader }>
let _watcher = null;

/**
 * Extract the docHeader block comment from the top of a BML file.
 * Looks for a * ... * block containing "Function Name:" or "Description:".
 */
function extractDocHeader(fileText) {
  const blockMatch =
    fileText.match(/\/\*[\s\S]*?Function Name:[\s\S]*?\*\//i) ||
    fileText.match(/\/\*[\s\S]*?Description:[\s\S]*?\*\//i);
  if (!blockMatch) return "";
  return blockMatch[0]
    .replace(/^\/\*+\s*/m, "")
    .replace(/\s*\*+\/$/m, "")
    .replace(/^\s*\*\s?/gm, "")
    .trim();
}

/**
 * Parse parameters from a -meta.json sidecar.
 * Returns [{ name, dataType }] or [].
 */
function parseMetaParams(metaPath) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const params = meta.params || meta.parameters || [];
    return params.map((p) => ({
      name: p.name || p.variableName || "",
      dataType: p.dataType || p.type || "",
    }));
  } catch {
    return [];
  }
}

function parseMetaReturnType(metaPath) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return meta.returnType || meta.returnDataType || "";
  } catch {
    return "";
  }
}

/**
 * Build / rebuild the full workspace index.
 */
function buildIndex() {
  const index = new Map();

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return index;

  for (const folder of workspaceFolders) {
    // Walk the workspace looking for *.bml files
    try {
      scanDir(folder.uri.fsPath, index);
    } catch (e) {
      // Non-fatal: workspace may not have any .bml files
    }
  }

  return index;
}

function scanDir(dir, index) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // skip hidden dirs
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDir(fullPath, index);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".bml") &&
      !/(-AI|_ai)\.bml$/i.test(entry.name)
    ) {
      indexBmlFile(fullPath, index);
    }
  }
}

function indexBmlFile(filePath, index) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  const baseName = path.basename(filePath, ".bml");
  const dir = path.dirname(filePath);
  const metaPath = path.join(dir, baseName + "-meta.json");

  // Determine qualified name from directory structure
  // Convention: files under /library/ → util.variableName
  //             files under /commerce/ → commerce.variableName
  const normalizedPath = filePath.replace(/\\/g, "/");
  const isUtil = /\/library\/|\/util\//i.test(normalizedPath);
  const isCommerce = /\/commerce\//i.test(normalizedPath);
  const prefix = isUtil ? "util" : isCommerce ? "commerce" : null;
  if (!prefix) return;

  const qualifiedName = `${prefix}.${baseName}`;
  const docHeader = extractDocHeader(text);
  const parameters = parseMetaParams(metaPath);
  const returnType = parseMetaReturnType(metaPath);

  // Find the first non-comment, non-empty line as the definition line
  let defLine = 0;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("*")
    ) {
      defLine = i;
      break;
    }
  }

  index.set(qualifiedName.toLowerCase(), {
    qualifiedName,
    filePath,
    line: defLine,
    parameters,
    returnType,
    docHeader,
  });
}

/**
 * Returns the workspace index, rebuilding it if necessary.
 */
function getWorkspaceIndex() {
  if (!_index) {
    _index = buildIndex();
  }
  return _index;
}

/**
 * Invalidate the index so it is rebuilt on the next call to getWorkspaceIndex().
 */
function invalidateIndex() {
  _index = null;
}

/**
 * Register file-system watchers to keep the index fresh.
 */
function registerWorkspaceIndexWatcher(context) {
  // Watch for .bml file changes
  const bmlWatcher = vscode.workspace.createFileSystemWatcher("**/*.bml");
  bmlWatcher.onDidChange(invalidateIndex);
  bmlWatcher.onDidCreate(invalidateIndex);
  bmlWatcher.onDidDelete(invalidateIndex);
  context.subscriptions.push(bmlWatcher);

  // Watch for meta.json changes
  const metaWatcher =
    vscode.workspace.createFileSystemWatcher("**/*-meta.json");
  metaWatcher.onDidChange(invalidateIndex);
  metaWatcher.onDidCreate(invalidateIndex);
  metaWatcher.onDidDelete(invalidateIndex);
  context.subscriptions.push(metaWatcher);
}

/**
 * Given a document and position, resolve the util.name or commerce.name call
 * the cursor is on (if any). Returns { prefix, name, qualifiedName } or null.
 */
function resolveCallAtPosition(document, position) {
  const lineText = document.lineAt(position).text;
  const charPos = position.character;

  // Look for util.name or commerce.name pattern around the cursor
  const pattern = /\b(util|commerce)\.([a-zA-Z_]\w*)/g;
  let m;
  while ((m = pattern.exec(lineText)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (charPos >= start && charPos <= end) {
      return {
        prefix: m[1],
        name: m[2],
        qualifiedName: `${m[1]}.${m[2]}`.toLowerCase(),
      };
    }
  }
  return null;
}

module.exports = {
  getWorkspaceIndex,
  invalidateIndex,
  registerWorkspaceIndexWatcher,
  resolveCallAtPosition,
  extractDocHeader,
};
