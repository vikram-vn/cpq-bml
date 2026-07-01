const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { Beautifier } = require('./bml/beautifier');
const optionsProvider = require('./options');

const IGNORED_FOLDERS = new Set(['node_modules', '.git', '.vscode-test', 'dist', 'out']);

/**
 * Recursively collect all *.bml files under a directory.
 */
async function collectBmlFiles(dir, result = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const nameLower = entry.name.toLowerCase();
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_FOLDERS.has(nameLower)) {
        await collectBmlFiles(full, result);
      }
    } else if (entry.isFile() && nameLower.endsWith('.bml')) {
      result.push(full);
    }
  }
  return result;
}

/**
 * Recursively collect all subfolders under a directory.
 */
async function collectFolders(dir, result = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const nameLower = entry.name.toLowerCase();
    if (entry.isDirectory() && !IGNORED_FOLDERS.has(nameLower)) {
      const full = path.join(dir, entry.name);
      result.push(full);
      await collectFolders(full, result);
    }
  }
  return result;
}


/**
 * Beautify a single BML file.
 */
async function beautifyFile(filePath) {
  const src = await fs.promises.readFile(filePath, 'utf8');
  const cfg = await optionsProvider({ uri: { fsPath: filePath } }, { tabSize: 4 });
  const finalContent = Beautifier(src, cfg).beautify();
  if (src !== finalContent) {
    await fs.promises.writeFile(filePath, finalContent, 'utf8');
    return true;
  }
  return false;
}

/**
 * VS Code command that beautifies every BML file in the current workspace.
 */
/**
 * VS Code command that beautifies BML files in selected workspace folder(s).
 */
async function beautifyWorkspaceCommand() {
  if (!vscode.workspace.getConfiguration('cpqBml').get('features.beautifier', true)) {
    vscode.window.showWarningMessage('BML Beautifier is disabled in settings.');
    return;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('No workspace folder open.');
    return;
  }

  // Build a flat list of all folders (roots + subfolders) across the workspace
  const allFolderInfos = [];
  for (const wsFolder of folders) {
    const root = wsFolder.uri.fsPath;
    // include the root itself
    allFolderInfos.push({ label: wsFolder.name, description: root, uri: root });
    // collect subfolders recursively
    const subfolders = await collectFolders(root);
    for (const sub of subfolders) {
      const rel = path.relative(root, sub);
      allFolderInfos.push({
        label: `${wsFolder.name}/${rel}`,
        description: sub,
        uri: sub
      });
    }
  }

  const picks = await vscode.window.showQuickPick(
    allFolderInfos.map(f => ({ label: f.label, description: f.description, uri: f.uri })),
    {
      canPickMany: true,
      placeHolder: 'Select folder(s) to beautify (roots or sub‑folders)'
    }
  );
  if (!picks || picks.length === 0) {
    vscode.window.showInformationMessage('No folder selected.');
    return;
  }
  const targets = picks.map(p => ({ uri: { fsPath: p.uri } }));

  // Gather all BML files from the selected folders and de-duplicate them.
  const filePaths = new Set();
  const fileToRoot = new Map();
  for (const f of targets) {
    const root = f.uri.fsPath;
    const files = await collectBmlFiles(root);
    for (const file of files) {
      if (!filePaths.has(file)) {
        filePaths.add(file);
        fileToRoot.set(file, root);
      }
    }
  }

  const allFiles = Array.from(filePaths).map(file => ({ file, root: fileToRoot.get(file) }));
  const totalFiles = allFiles.length;
  let changed = 0;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Beautifying BML files…',
      cancellable: false
    },
    async (progress) => {
      for (let i = 0; i < totalFiles; i++) {
        const { file, root } = allFiles[i];
        progress.report({ message: path.relative(root, file), increment: (1 / totalFiles) * 100 });
        if (await beautifyFile(file)) changed++;
      }
      vscode.window.showInformationMessage(
        `Beautified ${totalFiles} BML file(s). ${changed} file(s) were updated.`
      );
    }
  );
}

module.exports = { beautifyWorkspaceCommand, collectBmlFiles, collectFolders, beautifyFile };
