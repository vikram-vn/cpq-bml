let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    CompletionItem: function (label, kind) {
      this.label = label;
      this.kind = kind;
    },
    CompletionItemKind: {
      Class: 7,
      Field: 5,
      Operator: 24,
      Variable: 6,
      Keyword: 14,
      Value: 12
    },
    MarkdownString: function (val) {
      this.value = val;
    }
  };
}

const fs = require('fs');
const path = require('path');
const { collectLocalVariables } = require('@/lang/intellisense/bmqlVariableCompletions');

const BMQL_OPERATORS = [
  { label: '==', detail: 'Equals comparison', insertText: '== ' },
  { label: '!=', detail: 'Not equals comparison', insertText: '!= ' },
  { label: '<', detail: 'Less than comparison', insertText: '< ' },
  { label: '<=', detail: 'Less than or equal', insertText: '<= ' },
  { label: '>', detail: 'Greater than comparison', insertText: '> ' },
  { label: '>=', detail: 'Greater than or equal', insertText: '>= ' },
  { label: 'LIKE', detail: 'Pattern matching operator', insertText: "LIKE '%$1%'" },
  { label: 'IN', detail: 'Set membership operator', insertText: 'IN ($1)' },
  { label: 'IS NULL', detail: 'Check for null value', insertText: 'IS NULL' },
  { label: 'IS NOT NULL', detail: 'Check for non-null value', insertText: 'IS NOT NULL' }
];

const BMQL_KEYWORDS = [
  { label: 'SELECT', detail: 'BMQL projection clause', insertText: 'SELECT ' },
  { label: 'FROM', detail: 'BMQL table source clause', insertText: 'FROM ' },
  { label: 'WHERE', detail: 'BMQL filter condition clause', insertText: 'WHERE ' },
  { label: 'ORDER BY', detail: 'BMQL sorting clause', insertText: 'ORDER BY ' },
  { label: 'AND', detail: 'Logical conjunction', insertText: 'AND ' },
  { label: 'OR', detail: 'Logical disjunction', insertText: 'OR ' },
  { label: 'SET', detail: 'BMQL update assignment clause', insertText: 'SET ' },
  { label: 'MODIFY', detail: 'BMQL modification clause', insertText: 'MODIFY ' },
  { label: 'ASC', detail: 'Ascending sort order', insertText: 'ASC' },
  { label: 'DESC', detail: 'Descending sort order', insertText: 'DESC' }
];

/**
 * Extracts enclosing BMQL query string and cursor offset within it.
 */
function findBmqlQueryAtPosition(document, position) {
  if (!document) return null;

  if (document.languageId === 'bmql') {
    const text = typeof document.getText === 'function' ? document.getText() : '';
    const offset = typeof document.offsetAt === 'function' ? document.offsetAt(position) : (position.character || 0);
    return { queryText: text, cursorOffset: offset };
  }

  const lineText = document.lineAt(position.line).text;
  const col = position.character;

  // 1. Single-line check: bmql("...") or bmql('...')
  const bmqlIdx = lineText.indexOf('bmql(');
  if (bmqlIdx !== -1 && col > bmqlIdx + 5) {
    const quoteChar = lineText[bmqlIdx + 5];
    if (quoteChar === '"' || quoteChar === "'") {
      const startOffset = bmqlIdx + 6;
      let endOffset = lineText.indexOf(quoteChar, startOffset);
      if (endOffset === -1) endOffset = lineText.length;
      if (col >= startOffset && col <= endOffset + 1) {
        return {
          queryText: lineText.substring(startOffset, endOffset),
          cursorOffset: Math.min(col - startOffset, endOffset - startOffset)
        };
      }
    }
  }

  // 2. Multi-line scan: scan backwards to find unclosed bmql(" or bmql('
  if (typeof document.getText === 'function' && typeof document.offsetAt === 'function') {
    const docText = document.getText();
    const docOffset = document.offsetAt(position);
    const searchStart = Math.max(0, docOffset - 3000);
    const sliceBefore = docText.substring(searchStart, docOffset);
    const lastBmql = sliceBefore.lastIndexOf('bmql(');

    if (lastBmql !== -1) {
      const absBmqlIdx = searchStart + lastBmql;
      const quoteChar = docText[absBmqlIdx + 5];
      if (quoteChar === '"' || quoteChar === "'") {
        const queryStart = absBmqlIdx + 6;
        if (docOffset >= queryStart) {
          let queryEnd = docText.indexOf(quoteChar, queryStart);
          if (queryEnd === -1 || queryEnd > docOffset + 3000) {
            queryEnd = Math.min(docText.length, docOffset + 500);
          }
          if (docOffset <= queryEnd + 1) {
            return {
              queryText: docText.substring(queryStart, queryEnd),
              cursorOffset: docOffset - queryStart
            };
          }
        }
      }
    }
  }

  // 3. String query literal: e.g. query = "SELECT ... FROM ..."
  const queryStrMatch = lineText.match(/(["'])(SELECT\s+[\s\S]*?)\1/i);
  if (queryStrMatch) {
    const startOffset = lineText.indexOf(queryStrMatch[0]) + 1;
    const endOffset = startOffset + queryStrMatch[2].length;
    if (col >= startOffset && col <= endOffset + 1) {
      return {
        queryText: queryStrMatch[2],
        cursorOffset: Math.min(col - startOffset, queryStrMatch[2].length)
      };
    }
  }

  return null;
}

/**
 * Parses query text to identify clause and target table relative to cursor.
 */
function parseBmqlCursorContext(queryText = '', cursorOffset = 0) {
  const textBefore = queryText.substring(0, cursorOffset);

  // 1. Check if typing variable substitution
  if (/\$([a-zA-Z_]\w*)?$/.test(textBefore)) {
    return { type: 'SUBSTITUTION', textBefore };
  }

  // 2. Extract table name from entire query if present
  let tableName = null;
  const fromMatch = queryText.match(/\b(?:FROM|MODIFY|TABLE)\s+([a-zA-Z0-9_]+)/i);
  if (fromMatch) {
    tableName = fromMatch[1];
  }

  // 3. Check if cursor is directly after FROM / MODIFY / TABLE (expecting Table Name)
  if (/\b(?:FROM|MODIFY|TABLE)\s+[a-zA-Z0-9_]*$/i.test(textBefore)) {
    return { type: 'TABLE', textBefore, tableName };
  }

  // 4. Check if cursor is inside ORDER BY clause
  if (/\bORDER\s+BY\b[\s\S]*$/i.test(textBefore)) {
    if (/\b[a-zA-Z_]\w*\s+$/i.test(textBefore) && !/\b(?:ORDER|BY)\s+$/i.test(textBefore)) {
      return { type: 'ORDER_DIRECTION', textBefore, tableName };
    }
    return { type: 'ORDER_BY', textBefore, tableName };
  }

  // 5. Check if cursor is inside WHERE clause
  if (/\bWHERE\b[\s\S]*$/i.test(textBefore)) {
    if (/\b[a-zA-Z_]\w*\s+$/i.test(textBefore) && !/\b(?:AND|OR|WHERE|NOT)\s+$/i.test(textBefore)) {
      return { type: 'OPERATOR', textBefore, tableName };
    }
    return { type: 'WHERE', textBefore, tableName };
  }

  // 6. Check if cursor is inside SET clause
  if (/\bSET\b[\s\S]*$/i.test(textBefore) && !/\bWHERE\b/i.test(textBefore)) {
    if (/\b[a-zA-Z_]\w*\s+$/i.test(textBefore) && !/\b(?:SET|,)\s+$/i.test(textBefore)) {
      return { type: 'OPERATOR', textBefore, tableName };
    }
    return { type: 'SET', textBefore, tableName };
  }

  // 7. Check if cursor is inside SELECT clause (expecting Column Names)
  if (/\bSELECT\b[\s\S]*$/i.test(textBefore) && !/\bFROM\b/i.test(textBefore)) {
    return { type: 'COLUMN', textBefore, tableName };
  }

  return { type: 'GENERAL', textBefore, tableName };
}

/**
 * Scans workspace for local .dt.json files and cached remote schemas.
 */
function resolveAvailableTables(workspaceRoot) {
  const tables = new Map();
  if (!workspaceRoot) return tables;

  // 1. Scan for local .dt.json files
  try {
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.dt.json')) {
        const tableName = entry.name.replace(/\.dt\.json$/i, '');
        try {
          const content = JSON.parse(fs.readFileSync(path.join(workspaceRoot, entry.name), 'utf8'));
          const cols = (content.columns || content.fields || []).map(c => ({
            name: c.name || c.variableName || 'col',
            type: c.type || c.dataType || 'String',
            isPrimaryKey: Boolean(c.isPrimaryKey || c.primaryKey)
          }));

          tables.set(tableName.toLowerCase(), {
            name: tableName,
            label: content.name || tableName,
            description: content.description || `Local Data Table (${cols.length} cols)`,
            columns: cols,
            source: 'Local .dt.json'
          });
        } catch {}
      }
    }
  } catch {}

  // 2. Scan cpq/cache/ for cached remote schemas
  const cacheDir = path.join(workspaceRoot, 'cpq', 'cache', 'datatables');
  if (fs.existsSync(cacheDir)) {
    try {
      const files = fs.readdirSync(cacheDir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          const tableName = f.replace(/\.json$/i, '');
          if (!tables.has(tableName.toLowerCase())) {
            try {
              const content = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8'));
              const cols = Array.isArray(content) ? content : (content.columns || []);
              tables.set(tableName.toLowerCase(), {
                name: tableName,
                label: tableName,
                description: `Live CPQ Data Table (${cols.length} cols)`,
                columns: cols,
                source: 'CPQ Cloud'
              });
            } catch {}
          }
        }
      }
    } catch {}
  }

  return tables;
}

/**
 * Intelligent completion for get(record, "field") expressions in BML.
 */
function getRecordFieldCompletions(document, position, tables, vscodeInstance = vscode) {
  const lineText = document.lineAt(position.line).text;
  const prefix = lineText.substring(0, position.character);

  const getMatch = prefix.match(/\b(?:get|getfloat|getint|getdate|getrecord)\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*["']([^"']*)$/);
  if (!getMatch) return [];

  const recordVar = getMatch[1];
  const items = [];

  // Look backward to find loop over recordset: for <recordVar> in <recordsVar>
  let targetTable = null;
  const docText = typeof document.getText === 'function' ? document.getText() : '';
  const loopRegex = new RegExp(`for\\s+${recordVar}\\s+in\\s+([a-zA-Z0-9_]+)`, 'i');
  const loopMatch = docText.match(loopRegex);

  if (loopMatch) {
    const recordsVar = loopMatch[1];
    const bmqlAssignRegex = new RegExp(`${recordsVar}\\s*=\\s*bmql\\s*\\(\\s*["']([\\s\\S]*?)["']\\s*\\)`, 'i');
    const bmqlMatch = docText.match(bmqlAssignRegex);
    if (bmqlMatch) {
      const query = bmqlMatch[1];
      const tableMatch = query.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
      if (tableMatch) targetTable = tableMatch[1];

      // Also suggest projected columns with highest priority
      const selectMatch = query.match(/\bSELECT\s+([\s\S]+?)\s+FROM/i);
      if (selectMatch && selectMatch[1].trim() !== '*') {
        const cols = selectMatch[1].split(',').map(c => c.trim().split(/\s+as\s+/i).pop().trim());
        for (const col of cols) {
          if (!col) continue;
          const item = new vscodeInstance.CompletionItem(col, vscodeInstance.CompletionItemKind.Field);
          item.detail = `Projected Column: ${col}`;
          item.sortText = `0_${col}`;
          items.push(item);
        }
      }
    }
  }

  if (targetTable && tables.has(targetTable.toLowerCase())) {
    const tbl = tables.get(targetTable.toLowerCase());
    for (const col of tbl.columns) {
      if (!items.some(i => i.label === col.name)) {
        const item = new vscodeInstance.CompletionItem(col.name, vscodeInstance.CompletionItemKind.Field);
        item.detail = `${col.type || 'String'} - ${tbl.name}`;
        item.sortText = `1_${col.name}`;
        items.push(item);
      }
    }
  }

  return items;
}

/**
 * Returns intelligent completion items for BMQL queries and record accessors.
 */
function getBmqlIntelligentCompletions(document, position, workspaceRoot, vscodeInstance = vscode) {
  if (!document) return [];

  const tables = resolveAvailableTables(workspaceRoot);
  const recordItems = getRecordFieldCompletions(document, position, tables, vscodeInstance);
  if (recordItems.length > 0) {
    return recordItems;
  }

  const queryInfo = findBmqlQueryAtPosition(document, position);
  if (!queryInfo) {
    return [];
  }

  const context = parseBmqlCursorContext(queryInfo.queryText, queryInfo.cursorOffset);
  const items = [];

  // 1. Table Completions (FROM | or MODIFY |)
  if (context.type === 'TABLE') {
    for (const t of tables.values()) {
      const item = new vscodeInstance.CompletionItem(t.name, vscodeInstance.CompletionItemKind.Class);
      item.detail = `${t.name} (${t.source})`;
      item.documentation = new vscodeInstance.MarkdownString(
        `### Data Table: ${t.name}\n\n${t.description}\n\n**Columns**: ${t.columns.map(c => `\`${c.name}\` (${c.type})`).join(', ')}`
      );
      item.insertText = t.name;
      item.sortText = `0_${t.name}`;
      items.push(item);
    }
    return items;
  }

  // 2. Column Completions (SELECT | FROM Table, WHERE | ..., SET | ...)
  if ((context.type === 'COLUMN' || context.type === 'WHERE' || context.type === 'SET' || context.type === 'ORDER_BY') && context.tableName) {
    const tableData = tables.get(context.tableName.toLowerCase());
    if (tableData && tableData.columns.length > 0) {
      for (const col of tableData.columns) {
        const item = new vscodeInstance.CompletionItem(col.name, vscodeInstance.CompletionItemKind.Field);
        item.detail = `${col.type || 'String'}${col.isPrimaryKey ? ' [PK]' : ''} - ${tableData.name}`;
        item.documentation = new vscodeInstance.MarkdownString(
          `Column \`${col.name}\` from table \`${tableData.name}\`\n\nType: \`${col.type}\`${col.isPrimaryKey ? '\n\n**Primary Key**' : ''}`
        );
        item.insertText = col.name;
        item.sortText = col.isPrimaryKey ? `0_${col.name}` : `1_${col.name}`;
        items.push(item);
      }
    }
  }

  // 3. Operator Completions
  if (context.type === 'OPERATOR') {
    for (const op of BMQL_OPERATORS) {
      const item = new vscodeInstance.CompletionItem(op.label, vscodeInstance.CompletionItemKind.Operator);
      item.detail = op.detail;
      item.insertText = op.insertText;
      items.push(item);
    }
    return items;
  }

  // 4. Order direction completions
  if (context.type === 'ORDER_DIRECTION') {
    for (const dir of ['ASC', 'DESC']) {
      const item = new vscodeInstance.CompletionItem(dir, vscodeInstance.CompletionItemKind.Keyword);
      item.detail = `${dir} sorting order`;
      item.insertText = dir;
      items.push(item);
    }
    return items;
  }

  // 5. WHERE / SET clause additional keywords and substitution variables
  if (context.type === 'WHERE' || context.type === 'SET' || context.type === 'SUBSTITUTION') {
    if (context.type === 'WHERE') {
      for (const kw of BMQL_KEYWORDS.filter(k => k.label === 'AND' || k.label === 'OR')) {
        const item = new vscodeInstance.CompletionItem(kw.label, vscodeInstance.CompletionItemKind.Keyword);
        item.detail = kw.detail;
        item.insertText = kw.insertText;
        items.push(item);
      }
    }

    const localVars = collectLocalVariables(document, position);
    for (const v of localVars) {
      const item = new vscodeInstance.CompletionItem(`$${v.name}`, vscodeInstance.CompletionItemKind.Variable);
      item.detail = `Substitution Variable ($${v.name})`;
      item.insertText = `$${v.name}`;
      item.sortText = `2_${v.name}`;
      items.push(item);
    }
  }

  return items;
}

module.exports = {
  BMQL_OPERATORS,
  BMQL_KEYWORDS,
  findBmqlQueryAtPosition,
  parseBmqlCursorContext,
  resolveAvailableTables,
  getRecordFieldCompletions,
  getBmqlIntelligentCompletions
};
