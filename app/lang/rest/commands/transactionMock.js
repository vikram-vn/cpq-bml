let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    commands: { registerCommand: () => ({ dispose: () => {} }) },
    window: { showInputBox: () => {}, showInformationMessage: () => {}, showErrorMessage: () => {} },
    workspace: { workspaceFolders: [], openTextDocument: () => {} }
  };
}

const fs = require('fs');
const path = require('path');
const { fetchTransaction, fetchRecentTransactions, extractMockAttributes, generateBmlTestScaffold } = require('@/lang/rest/apiTransactionMock');

async function promptForTransactionId(vscodeInstance) {
  try {
    const recent = await fetchRecentTransactions(null, 12, vscodeInstance);
    if (recent && recent.length > 0) {
      const items = recent.map(t => ({
        label: `$(file) Quote #${t.id}`,
        description: t.status ? `[${t.status}] ${t.amount}` : t.amount,
        detail: t.lastModified ? `Modified: ${t.lastModified}` : undefined,
        id: t.id
      }));

      items.push({
        label: '$(edit) Enter Transaction ID manually...',
        description: 'Input any Quote/Transaction ID',
        id: null
      });

      const selected = await vscodeInstance.window.showQuickPick(items, {
        placeHolder: 'Select a recent live CPQ transaction or enter ID manually'
      });

      if (!selected) return null;
      if (selected.id) return selected.id;
    }
  } catch (_) {
    // Fall back to direct manual input if live query fails
  }

  return await vscodeInstance.window.showInputBox({
    prompt: 'Enter CPQ Transaction ID or Quote Number',
    placeHolder: 'e.g. 12345678'
  });
}

function registerTransactionMockCommands(context) {
  const disposable = vscode.commands.registerCommand('cpqBml.rest.generateTransactionMock', async () => {
    const transId = await promptForTransactionId(vscode);
    if (!transId || !transId.trim()) return;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Fetching Transaction #${transId}...`,
      cancellable: false
    }, async () => {
      try {
        const raw = await fetchTransaction(transId.trim(), null, vscode);
        const mock = extractMockAttributes(raw);
        const testCode = generateBmlTestScaffold(mock);

        const folders = vscode.workspace.workspaceFolders;
        const root = folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();

        const fixturesDir = path.join(root, 'test', 'fixtures');
        fs.mkdirSync(fixturesDir, { recursive: true });

        const jsonPath = path.join(fixturesDir, `mock_transaction_${transId.trim()}.json`);
        const bmlTestPath = path.join(root, 'test', `transaction_${transId.trim()}.bmlt`);

        fs.writeFileSync(jsonPath, JSON.stringify(mock, null, 2), 'utf8');
        fs.writeFileSync(bmlTestPath, testCode, 'utf8');

        const choice = await vscode.window.showInformationMessage(
          `Generated mock fixture (${mock.lines.length} lines) and BMLT test file.`,
          'Open Test File',
          'Open Mock JSON'
        );

        if (choice === 'Open Test File') {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(bmlTestPath));
          await vscode.window.showTextDocument(doc);
        } else if (choice === 'Open Mock JSON') {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(jsonPath));
          await vscode.window.showTextDocument(doc);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to generate transaction mock: ${err.message}`);
      }
    });
  });

  context.subscriptions.push(disposable);
}

module.exports = {
  promptForTransactionId,
  registerTransactionMockCommands
};
