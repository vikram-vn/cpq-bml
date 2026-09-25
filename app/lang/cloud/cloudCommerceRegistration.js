const { vscode } = require('@/lang/cloud/cloudVscodeShim');
const { switchCommerceProcessCommand } = require('@/lang/cloud/cloudExplorerCommands');
const { inspectIntegrationCommand } = require('@/lang/cloud/cloudCommerceData');

/**
 * Registers Commerce Explorer tree view and associated commands with VS Code extension context.
 */
function registerCommerceExplorer(context, vscodeInstance = vscode, createCommerceExplorerFn) {
  const treeDataProvider = createCommerceExplorerFn(vscodeInstance, context);
  const treeView = vscodeInstance.window.registerTreeDataProvider('cpqBml.commerceExplorer', treeDataProvider);

  const refreshCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.refresh', () => {
    treeDataProvider.refresh();
  });

  const switchProcCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.switchProcess', async () => {
    await switchCommerceProcessCommand(vscodeInstance, context);
    treeDataProvider.refresh();
  });

  const filterCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.filterExplorer', async () => {
    const current = treeDataProvider.getFilter();
    const query = await vscodeInstance.window.showInputBox({
      prompt: 'Filter Commerce Explorer (actions, rules, attributes, libraries)',
      placeHolder: 'e.g. cleanSave, pricingRule, transactionID...',
      value: current,
      ignoreFocusOut: true
    });
    if (query !== undefined) {
      treeDataProvider.setFilter(query);
    }
  });

  const clearFilterCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.clearFilter', () => {
    treeDataProvider.clearFilter();
  });

  const { searchExplorerCommand } = require('@/lang/cloud/cloudExplorerSearch');
  const searchCmd = vscodeInstance.commands.registerCommand('cpqBml.commerce.searchExplorer', () => {
    // Use this section's own provider so Commerce items appear in the QuickPick
    return searchExplorerCommand(treeDataProvider, vscodeInstance, context);
  });

  const inspectIntegrationCmd = vscodeInstance.commands.registerCommand('cpqBml.cloud.inspectIntegration', (item) => {
    return inspectIntegrationCommand(item, vscodeInstance, context);
  });

  context.subscriptions.push(treeView, refreshCmd, switchProcCmd, filterCmd, clearFilterCmd, searchCmd, inspectIntegrationCmd);
  return { treeDataProvider, treeView };
}

module.exports = {
  registerCommerceExplorer
};
