const { vscode, safeParseJson, extractStringValue } = require('./cloudVscodeShim');
const api = require('@/lang/rest/api');
const commerceAttributes = require('@/lang/rest/commerceAttributes');
const { isConfigured } = require('@/lang/rest/config');

/**
 * Looks up attribute, formula, or data table schema at cursor or by keyword.
 */
async function lookupAttributeAtCursor(context, vscodeInstance = vscode, queryWord) {
  let word = typeof queryWord === 'string' && queryWord.trim() ? queryWord.trim() : '';

  if (!word && vscodeInstance.window?.activeTextEditor) {
    const editor = vscodeInstance.window.activeTextEditor;
    const selection = editor.selection;
    if (selection && !selection.isEmpty) {
      word = editor.document.getText(selection).trim();
    } else if (selection) {
      const range = editor.document.getWordRangeAtPosition(selection.active, /[\w$]+/);
      if (range) {
        word = editor.document.getText(range).trim();
      }
    }
  }

  if (!word) {
    word = await vscodeInstance.window.showInputBox({
      title: 'Lookup CPQ Attribute or Data Table Schema',
      prompt: 'Enter attribute variable name (e.g. status_t, totalAmount_t) or Data Table name',
      placeHolder: 'e.g. status_t, accountId_l, PricingTiers...',
      ignoreFocusOut: true
    });
  }

  if (!word || !word.trim()) {
    return { success: false, reason: 'Lookup cancelled or empty' };
  }
  word = word.trim();

  const folders = vscodeInstance.workspace?.workspaceFolders;
  const wsRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : null;

  return await vscodeInstance.window.withProgress({
    location: 15,
    title: `Looking up CPQ schema for "${word}"...`,
    cancellable: false
  }, async () => {
    // 1. Check local / cached commerce attributes
    let directAttr = commerceAttributes.resolveAttributeName ? commerceAttributes.resolveAttributeName(word, wsRoot) : null;
    let searchMatches = commerceAttributes.searchAttributes ? commerceAttributes.searchAttributes(word, wsRoot) : [];

    // 2. Check remote Data Table schema if table-like name or if no attribute found
    let dataTableSchema = null;
    if (isConfigured(vscodeInstance)) {
      try {
        const dtRes = await api.getDataTableSchema(context, vscodeInstance, word);
        if (dtRes && dtRes.statusCode >= 200 && dtRes.statusCode < 300) {
          const body = safeParseJson(dtRes.body);
          if (body && (body.columns || body.fields || body.items)) {
            dataTableSchema = body;
          }
        }
      } catch (_) {}
    }

    if (!directAttr && (!searchMatches || searchMatches.length === 0) && !dataTableSchema) {
      vscodeInstance.window.showInformationMessage(`No CPQ attribute or Data Table definition found matching "${word}".`);
      return { success: false, word };
    }

    // Prepare Markdown / JSON presentation
    const mdLines = [`# CPQ Schema Definition: \`${word}\`\n`];

    if (directAttr || (searchMatches && searchMatches.length > 0)) {
      const best = directAttr || searchMatches[0];
      mdLines.push(`## Attribute Details`);
      mdLines.push(`- **Variable Name**: \`${best.name || best.variableName || word}\``);
      if (best.label) mdLines.push(`- **Label**: ${best.label}`);
      if (best.dataType || best.type) mdLines.push(`- **Data Type**: \`${best.dataType || best.type}\``);
      if (best.document || best.scope) mdLines.push(`- **Document Scope**: \`${best.document || best.scope}\``);
      if (best.process) mdLines.push(`- **Commerce Process**: \`${best.process}\``);
      if (best.description) mdLines.push(`- **Description**: ${best.description}`);
      if (best.defaultValue) mdLines.push(`- **Default Value**: \`${best.defaultValue}\``);
      if (best.menuOptions && Array.isArray(best.menuOptions)) {
        mdLines.push(`\n### Menu Domain Values (${best.menuOptions.length}):`);
        for (const opt of best.menuOptions.slice(0, 20)) {
          mdLines.push(`- \`${opt.value || opt}\`: ${opt.label || opt}`);
        }
        if (best.menuOptions.length > 20) {
          mdLines.push(`- *(and ${best.menuOptions.length - 20} more...)*`);
        }
      }
      mdLines.push('\n---\n');
    }

    if (dataTableSchema) {
      const cols = dataTableSchema.columns || dataTableSchema.fields || dataTableSchema.items || [];
      mdLines.push(`## Data Table: \`${dataTableSchema.name || word}\``);
      if (dataTableSchema.description) mdLines.push(`- **Description**: ${dataTableSchema.description}`);
      mdLines.push(`- **Column Count**: ${cols.length}\n`);
      mdLines.push(`| Column Name | Data Type | Primary Key | Description |`);
      mdLines.push(`| :--- | :--- | :--- | :--- |`);
      for (const col of cols) {
        const cName = col.name || col.variableName || 'col';
        const cType = col.type || col.dataType || 'String';
        const isPk = col.isPrimaryKey || col.primaryKey ? 'Yes (PK)' : 'No';
        const desc = col.description || col.label || '';
        mdLines.push(`| \`${cName}\` | \`${cType}\` | ${isPk} | ${desc} |`);
      }
      mdLines.push('');
    }

    const doc = await vscodeInstance.workspace.openTextDocument({
      language: 'markdown',
      content: mdLines.join('\n')
    });
    return {
      success: true,
      word,
      type: dataTableSchema ? 'dataTable' : 'attribute',
      attribute: directAttr,
      dataTable: dataTableSchema
    };
  });
}

function registerAttributeLookupCommands(context, vscodeInstance = vscode) {
  const lookupCmd = vscodeInstance.commands.registerCommand('cpqBml.rest.lookupAttributeAtCursor', (word) => {
    return lookupAttributeAtCursor(context, vscodeInstance, typeof word === 'string' ? word : undefined);
  });

  context.subscriptions.push(lookupCmd);
  return { lookupCmd };
}

module.exports = {
  lookupAttributeAtCursor,
  registerAttributeLookupCommands
};
