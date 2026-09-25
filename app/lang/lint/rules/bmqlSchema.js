let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    Diagnostic: function (range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    },
    DiagnosticSeverity: { Error: 0, Warning: 1 },
    Range: function (startLine, startCol, endLine, endCol) {
      this.start = { line: startLine, character: startCol };
      this.end = { line: endLine, character: endCol };
    }
  };
}

const { resolveAvailableTables } = require('@/lang/bmql/bmqlIntellisense');

function getLineAndCol(text, offset) {
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  return { line, character: offset - (lastNewline + 1) };
}

function checkBmqlSchema(cleanText, doc, vscodeInstance = vscode) {
  const diagnostics = [];
  if (!cleanText || !cleanText.includes('bmql')) return diagnostics;

  let wsRoot = null;
  if (doc && doc.uri && vscodeInstance.workspace && typeof vscodeInstance.workspace.getWorkspaceFolder === 'function') {
    const folder = vscodeInstance.workspace.getWorkspaceFolder(doc.uri);
    if (folder) wsRoot = folder.uri.fsPath;
  }
  if (!wsRoot && vscodeInstance.workspace && vscodeInstance.workspace.workspaceFolders && vscodeInstance.workspace.workspaceFolders.length > 0) {
    wsRoot = vscodeInstance.workspace.workspaceFolders[0].uri.fsPath;
  }

  const availableTables = resolveAvailableTables(wsRoot);
  if (!availableTables || availableTables.size === 0) {
    return diagnostics;
  }

  // Regex to match bmql("...") or bmql('...')
  const bmqlRegex = /\bbmql\s*\(\s*(["'])([\s\S]*?)\1\s*\)/gi;
  let match;

  while ((match = bmqlRegex.exec(cleanText)) !== null) {
    const rawQuery = match[2];
    const queryOffset = match.index + match[0].indexOf(rawQuery);

    // Extract table name
    const fromMatch = rawQuery.match(/\b(?:FROM|MODIFY|TABLE)\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) continue;

    const tableName = fromMatch[1];
    const tableData = availableTables.get(tableName.toLowerCase());

    if (!tableData) {
      const tableIdxInQuery = rawQuery.indexOf(tableName);
      const absOffset = queryOffset + tableIdxInQuery;
      const startPos = getLineAndCol(cleanText, absOffset);
      const endPos = getLineAndCol(cleanText, absOffset + tableName.length);

      const d = new vscodeInstance.Diagnostic(
        new vscodeInstance.Range(startPos.line, startPos.character, endPos.line, endPos.character),
        `BMQL references unknown Data Table '${tableName}'. Verify table name or pull Data Tables from CPQ.`,
        vscodeInstance.DiagnosticSeverity.Warning
      );
      d.code = 'bml-bmql-unknown-table';
      diagnostics.push(d);
      continue;
    }

    // Table exists: validate columns in SELECT clause
    if (tableData.columns && Array.isArray(tableData.columns) && tableData.columns.length > 0) {
      const validColNames = new Set(tableData.columns.map(c => (typeof c === 'string' ? c : c.name || '').toLowerCase()));
      const selectMatch = rawQuery.match(/\bSELECT\s+([\s\S]*?)\s+\bFROM\b/i);

      if (selectMatch) {
        const selectColsRaw = selectMatch[1];
        const selectColsOffset = queryOffset + rawQuery.indexOf(selectColsRaw);
        const colTokens = selectColsRaw.split(',');

        let currentSearchOffset = 0;
        for (const token of colTokens) {
          const colTrimmed = token.trim();
          const tokenOffsetInSelect = selectColsRaw.indexOf(colTrimmed, currentSearchOffset);
          if (tokenOffsetInSelect !== -1) {
            currentSearchOffset = tokenOffsetInSelect + colTrimmed.length;
          }

          if (!colTrimmed || colTrimmed === '*' || colTrimmed.startsWith('$')) continue;

          // Strip alias if present e.g. "col AS myAlias"
          const pureCol = colTrimmed.split(/\s+as\s+/i)[0].trim();
          if (!pureCol || pureCol === '*') continue;

          if (!validColNames.has(pureCol.toLowerCase())) {
            const absOffset = selectColsOffset + (tokenOffsetInSelect !== -1 ? tokenOffsetInSelect : 0);
            const startPos = getLineAndCol(cleanText, absOffset);
            const endPos = getLineAndCol(cleanText, absOffset + pureCol.length);

            const displayCols = tableData.columns.slice(0, 5).map(c => (typeof c === 'string' ? c : c.name || '')).filter(Boolean).join(', ');
            const d = new vscodeInstance.Diagnostic(
              new vscodeInstance.Range(startPos.line, startPos.character, endPos.line, endPos.character),
              `Column '${pureCol}' does not exist on Data Table '${tableName}' (available: ${displayCols}...)`,
              vscodeInstance.DiagnosticSeverity.Error
            );
            d.code = 'bml-bmql-invalid-column';
            diagnostics.push(d);
          }
        }
      }
    }
  }

  return diagnostics;
}

module.exports = {
  checkBmqlSchema
};
