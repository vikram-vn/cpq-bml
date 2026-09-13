const { vscode, safeParseJson, extractStringValue } = require('./cloudVscodeShim');
const api = require('@/lang/rest/api');
const { isConfigured } = require('@/lang/rest/config');
const { describeError } = require('@/lang/rest/commands/shared');

/**
 * Extracts a BMQL query string from either active selection or surrounding code at position.
 */
function extractBmqlQueryAtCursor(document, position) {
  if (!document) return null;

  const text = document.getText();

  // 1. If position given, search for surrounding bmql("...")
  if (position) {
    const offset = document.offsetAt(position);
    const bmqlRegex = /\bbmql\s*\(\s*(["'])([\s\S]*?)\1\s*\)/g;
    let match;
    while ((match = bmqlRegex.exec(text)) !== null) {
      const startIdx = match.index;
      const endIdx = startIdx + match[0].length;
      if (offset >= startIdx && offset <= endIdx) {
        return {
          rawQuery: match[2].trim(),
          range: new vscode.Range(document.positionAt(startIdx), document.positionAt(endIdx))
        };
      }
    }
  }

  // 2. Scan entire document for first bmql query if active file is short or scratchpad
  const firstMatch = text.match(/\bbmql\s*\(\s*(["'])([\s\S]*?)\1\s*\)/);
  if (firstMatch) {
    return {
      rawQuery: firstMatch[2].trim(),
      range: null
    };
  }

  return null;
}

/**
 * Parses a BMQL query into tableName, fields, and optional conditions.
 */
function parseBmqlQuery(query) {
  if (!query || typeof query !== 'string') return null;

  const cleaned = query.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();

  // Match: SELECT <fields> FROM <tableName> [WHERE <condition>] [ORDER BY ...] [LIMIT ...]
  const match = cleaned.match(/\bSELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|;|\s*$)/i);
  if (!match) {
    // Fallback: try to at least find table name
    const fromMatch = cleaned.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
    if (fromMatch) {
      return {
        tableName: fromMatch[1],
        fields: ['*'],
        whereClause: null,
        raw: cleaned
      };
    }
    return null;
  }

  const fieldsRaw = match[1].trim();
  const tableName = match[2].trim();
  const whereClause = match[3] ? match[3].trim() : null;

  const fields = fieldsRaw === '*' ? ['*'] : fieldsRaw.split(',').map(f => f.trim()).filter(Boolean);

  return {
    tableName,
    fields,
    whereClause,
    raw: cleaned
  };
}

/**
 * Executes a BMQL query live against CPQ Data Tables.
 */
async function runBmqlAtCursor(context, vscodeInstance = vscode, options = {}) {
  let queryText = '';

  if (typeof options === 'string') {
    queryText = options;
  } else if (options && typeof options.query === 'string') {
    queryText = options.query;
  }

  const editor = vscodeInstance.window?.activeTextEditor;

  if (!queryText && editor) {
    const selection = editor.selection;
    if (selection && !selection.isEmpty) {
      queryText = editor.document.getText(selection).trim();
    } else if (selection) {
      const extracted = extractBmqlQueryAtCursor(editor.document, selection.active);
      if (extracted) {
        queryText = extracted.rawQuery;
      }
    }
  }

  if (!queryText) {
    queryText = await vscodeInstance.window.showInputBox({
      title: 'Run BMQL Query Live on CPQ',
      prompt: 'Enter BMQL SELECT statement to query Data Tables directly on CPQ',
      placeHolder: 'e.g. SELECT * FROM PricingTiers or SELECT partNumber, listPrice FROM PartsTable',
      ignoreFocusOut: true
    });
  }

  if (!queryText || !queryText.trim()) {
    return { success: false, reason: 'Query cancelled or empty' };
  }

  queryText = queryText.trim();
  const parsed = parseBmqlQuery(queryText);
  if (!parsed || !parsed.tableName) {
    vscodeInstance.window.showErrorMessage(`Could not parse Data Table name from BMQL query: "${queryText}". Expected "SELECT ... FROM TableName".`);
    return { success: false, reason: 'Invalid BMQL query structure' };
  }

  if (!isConfigured(vscodeInstance)) {
    vscodeInstance.window.showWarningMessage('CPQ connection is not configured. Click to configure settings.');
    return { success: false, reason: 'Unconfigured' };
  }

  return await vscodeInstance.window.withProgress({
    location: 15,
    title: `Querying CPQ Data Table '${parsed.tableName}'...`,
    cancellable: false
  }, async () => {
    const startTime = Date.now();
    try {
      const res = await api.getDataTableRows(
        context,
        vscodeInstance,
        parsed.tableName,
        { limit: 200 }
      );

      const elapsed = Date.now() - startTime;

      if (!res || res.statusCode < 200 || res.statusCode >= 300) {
        const errorDesc = describeError(res ? res.body : '');
        const msg = `BMQL Query failed (HTTP ${res?.statusCode || 'Error'}): ${errorDesc || 'Table not found or inaccessible'}`;
        vscodeInstance.window.showErrorMessage(msg);
        return { success: false, statusCode: res?.statusCode, error: msg };
      }

      const parsedBody = safeParseJson(res.body);
      const rows = Array.isArray(parsedBody) ? parsedBody : (parsedBody?.items || []);

      // Filter fields if not '*'
      let filteredRows = rows;
      if (parsed.fields && !parsed.fields.includes('*') && parsed.fields.length > 0) {
        filteredRows = rows.map(r => {
          const projected = {};
          for (const f of parsed.fields) {
            if (r[f] !== undefined) projected[f] = r[f];
          }
          return Object.keys(projected).length > 0 ? projected : r;
        });
      }

      // Display results in JSON document
      const resultPayload = {
        query: queryText,
        dataTable: parsed.tableName,
        recordCount: filteredRows.length,
        executionTimeMs: elapsed,
        timestamp: new Date().toISOString(),
        records: filteredRows
      };

      const doc = await vscodeInstance.workspace.openTextDocument({
        language: 'json',
        content: JSON.stringify(resultPayload, null, 2)
      });
      await vscodeInstance.window.showTextDocument(doc);

      vscodeInstance.window.showInformationMessage(`BMQL: Retrieved ${filteredRows.length} record(s) from '${parsed.tableName}' in ${elapsed}ms.`);
      return {
        success: true,
        tableName: parsed.tableName,
        count: filteredRows.length,
        elapsedMs: elapsed,
        records: filteredRows
      };
    } catch (err) {
      const msg = `BMQL execution error: ${err.message}`;
      vscodeInstance.window.showErrorMessage(msg);
      return { success: false, error: msg };
    }
  });
}

function registerBmqlCommands(context, vscodeInstance = vscode) {
  const runCmd = vscodeInstance.commands.registerCommand('cpqBml.bmql.runAtCursor', (args) => {
    return runBmqlAtCursor(context, vscodeInstance, args);
  });

  context.subscriptions.push(runCmd);
  return { runCmd };
}

module.exports = {
  extractBmqlQueryAtCursor,
  parseBmqlQuery,
  runBmqlAtCursor,
  registerBmqlCommands
};
