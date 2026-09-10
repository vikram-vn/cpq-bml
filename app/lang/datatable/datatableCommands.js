let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {},
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    Uri: { file: (f) => ({ fsPath: f }) }
  };
}

const fs = require('fs');
const path = require('path');
const { SchemaInferrer } = require('./schemaInferrer');

/**
 * Registers commands for Data Table CSV schema inference and conversion.
 */
function registerDataTableCommands(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.inferDataTableSchema', async (uri) => {
    let targetPath = uri ? uri.fsPath : null;

    if (!targetPath) {
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'CSV Files': ['csv', 'txt'] },
        openLabel: 'Infer Data Table Schema'
      });
      if (!files || files.length === 0) return;
      targetPath = files[0].fsPath;
    }

    try {
      const csvText = fs.readFileSync(targetPath, 'utf8');
      const baseName = path.basename(targetPath, path.extname(targetPath));
      const tableName = baseName.replace(/[^a-zA-Z0-9_]/g, '_');

      const dtSchema = SchemaInferrer.inferFromCsv(csvText, tableName);

      const outDir = path.dirname(targetPath);
      const outJsonPath = path.join(outDir, `${tableName}.dt.json`);

      fs.writeFileSync(outJsonPath, JSON.stringify(dtSchema, null, 2), 'utf8');

      const choice = await vscode.window.showInformationMessage(
        `Successfully generated Data Table schema '${tableName}.dt.json' (${dtSchema.columns.length} columns, ${dtSchema.records.length} records).`,
        'Open in Data Table Editor',
        'Open JSON File'
      );

      const outUri = vscode.Uri.file(outJsonPath);
      if (choice === 'Open in Data Table Editor') {
        await vscode.commands.executeCommand('vscode.openWith', outUri, 'cpqBml.dataTableEditor');
      } else if (choice === 'Open JSON File') {
        const doc = await vscode.workspace.openTextDocument(outUri);
        await vscode.window.showTextDocument(doc);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to infer schema: ${err.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

module.exports = { registerDataTableCommands };
