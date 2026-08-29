let vscode;
try {
    vscode = require('vscode');
} catch {
    vscode = {};
}
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
const IGNORED_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.vscode-test',
  '.agents',
  'dist',
  'out',
  'build',
  'coverage',
  '.gemini',
  'target',
  'vendor',
  'scratch',
  'logs',
  '.system_generated',
  'venv',
  '.venv',
  '__pycache__',
  '.pytest_cache',
  'scripts',
  'docs',
  'doc',
  'test',
  'tests',
  'images',
  'media',
  'assets',
  'resources',
  'typings',
  'schemas',
  'app',
  'knowledge',
  'themes',
  '.github'
]);

const sharedBuffer = Buffer.allocUnsafe(2048);

/**
 * Fast read of the first 2KB of a file for header comments and definition line.
 */
function readHeaderSlice(filePath) {
  let fd = -1;
  try {
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, sharedBuffer, 0, 2048, 0);
    fs.closeSync(fd);
    fd = -1;
    return sharedBuffer.toString('utf8', 0, bytesRead);
  } catch {
    if (fd !== -1) {
      try { fs.closeSync(fd); } catch {}
    }
    return '';
  }
}

/**
 * Extract the docHeader block comment from the top of a BML file.
 * Looks for a * ... * block containing "Function Name:" or "Description:".
 */
function extractDocHeader(headerSlice) {
  if (
    !headerSlice.includes("/*") ||
    (!headerSlice.includes("Function Name:") &&
      !headerSlice.includes("Description:") &&
      !headerSlice.includes("function name:") &&
      !headerSlice.includes("description:"))
  ) {
    return "";
  }
  const blockMatch =
    headerSlice.match(/\/\*[\s\S]*?Function Name:[\s\S]*?\*\//i) ||
    headerSlice.match(/\/\*[\s\S]*?Description:[\s\S]*?\*\//i);
  if (!blockMatch) return "";
  return blockMatch[0]
    .replace(/^\/\*+\s*/m, "")
    .replace(/\s*\*+\/$/m, "")
    .replace(/^\s*\*\s?/gm, "")
    .trim();
}

/**
 * Parse parameters and returnType from a -meta.json sidecar in a single disk read.
 * Returns { parameters, returnType }.
 */
function parseMetaSidecar(metaPath) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const params = meta.params || meta.parameters || [];
    const parameters = params.map((p) => ({
      name: p.name || p.variableName || "",
      dataType: p.dataType || p.type || "",
    }));
    const returnType = meta.returnType || meta.returnDataType || "";
    return { parameters, returnType };
  } catch {
    return { parameters: [], returnType: "" };
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
    const rootPath = folder.uri.fsPath;
    let targeted = false;

    const bmlDir = path.join(rootPath, 'bml');
    if (fs.existsSync(bmlDir)) {
      scanDir(bmlDir, index);
      targeted = true;
    }
    const libDir = path.join(rootPath, 'library');
    if (fs.existsSync(libDir)) {
      scanDir(libDir, index);
      targeted = true;
    }
    const commDir = path.join(rootPath, 'commerce');
    if (fs.existsSync(commDir)) {
      scanDir(commDir, index);
      targeted = true;
    }
    const utilDir = path.join(rootPath, 'util');
    if (fs.existsSync(utilDir)) {
      scanDir(utilDir, index);
      targeted = true;
    }

    if (!targeted) {
      try {
        scanDir(rootPath, index);
      } catch (e) {
        // Non-fatal
      }
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

  const normalizedDir = dir.replace(/\\/g, "/");
  const isUtilRoot = /\/library$|\/util$/i.test(normalizedDir);
  const isCommerceRoot = /\/commerce$/i.test(normalizedDir);

  if (isUtilRoot || isCommerceRoot) {
    const prefix = isUtilRoot ? "util" : "commerce";
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.name.charCodeAt(0) === 46) continue;
      if (entry.isDirectory()) {
        const baseName = entry.name;
        const bmlPath = path.join(dir, baseName, baseName + ".bml");
        const metaPath = path.join(dir, baseName, baseName + "-meta.json");
        indexBmlFile(bmlPath, prefix, baseName, metaPath, index);
      } else if (entry.isFile() && entry.name.endsWith(".bml") && !/(-AI|_ai)\.bml$/i.test(entry.name)) {
        const baseName = entry.name.slice(0, -4);
        const metaPath = path.join(dir, baseName + "-meta.json");
        indexBmlFile(path.join(dir, entry.name), prefix, baseName, metaPath, index);
      }
    }
    return;
  }

  const metaFiles = new Set();
  const bmlFiles = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.name.charCodeAt(0) === 46) continue; // '.' skip hidden dirs
    const nameLower = entry.name.toLowerCase();
    if (IGNORED_FOLDERS.has(nameLower)) continue;

    if (entry.isDirectory()) {
      scanDir(path.join(dir, entry.name), index);
    } else if (entry.isFile()) {
      if (entry.name.endsWith("-meta.json")) {
        metaFiles.add(entry.name);
      } else if (
        entry.name.endsWith(".bml") &&
        !/(-AI|_ai)\.bml$/i.test(entry.name)
      ) {
        bmlFiles.push(entry.name);
      }
    }
  }

  if (bmlFiles.length === 0) return;

  const isUtil = /\/library\/|\/util\//i.test(normalizedDir);
  const isCommerce = /\/commerce\//i.test(normalizedDir);
  const prefix = isUtil ? "util" : isCommerce ? "commerce" : null;
  if (!prefix) return;

  for (let i = 0; i < bmlFiles.length; i++) {
    const bmlName = bmlFiles[i];
    const fullPath = path.join(dir, bmlName);
    const baseName = bmlName.slice(0, -4);
    const metaPath = metaFiles.has(baseName + "-meta.json") ? path.join(dir, baseName + "-meta.json") : null;
    indexBmlFile(fullPath, prefix, baseName, metaPath, index);
  }
}

function indexBmlFile(filePath, prefix, baseName, metaPath, index) {
  const headerSlice = readHeaderSlice(filePath);
  if (!headerSlice) return;

  const qualifiedName = `${prefix}.${baseName}`;
  const docHeader = extractDocHeader(headerSlice);

  // Find the first non-comment, non-empty line as the definition line from head slice
  let defLine = 0;
  const lines = headerSlice.split(/\r?\n/);
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
    docHeader,
    _parameters: null,
    _returnType: null,
    get parameters() {
      if (this._parameters === null) {
        const sidecar = metaPath ? parseMetaSidecar(metaPath) : { parameters: [], returnType: "" };
        this._parameters = sidecar.parameters;
        this._returnType = sidecar.returnType;
      }
      return this._parameters;
    },
    get returnType() {
      if (this._returnType === null) {
        const sidecar = metaPath ? parseMetaSidecar(metaPath) : { parameters: [], returnType: "" };
        this._parameters = sidecar.parameters;
        this._returnType = sidecar.returnType;
      }
      return this._returnType;
    },
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
