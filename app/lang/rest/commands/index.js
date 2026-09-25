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
const { runRollbackSnapshot, runDiffWithRemote } = require("@/lang/rest/commands/rollback");
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
const { setExtensionContext, getExtensionContext, getContext } = require("@/extensionContext");

// Gates the editor/title toolbar icons on a fully usable connection (siteUrl + username/token + matching secret), not just the enabled toggle.
async function refreshConnectionConfiguredContext(maybeContext, maybeVscode) {
  if (maybeContext || maybeVscode) {
    setExtensionContext(maybeContext, maybeVscode);
  }
  const missing = await hasMissingCredentials();
  const { vscode } = getExtensionContext();
  if (vscode && vscode.commands && typeof vscode.commands.executeCommand === "function") {
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.connection.configured",
      !missing,
    );
  }
}

function refreshCommerceSyncContext(maybeVscode) {
  if (maybeVscode) {
    setExtensionContext(null, maybeVscode);
  }
  const { vscode } = getExtensionContext();
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
  context = context || getContext();
  if (context) setExtensionContext(context, vscode);

  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("rest-validate");
  if (context && context.subscriptions) context.subscriptions.push(diagnosticCollection);

  const resultsTerminal = getResultsTerminal(vscode);
  context.subscriptions.push(resultsTerminal);

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusBarItem);

  refreshConnectionConfiguredContext();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("cpqBml.connection.siteUrl") ||
        e.affectsConfiguration("cpqBml.connection.username") ||
        e.affectsConfiguration("cpqBml.connection.authMethod")
      ) {
        refreshConnectionConfiguredContext();
      }
    }),
  );
  // Secret writes don't fire a configuration-change event, so re-check explicitly.
  if (context.secrets && typeof context.secrets.onDidChange === "function") {
    context.subscriptions.push(
      context.secrets.onDidChange(() => {
        refreshConnectionConfiguredContext();
      }),
    );
  }

  refreshBmlStatus(
    statusBarItem,
    vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document.uri.fsPath,
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      refreshBmlStatus(
        statusBarItem,
        editor && editor.document.uri.fsPath,
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
        refreshBmlStatus(statusBarItem, activePath);
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
      refreshBmlStatus(statusBarItem, activePath);
    };
    metaWatcher.onDidCreate(onMetaChange);
    metaWatcher.onDidChange(onMetaChange);
    metaWatcher.onDidDelete(onMetaChange);
    context.subscriptions.push(metaWatcher);

    const syncWatcher =
      vscode.workspace.createFileSystemWatcher("**/cpq/*attributes*.json");
    const onSyncChange = () => {
      refreshCommerceSyncContext();
    };
    syncWatcher.onDidCreate(onSyncChange);
    syncWatcher.onDidChange(onSyncChange);
    syncWatcher.onDidDelete(onSyncChange);
    context.subscriptions.push(syncWatcher);
  }

  refreshCommerceSyncContext();

  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.rest.setPassword", () =>
      runSetPassword(),
    ),
    vscode.commands.registerCommand("cpqBml.rest.setAuthToken", () =>
      runSetAuthToken(),
    ),
    vscode.commands.registerCommand("cpqBml.rest.pullLibraryFunctions", () =>
      runPullLibraryFunctions(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.pullCommerceFunctions", () =>
      runPullCommerceFunctions(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.validateCurrentFile", () =>
      runValidateCurrentFile(diagnosticCollection, resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.saveCurrentFile", () =>
      runSaveCurrentFile(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugCurrentFile", (options) =>
      runDebugCurrentFile(diagnosticCollection, resultsTerminal, options),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugConfigureInputs", (options) =>
      runDebugCurrentFile(diagnosticCollection, resultsTerminal, { ...options, configureInputs: true }),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugResultsOnly", (options) =>
      runDebugCurrentFile(diagnosticCollection, resultsTerminal, { ...options, resultsOnly: true }),
    ),
    vscode.commands.registerCommand("cpqBml.rest.debugExecution", (options) =>
      runDebugCurrentFile(diagnosticCollection, resultsTerminal, options),
    ),
    vscode.commands.registerCommand("cpqBml.rest.createOverride", () =>
      runCreateOverride(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.removeOverride", () =>
      runRemoveOverride(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.deployCommerceProcess", () =>
      runDeployCommerceProcess(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.deployCurrentFile", () =>
      runDeployCurrentFile(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.deployUtilFunctions", () =>
      runDeployUtilFunctions(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.massDeployUtils", () =>
      runDeployUtilFunctions(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.createBmlFunction", () =>
      runCreateBmlFunction(),
    ),
    vscode.commands.registerCommand("cpqBml.rest.changeEnvironment", () =>
      runChangeEnvironment(),
    ),
    vscode.commands.registerCommand("cpqBml.rest.globalSearchBml", () =>
      runGlobalSearchBml(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.getTransactions", () =>
      runGetTransactions(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.syncCommerceMetadata", () =>
      runSyncCommerceMetadata(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.removeCommerceMetadata", () =>
      runRemoveCommerceMetadata(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.pipelineViewer", (options) =>
      runPipelineViewerCommand(resultsTerminal, options),
    ),
    vscode.commands.registerCommand("cpqBml.rest.rollbackSnapshot", () =>
      runRollbackSnapshot(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.diffWithRemote", () =>
      runDiffWithRemote(resultsTerminal),
    ),
    vscode.commands.registerCommand("cpqBml.rest.clearResults", () =>
      resultsTerminal.clear(),
    ),
    vscode.commands.registerCommand("cpqBml.internal.refreshStatus", () => {
      refreshBmlStatus(
        statusBarItem,
        vscode.window.activeTextEditor &&
          vscode.window.activeTextEditor.document.uri.fsPath,
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
  runRollbackSnapshot,
  runDiffWithRemote,
  refreshCommerceSyncContext,
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
  triggerSmartMetadataFetch,
};
