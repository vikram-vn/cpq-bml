let vscode;
try {
  vscode = require("vscode");
} catch (_) {}
const { getResultsTerminal } = require("@/lang/rest/terminal");
const { runSetPassword, runSetAuthToken } = require("@/lang/rest/commands/secrets");
const { runPullLibraryFunctions, runPullCommerceFunctions } = require("@/lang/rest/commands/pull");
const { runValidateCurrentFile } = require("@/lang/rest/commands/validate");
const { runSaveCurrentFile } = require("@/lang/rest/commands/save");
const { runDebugCurrentFile, runConcurrentPool } = require("@/lang/rest/commands/debug");
const { runCreateOverride, runRemoveOverride } = require("@/lang/rest/commands/override");
const {
  runDeployCommerceProcess,
  runDeployCurrentFile,
  runDeployUtilFunctions,
} = require("@/lang/rest/commands/deploy");
const { runCreateBmlFunction } = require("@/lang/rest/commands/scaffold");
const { runChangeEnvironment } = require("@/lang/rest/commands/env");
const { runGlobalSearchBml } = require("@/lang/rest/commands/globalSearch");
const { runGetTransactions } = require("@/lang/rest/commands/transactions");
const { runSyncCommerceMetadata, runRemoveCommerceMetadata } = require("@/lang/rest/commands/sync");
const { runPipelineViewerCommand } = require("@/lang/rest/commands/pipelineViewer");
const { isCommerceSynced } = require("@/lang/rest/commerceAttributes");
const {
  triggerSmartMetadataFetch,
  refreshBmlStatus,
} = require("@/lang/rest/commands/status");
const {
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
  isSuccess,
} = require("@/lang/rest/commands/shared");
const { hasMissingCredentials } = require("@/lang/rest/config");

// Gates the editor/title toolbar icons on a fully usable connection (siteUrl + username/token + matching secret), not just the enabled toggle.
async function refreshConnectionConfiguredContext(context, vscode) {
  const missing = await hasMissingCredentials(context, vscode);
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.connection.configured",
    !missing,
  );
}

function refreshCommerceSyncContext(vscode) {
  let wsRoot = null;
  if (
    vscode &&
    vscode.workspace &&
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  ) {
    wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  const synced = isCommerceSynced(wsRoot);
  if (vscode && vscode.commands && typeof vscode.commands.executeCommand === "function") {
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.commerceMetadataSynced",
      synced,
    );
  }
  return synced;
}

function registerBmlRestCommands(context) {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("rest-validate");
  context.subscriptions.push(diagnosticCollection);

  const resultsTerminal = getResultsTerminal(vscode);
  context.subscriptions.push(resultsTerminal);

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBarItem);

  refreshConnectionConfiguredContext(context, vscode);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("cpqBml.connection.siteUrl") ||
        e.affectsConfiguration("cpqBml.connection.username") ||
        e.affectsConfiguration("cpqBml.connection.authMethod")
      ) {
        refreshConnectionConfiguredContext(context, vscode);
      }
    }),
  );
  // Secret writes don't fire a configuration-change event, so re-check explicitly.
  context.subscriptions.push(
    context.secrets.onDidChange(() => {
      refreshConnectionConfiguredContext(context, vscode);
    }),
  );

  refreshBmlStatus(
    vscode,
    statusBarItem,
    vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document.uri.fsPath,
    context,
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      refreshBmlStatus(
        vscode,
        statusBarItem,
        editor && editor.document.uri.fsPath,
        context,
      );
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const fsPath = doc && doc.uri && doc.uri.fsPath;
      if (fsPath && (fsPath.endsWith(".bml") || fsPath.endsWith("-meta.json"))) {
        const activePath =
          vscode.window.activeTextEditor &&
          vscode.window.activeTextEditor.document.uri.fsPath;
        refreshBmlStatus(vscode, statusBarItem, activePath, context);
      }
    }),
  );

  if (
    vscode.workspace &&
    typeof vscode.workspace.createFileSystemWatcher === "function"
  ) {
    const metaWatcher =
      vscode.workspace.createFileSystemWatcher("**/*-meta.json");
    const onMetaChange = () => {
      const activePath =
        vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.uri.fsPath;
      refreshBmlStatus(vscode, statusBarItem, activePath, context);
    };
    metaWatcher.onDidCreate(onMetaChange);
    metaWatcher.onDidChange(onMetaChange);
    metaWatcher.onDidDelete(onMetaChange);
    context.subscriptions.push(metaWatcher);

    const syncWatcher =
      vscode.workspace.createFileSystemWatcher("**/cpq/*attributes*.json");
    const onSyncChange = () => {
      refreshCommerceSyncContext(vscode);
    };
    syncWatcher.onDidCreate(onSyncChange);
    syncWatcher.onDidChange(onSyncChange);
    syncWatcher.onDidDelete(onSyncChange);
    context.subscriptions.push(syncWatcher);
  }

  refreshCommerceSyncContext(vscode);

  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.rest.setPassword", () =>
      runSetPassword(context, vscode),
    ),
    vscode.commands.registerCommand("cpqBml.rest.setAuthToken", () =>
      runSetAuthToken(context, vscode),
    ),
    vscode.commands.registerCommand("cpqBml.rest.pullLibraryFunctions", () =>
      runPullLibraryFunctions(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.pullCommerceFunctions", () =>
      runPullCommerceFunctions(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.validateCurrentFile", () =>
      runValidateCurrentFile(
        context,
        vscode,
        diagnosticCollection,
        resultsTerminal,
      ),
    ),
    vscode.commands.registerCommand("cpqBml.rest.saveCurrentFile", () =>
      runSaveCurrentFile(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugCurrentFile", (options) =>
      runDebugCurrentFile(context, vscode, diagnosticCollection, resultsTerminal, options),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugConfigureInputs", (options) =>
      runDebugCurrentFile(context, vscode, diagnosticCollection, resultsTerminal, { ...options, configureInputs: true }),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugExecution", (options) =>
      runDebugCurrentFile(context, vscode, diagnosticCollection, resultsTerminal, options),
    ),
    vscode.commands.registerCommand("cpqBml.rest.createOverride", () =>
      runCreateOverride(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.removeOverride", () =>
      runRemoveOverride(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.deployCommerceProcess", () =>
      runDeployCommerceProcess(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.deployCurrentFile", () =>
      runDeployCurrentFile(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.deployUtilFunctions", () =>
      runDeployUtilFunctions(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.massDeployUtils", () =>
      runDeployUtilFunctions(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.createBmlFunction", () =>
      runCreateBmlFunction(context, vscode),
    ),
    vscode.commands.registerCommand("cpqBml.rest.changeEnvironment", () =>
      runChangeEnvironment(context, vscode),
    ),
    vscode.commands.registerCommand("cpqBml.rest.globalSearchBml", () =>
      runGlobalSearchBml(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.getTransactions", () =>
      runGetTransactions(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.syncCommerceMetadata", () =>
      runSyncCommerceMetadata(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.removeCommerceMetadata", () =>
      runRemoveCommerceMetadata(context, vscode, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.pipelineViewer", (options) =>
      runPipelineViewerCommand(context, vscode, resultsTerminal, options),
    ),
    vscode.commands.registerCommand("cpqBml.rest.clearResults", () =>
      resultsTerminal.clear(),
    ),
    vscode.commands.registerCommand("cpqBml.internal.refreshStatus", () => {
      refreshBmlStatus(
        vscode,
        statusBarItem,
        vscode.window.activeTextEditor &&
          vscode.window.activeTextEditor.document.uri.fsPath,
        context,
      );
    }),
  );
}

module.exports = {
  registerBmlRestCommands,
  refreshConnectionConfiguredContext,
  refreshBmlStatus,
  runSetPassword,
  runSetAuthToken,
  runPullLibraryFunctions,
  runPullCommerceFunctions,
  runValidateCurrentFile,
  runSaveCurrentFile,
  runDebugCurrentFile,
  runConcurrentPool,
  runCreateOverride,
  runRemoveOverride,
  runDeployCommerceProcess,
  runDeployCurrentFile,
  runDeployUtilFunctions,
  runCreateBmlFunction,
  runChangeEnvironment,
  runGlobalSearchBml,
  runGetTransactions,
  runSyncCommerceMetadata,
  runRemoveCommerceMetadata,
  runPipelineViewerCommand,
  refreshCommerceSyncContext,
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
  triggerSmartMetadataFetch,
};
