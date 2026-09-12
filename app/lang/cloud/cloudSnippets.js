const { vscode } = require('./cloudVscodeShim');

/**
 * Inserts snippet or text at the active editor's cursor position.
 * If no editor is open, writes to system clipboard and notifies user.
 */
async function insertTextAtActiveCursor(text, vscodeInstance = vscode) {
  if (!text || typeof text !== 'string') return;

  const editor = vscodeInstance?.window?.activeTextEditor;
  if (editor && editor.document) {
    await editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, text);
      } else {
        editBuilder.replace(editor.selection, text);
      }
    });

    if (vscodeInstance?.env?.clipboard?.writeText) {
      vscodeInstance.env.clipboard.writeText(text);
    }
    if (vscodeInstance?.window?.setStatusBarMessage) {
      vscodeInstance.window.setStatusBarMessage(`CPQ-BML: Inserted "${text}" at cursor`, 3000);
    }
  } else {
    if (vscodeInstance?.env?.clipboard?.writeText) {
      await vscodeInstance.env.clipboard.writeText(text);
    }
    if (vscodeInstance?.window?.showInformationMessage) {
      vscodeInstance.window.showInformationMessage(`Copied "${text}" to clipboard`);
    }
  }
}

/**
 * Generates a production-ready, type-safe BMQL query block for a Data Table.
 */
function generateBmqlQuerySnippet(tableName, columns = []) {
  const cleanTable = (tableName || 'my_table').trim();
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : [];

  let selectCols = '*';
  let whereCol = 'id';
  let whereVar = 'id_param';
  let sampleLoop = '    // process row fields\n';

  if (cols.length > 0) {
    const colNames = cols.map((c) => (typeof c === 'string' ? c : c.name || c.variableName)).filter(Boolean);
    if (colNames.length > 0) {
      selectCols = colNames.slice(0, 6).join(', ');
    }

    const pkCol = cols.find((c) => c && c.isPrimaryKey);
    if (pkCol && pkCol.name) {
      whereCol = pkCol.name;
      whereVar = `${pkCol.name}_param`;
    } else if (colNames[0]) {
      whereCol = colNames[0];
      whereVar = `${colNames[0]}_param`;
    }

    const sampleCols = cols.slice(0, 2);
    sampleLoop = sampleCols
      .map((c) => {
        const name = typeof c === 'string' ? c : c.name;
        const rawType = (typeof c === 'object' && c.type) ? c.type.toLowerCase() : 'string';
        let bmlType = 'String';
        if (rawType.includes('int') || rawType.includes('number')) bmlType = 'Integer';
        else if (rawType.includes('float') || rawType.includes('double') || rawType.includes('currency')) bmlType = 'Float';
        return `    ${bmlType} ${name}Val = get(row, "${name}");`;
      })
      .join('\n');
    if (sampleLoop) sampleLoop += '\n';
  }

  return `// BMQL Query: ${cleanTable}\n` +
    `results = bmql("SELECT ${selectCols} FROM ${cleanTable} WHERE ${whereCol} = $${whereVar}");\n` +
    `for row in results {\n` +
    `${sampleLoop}` +
    `}\n`;
}

/**
 * Generates canonical CPQ syntax accessor for an attribute.
 */
function generateAttributeSnippet(attr, domain = 'commerce') {
  if (!attr) return '';
  const varName = typeof attr === 'string' ? attr : attr.variableName || attr.name || '';
  if (!varName) return '';

  if (domain === 'config') {
    return `getconfigattr("${varName}")`;
  }
  if (domain === 'line') {
    return `docNum + "|${varName}|" + ${varName}Val + "|"`;
  }
  return `get(transaction, "${varName}")`;
}

module.exports = {
  insertTextAtActiveCursor,
  generateBmqlQuerySnippet,
  generateAttributeSnippet,
};
