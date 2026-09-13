'use strict';

/**
 * Handles user selection from CPQ Global Search QuickPick.
 */
async function handleSearchSelection(data, vscodeInstance) {
  if (!data) return;

  if (data.category === 'datatable') {
    const actionChoice = await vscodeInstance.window.showQuickPick(
      [
        {
          label: '$(play) Query Table in BMQL Live Console',
          action: 'query',
        },
        {
          label: '$(cloud-download) Export Table to CSV',
          action: 'export',
        },
        { label: '$(json) View Table Schema Definition', action: 'schema' },
      ],
      { placeHolder: `Action for Data Table: ${data.name}` },
    );

    if (!actionChoice) return;

    if (actionChoice.action === 'query') {
      if (vscodeInstance.commands?.executeCommand) {
        await vscodeInstance.commands.executeCommand(
          'cpqBml.cloud.queryDataTable',
          { data: data.raw || { name: data.name } },
        );
      }
    } else if (actionChoice.action === 'export') {
      if (vscodeInstance.commands?.executeCommand) {
        await vscodeInstance.commands.executeCommand(
          'cpqBml.cloud.exportDataTableCsv',
          { data: data.raw || { name: data.name } },
        );
      }
    } else if (actionChoice.action === 'schema') {
      const doc = await vscodeInstance.workspace.openTextDocument({
        content: JSON.stringify(data.raw, null, 2),
        language: 'json',
      });
      await vscodeInstance.window.showTextDocument(doc);
    }
    return;
  }

  if (data.category === 'transaction') {
    const actionChoice = await vscodeInstance.window.showQuickPick(
      [
        {
          label: '$(inspect) Inspect Transaction Details',
          action: 'inspect',
        },
        {
          label: '$(debug-alt) Debug Active BML on this Transaction',
          action: 'debug',
        },
        {
          label: '$(copy) Copy Transaction ID to Clipboard',
          action: 'copy',
        },
      ],
      { placeHolder: `Action for Transaction: ${data.name}` },
    );

    if (!actionChoice) return;

    if (actionChoice.action === 'inspect') {
      if (vscodeInstance.commands?.executeCommand) {
        await vscodeInstance.commands.executeCommand(
          'cpqBml.cloud.inspectTransaction',
          { data: data.raw },
        );
      }
    } else if (actionChoice.action === 'debug') {
      if (vscodeInstance.commands?.executeCommand) {
        await vscodeInstance.commands.executeCommand(
          'cpqBml.cloud.debugOnTransaction',
          { data: data.raw },
        );
      }
    } else if (actionChoice.action === 'copy') {
      if (vscodeInstance.commands?.executeCommand) {
        await vscodeInstance.commands.executeCommand(
          'cpqBml.cloud.copyTransactionId',
          { data: data.raw },
        );
      }
    }
    return;
  }

  if (data.file) {
    const doc = await vscodeInstance.workspace.openTextDocument(
      vscodeInstance.Uri.file(data.file),
    );
    const editor = await vscodeInstance.window.showTextDocument(doc);
    if (
      editor &&
      data.line &&
      vscodeInstance.Position &&
      vscodeInstance.Range
    ) {
      const pos = new vscodeInstance.Position(data.line - 1, 0);
      editor.selection = new vscodeInstance.Range(pos, pos);
      if (typeof editor.revealRange === 'function') {
        editor.revealRange(new vscodeInstance.Range(pos, pos));
      }
    }
  } else if (data.scriptText) {
    const doc = await vscodeInstance.workspace.openTextDocument({
      content: data.scriptText,
      language: 'bml',
    });
    const editor = await vscodeInstance.window.showTextDocument(doc);
    if (
      editor &&
      data.matchedLine &&
      vscodeInstance.Position &&
      vscodeInstance.Range
    ) {
      const pos = new vscodeInstance.Position(data.matchedLine - 1, 0);
      editor.selection = new vscodeInstance.Range(pos, pos);
      if (typeof editor.revealRange === 'function') {
        editor.revealRange(new vscodeInstance.Range(pos, pos));
      }
    }
  } else if (data.raw) {
    const doc = await vscodeInstance.workspace.openTextDocument({
      content: JSON.stringify(data.raw, null, 2),
      language: 'json',
    });
    await vscodeInstance.window.showTextDocument(doc);
  }
}

module.exports = {
  handleSearchSelection,
};
