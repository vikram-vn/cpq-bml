let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      showInputBox: async () => '',
      showQuickPick: async () => null,
      showInformationMessage: () => {},
      showErrorMessage: () => {},
      showWarningMessage: () => {},
      showTextDocument: async () => {},
      withProgress: async (opt, task) => task({ report: () => {} }),
      createOutputChannel: () => ({ appendLine: () => {}, show: () => {} })
    },
    commands: {
      registerCommand: () => ({ dispose: () => {} }),
      executeCommand: () => {}
    },
    workspace: {
      workspaceFolders: [],
      openTextDocument: async () => ({})
    },
    Uri: {
      file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
    },
    Position: function (line, char) {
      this.line = line;
      this.character = char;
    },
    Range: function (start, end) {
      this.start = start;
      this.end = end;
    }
  };
}

const fs = require('fs');
const path = require('path');
const api = require('@/lang/rest/api');
const { isConfigured, getSettings } = require('@/lang/rest/config');

/**
 * Recursively scans directory for .bml files.
 */
function findWorkspaceBmlFiles(dir, maxDepth = 6, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findWorkspaceBmlFiles(full, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && (entry.name.endsWith('.bml') || entry.name.endsWith('.bmlt'))) {
        results.push(full);
      }
    }
  } catch {
    // Ignore read errors
  }
  return results;
}

/**
 * Searches local workspace .bml files for query string.
 */
function searchLocalWorkspaceBml(workspaceRoot, query) {
  const matches = [];
  const files = findWorkspaceBmlFiles(workspaceRoot);
  const lower = query.toLowerCase();

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        if (lineText.toLowerCase().includes(lower)) {
          matches.push({
            file: filePath,
            relPath: path.relative(workspaceRoot, filePath).replace(/\\/g, '/'),
            line: i + 1,
            lineText: lineText.trim(),
            source: 'Local Workspace'
          });
        }
      }
    } catch {
      // Ignore file read error
    }
  }

  return matches;
}

/**
 * Interactive Global BML Search runner across entire CPQ system.
 */
async function runGlobalBmlSearch(context, vscodeInstance = vscode, prefilledQuery) {
  let query = prefilledQuery;
  if (!query) {
    query = await vscodeInstance.window.showInputBox({
      prompt: 'Search BML scripts across entire CPQ system',
      placeHolder: 'e.g. calculateDiscount, urldata, myCustomUtil...',
      ignoreFocusOut: true
    });
  }

  if (!query || !query.trim()) {
    return;
  }
  query = query.trim();

  const folders = vscodeInstance.workspace.workspaceFolders;
  const workspaceRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : null;

  await vscodeInstance.window.withProgress({
    location: 15,
    title: `Searching CPQ system for "${query}"...`,
    cancellable: false
  }, async (progress) => {
    let cloudResults = [];
    let cloudAvailable = false;

    if (isConfigured(vscodeInstance)) {
      progress.report({ message: 'Querying CPQ Cloud 26A+ Search API...' });
      try {
        const res = await api.searchBmlScripts(context, vscodeInstance, {
          query,
          limit: 100
        });

        if (res.statusCode >= 200 && res.statusCode < 300) {
          cloudAvailable = true;
          let parsed = res.body;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
          }
          const items = Array.isArray(parsed) ? parsed : ((parsed && parsed.items) || []);
          cloudResults = items.map(it => {
            const snippet = it.snippet || (it.scriptText ? it.scriptText.slice(0, 120).trim() : '');
            let name = it.name || it.variableName || it.scriptName;
            let type = it.componentType || it.scriptType;
            let proc = it.commerceProcess || '';
            let doc = it.commerceDocument || '';

            // Handle Swagger globalScript 'path' property (e.g. "Util/math/calc" or "Commerce/oraclecpqo/transaction/actions/cleanSave_t")
            if (it.path && typeof it.path === 'string') {
              const parts = it.path.split('/');
              if (!name) name = parts[parts.length - 1];
              if (!type) type = parts[0];
              if (!proc && parts.length > 2) proc = parts[1];
              if (!doc && parts.length > 3) doc = parts[2];
            }
            if (!name) name = 'Script';
            if (!type) type = 'Cloud Script';

            return {
              name,
              type,
              process: proc,
              document: doc,
              snippet,
              scriptText: it.scriptText,
              source: 'CPQ Cloud',
              path: it.path,
              raw: it
            };
          });
        }
      } catch {
        // Fall back to local search
      }
    }

    // Local workspace search
    progress.report({ message: 'Searching local BML workspace...' });
    const localResults = workspaceRoot ? searchLocalWorkspaceBml(workspaceRoot, query) : [];

    // Combine results for quick pick
    const quickPickItems = [];

    // Add Cloud Results
    if (cloudResults.length > 0) {
      quickPickItems.push({
        label: `Cloud Matches (${cloudResults.length})`,
        kind: -1 // Separator
      });

      for (const item of cloudResults) {
        quickPickItems.push({
          label: `$(cloud) ${item.name}`,
          description: `[${item.type}] ${item.process ? item.process + '/' + item.document : ''}`,
          detail: item.snippet || 'Click to view full BML script',
          data: item
        });
      }
    }

    // Add Local Results
    if (localResults.length > 0) {
      quickPickItems.push({
        label: `Local Workspace Matches (${localResults.length})`,
        kind: -1 // Separator
      });

      for (const item of localResults) {
        quickPickItems.push({
          label: `$(file-code) ${path.basename(item.file)}:${item.line}`,
          description: item.relPath,
          detail: item.lineText,
          data: item
        });
      }
    }

    if (quickPickItems.length === 0) {
      vscodeInstance.window.showInformationMessage(`No matches found for "${query}" across CPQ system.`);
      return;
    }

    // Show interactive quick pick
    const selected = await vscodeInstance.window.showQuickPick(quickPickItems, {
      placeHolder: `Found ${cloudResults.length} cloud & ${localResults.length} local matches for "${query}"`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected || !selected.data) return;

    const data = selected.data;
    if (data.file) {
      // Local workspace file match -> open at line
      const doc = await vscodeInstance.workspace.openTextDocument(vscodeInstance.Uri.file(data.file));
      const editor = await vscodeInstance.window.showTextDocument(doc);
      if (editor && data.line && vscodeInstance.Position && vscodeInstance.Range) {
        const pos = new vscodeInstance.Position(data.line - 1, 0);
        editor.selection = new vscodeInstance.Range(pos, pos);
        if (typeof editor.revealRange === 'function') {
          editor.revealRange(new vscodeInstance.Range(pos, pos));
        }
      }
    } else if (data.scriptText) {
      // Cloud script content -> open as document
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: data.scriptText,
        language: 'bml'
      });
      await vscodeInstance.window.showTextDocument(doc);
    } else if (data.raw) {
      // Other cloud payload
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: JSON.stringify(data.raw, null, 2),
        language: 'json'
      });
      await vscodeInstance.window.showTextDocument(doc);
    }
  });
}

function registerCloudGlobalSearch(context, vscodeInstance = vscode) {
  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.globalSearch', (prefilled) => {
    return runGlobalBmlSearch(context, vscodeInstance, typeof prefilled === 'string' ? prefilled : undefined);
  });

  context.subscriptions.push(searchCmd);
  return { searchCmd };
}

module.exports = {
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
  runGlobalBmlSearch,
  registerCloudGlobalSearch
};
