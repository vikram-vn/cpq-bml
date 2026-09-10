const vscode = require('vscode');
const path = require('path');
const { DocSiteGenerator } = require('./docSiteGenerator');

/**
 * Command handler for generating workspace BML documentation site.
 */
async function registerDocCommands(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.generateDocs', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No active workspace folder found to generate documentation.');
      return;
    }

    const rootDir = folders[0].uri.fsPath;
    const defaultOut = path.join(rootDir, 'docs');

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating BML API Documentation...',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 30, message: 'Scanning functions and docblocks...' });

      const generator = new DocSiteGenerator(rootDir);
      generator.scanWorkspace();

      progress.report({ increment: 50, message: 'Writing documentation pages...' });
      const results = generator.generate(defaultOut);

      progress.report({ increment: 20, message: 'Done!' });

      const choice = await vscode.window.showInformationMessage(
        `Generated documentation for ${results.totalCount} functions (${results.percent}% documented).`,
        'Open HTML Site',
        'Open API.md'
      );

      if (choice === 'Open HTML Site') {
        vscode.env.openExternal(vscode.Uri.file(results.htmlPath));
      } else if (choice === 'Open API.md') {
        const doc = await vscode.workspace.openTextDocument(results.mdPath);
        await vscode.window.showTextDocument(doc);
      }
    });
  });

  context.subscriptions.push(disposable);
}

module.exports = { registerDocCommands };
