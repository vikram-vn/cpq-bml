'use strict';

const fs = require('fs');
const path = require('path');
const { getCommerceProcess } = require('@/lang/rest/config');
const { IGNORED_FOLDERS } = require('@/lang/intellisense/workspaceIndex');

/**
 * Extracts a clean, single-line snippet highlighting the matched query line.
 */
function extractMatchingSnippet(scriptText, query, rawSnippet) {
  const q = (query || '').toLowerCase();

  if (scriptText && typeof scriptText === 'string') {
    const lines = scriptText.split(/\r?\n/);
    if (q) {
      let firstCommentMatch = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && line.toLowerCase().includes(q)) {
          const isComment =
            line.startsWith('//') ||
            line.startsWith('/*') ||
            line.startsWith('*');
          if (!isComment) {
            return {
              lineNum: i + 1,
              snippet: `Line ${i + 1}: ${line}`,
            };
          } else if (!firstCommentMatch) {
            firstCommentMatch = {
              lineNum: i + 1,
              snippet: `Line ${i + 1}: ${line}`,
            };
          }
        }
      }
      if (firstCommentMatch) {
        return firstCommentMatch;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line &&
        !line.startsWith('//') &&
        !line.startsWith('/*') &&
        !line.startsWith('*')
      ) {
        return {
          lineNum: i + 1,
          snippet: `Line ${i + 1}: ${line}`,
        };
      }
    }
    if (lines.length > 0 && lines[0].trim()) {
      return {
        lineNum: 1,
        snippet: lines[0].trim(),
      };
    }
  }

  if (rawSnippet && typeof rawSnippet === 'string') {
    const clean = rawSnippet
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (clean) {
      return {
        lineNum: null,
        snippet: clean.length > 120 ? clean.slice(0, 117) + '...' : clean,
      };
    }
  }

  return { lineNum: null, snippet: '' };
}

/**
 * Detects the active commerce process from open editor or configuration.
 */
function detectActiveProcess(vscodeInstance) {
  try {
    const editor =
      vscodeInstance.window && vscodeInstance.window.activeTextEditor;
    if (
      editor &&
      editor.document &&
      editor.document.uri &&
      editor.document.uri.fsPath
    ) {
      const fsPath = editor.document.uri.fsPath.replace(/\\/g, '/');
      const mCpq = fsPath.match(/\/cpq\/[^/]+\/([^/]+)\//i);
      if (mCpq && mCpq[1]) return mCpq[1];
      const mProc = fsPath.match(
        /\/([^/]+)\/(?:commerce-libraries|actions|rules|sub-documents|documents)\//i,
      );
      if (mProc && mProc[1]) return mProc[1];
    }
  } catch {}
  try {
    const configured = getCommerceProcess(vscodeInstance);
    if (configured) return configured;
  } catch {}
  return 'oraclecpqo';
}

/**
 * Consolidates identical cloud scripts across multiple commerce processes.
 */
function consolidateCloudResults(cloudResults, activeProcess) {
  if (!Array.isArray(cloudResults) || cloudResults.length === 0) return [];
  const groups = new Map();
  const activeProcLower = (activeProcess || '').toLowerCase();

  for (const item of cloudResults) {
    const normName = (item.name || '').trim().toLowerCase();
    const normType = (item.type || '').trim().toLowerCase();
    const normScript = (item.scriptText || '').replace(/\r\n/g, '\n').trim();
    const scriptSig = normScript
      ? `sig:${normScript.length}:${normScript.slice(0, 200)}`
      : `doc:${(item.document || '').toLowerCase()}`;
    const key = `${normName}::${normType}::${scriptSig}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  const consolidated = [];

  for (const items of groups.values()) {
    if (items.length === 1) {
      consolidated.push(items[0]);
      continue;
    }

    let primaryIdx = items.findIndex(
      (it) => it.process && it.process.toLowerCase() === activeProcLower,
    );
    if (primaryIdx === -1 && activeProcLower) {
      primaryIdx = items.findIndex(
        (it) =>
          it.process &&
          (it.process.toLowerCase().includes(activeProcLower) ||
            activeProcLower.includes(it.process.toLowerCase())),
      );
    }
    if (primaryIdx === -1) {
      primaryIdx = 0;
    }

    const primary = { ...items[primaryIdx] };
    const otherProcesses = [];
    for (let i = 0; i < items.length; i++) {
      if (i !== primaryIdx && items[i].process) {
        if (!otherProcesses.includes(items[i].process)) {
          otherProcesses.push(items[i].process);
        }
      }
    }

    primary.otherProcesses = otherProcesses;
    primary.allProcesses = [primary.process, ...otherProcesses].filter(Boolean);
    primary.isConsolidated = otherProcesses.length > 0;
    consolidated.push(primary);
  }

  consolidated.sort((a, b) => {
    const aActive =
      a.process &&
      (a.process.toLowerCase() === activeProcLower ||
        a.process.toLowerCase().includes(activeProcLower))
        ? 1
        : 0;
    const bActive =
      b.process &&
      (b.process.toLowerCase() === activeProcLower ||
        b.process.toLowerCase().includes(activeProcLower))
        ? 1
        : 0;
    if (aActive !== bActive) return bActive - aActive;
    return a.name.localeCompare(b.name);
  });

  return consolidated;
}

/**
 * Recursively scans directory for .bml files.
 */
function findWorkspaceBmlFiles(dir, maxDepth = 6, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.charCodeAt(0) === 46 ||
        IGNORED_FOLDERS.has(entry.name.toLowerCase())
      )
        continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(
          ...findWorkspaceBmlFiles(full, maxDepth, currentDepth + 1),
        );
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.bml') || entry.name.endsWith('.bmlt'))
      ) {
        results.push(full);
      }
    }
  } catch {}
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
            source: 'Local Workspace',
          });
        }
      }
    } catch {}
  }

  return matches;
}

module.exports = {
  extractMatchingSnippet,
  detectActiveProcess,
  consolidateCloudResults,
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
};
