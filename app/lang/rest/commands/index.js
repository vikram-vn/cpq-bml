const vscode = require("vscode");
const { getResultsTerminal } = require("../terminal");
const { runSetPassword, runSetAuthToken } = require("./secrets");
const { runPullLibraryFunctions, runPullCommerceFunctions } = require("./pull");
const { runValidateCurrentFile } = require("./validate");
const { runSaveCurrentFile } = require("./save");
const { runDebugCurrentFile } = require("./debug");
const { runCreateOverride, runRemoveOverride } = require("./override");
const {
  runDeployCommerceProcess,
  runDeployCurrentFile,
  runDeployUtilFunctions,
} = require("./deploy");
const { runCreateBmlFunction } = require("./scaffold");
const { runChangeEnvironment } = require("./env");
const { runGlobalSearchBml } = require("./globalSearch");
const { runGetTransactions } = require("./transactions");
const {
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
  isSuccess,
} = require("./shared");
const metadataLib = require("../metadata");
const api = require("../api");
const {
  hasMissingCredentials,
  getCommerceProcess,
  getCommerceDocument,
} = require("../config");

// Gates the editor/title toolbar icons on a fully usable connection (siteUrl + username/token + matching secret), not just the enabled toggle.
async function refreshConnectionConfiguredContext(context, vscode) {
  const missing = await hasMissingCredentials(context, vscode);
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.connection.configured",
    !missing,
  );
}

const pendingFetches = new Set();

async function triggerSmartMetadataFetch(context, vscode, statusBarItem, filePath, options = {}) {
  if (!filePath || !filePath.endsWith(".bml")) return;
  if (pendingFetches.has(filePath)) return;
  pendingFetches.add(filePath);

  try {
    const metaPath = metadataLib.bmlPathToMetaPath(filePath);
    const variableName = metadataLib.variableNameFromBmlPath(filePath);

    // 1. Check workspace files: did the user pull or have -meta.json in another folder?
    if (vscode && vscode.workspace && typeof vscode.workspace.findFiles === "function") {
      try {
        const matches = await vscode.workspace.findFiles(`**/${variableName}-meta.json`, "**/node_modules/**", 1);
        if (matches && matches.length > 0) {
          const foundMeta = metadataLib.readMetadata(matches[0].fsPath);
          if (foundMeta) {
            try {
              metadataLib.writeMetadata(metaPath, foundMeta);
            } catch (e) {}
            const activePath = vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath;
            if (activePath === filePath) {
              refreshBmlStatus(vscode, statusBarItem, filePath, context, options);
            }
            return;
          }
        }
      } catch (e) {}
    }

    // 2. If context provided, check CPQ in the background
    if (context) {
      const missing = await hasMissingCredentials(context, vscode);
      if (missing) return;

      const commerceProcess = getCommerceProcess(vscode) || "oraclecpqo";
      const commerceDocument = getCommerceDocument(vscode) || "transaction";
      const transport = options.transport;

      // Check commerce library functions first
      const commerceMatch = await findLibraryFunctionByVariableName(
        context,
        vscode,
        variableName,
        transport,
        { commerceProcess, commerceDocument },
      );
      if (commerceMatch) {
        const result = await api.getLibraryFunction(
          context,
          vscode,
          commerceMatch.variableName,
          transport,
          { commerceProcess, commerceDocument },
        );
        if (isSuccess(result.statusCode)) {
          const { metadata } = metadataLib.splitFunctionResponse(result.body);
          metadata.commerceProcess = commerceProcess;
          metadata.commerceDocument = commerceDocument;
          metadata.variableName = metadata.variableName || commerceMatch.variableName || variableName;
          metadata.name = metadata.name || commerceMatch.name || metadata.variableName;
          metadata.folderName = metadata.folderName || commerceMatch.folderName || "";
          try {
            metadataLib.writeMetadata(metaPath, metadata);
          } catch (e) {}
          const activePath = vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath;
          if (activePath === filePath) {
            refreshBmlStatus(vscode, statusBarItem, filePath, context, options);
          }
          return;
        }
      }

      // Check utility library functions next
      const utilMatch = await findLibraryFunctionByVariableName(
        context,
        vscode,
        variableName,
        transport,
        undefined,
      );
      if (utilMatch) {
        const result = await api.getLibraryFunction(
          context,
          vscode,
          utilMatch.variableName,
          transport,
          undefined,
        );
        if (isSuccess(result.statusCode)) {
          const { metadata } = metadataLib.splitFunctionResponse(result.body);
          metadata.variableName = metadata.variableName || utilMatch.variableName || variableName;
          metadata.name = metadata.name || utilMatch.name || metadata.variableName;
          metadata.folderName = metadata.folderName || utilMatch.folderName || "";
          try {
            metadataLib.writeMetadata(metaPath, metadata);
          } catch (e) {}
          const activePath = vscode.window && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.fsPath;
          if (activePath === filePath) {
            refreshBmlStatus(vscode, statusBarItem, filePath, context, options);
          }
          return;
        }
      }
    }
  } catch (err) {
    // Non-blocking background fetch; silently ignore
  } finally {
    pendingFetches.delete(filePath);
  }
}

function refreshBmlStatus(vscode, statusBarItem, filePath, context, options) {
  const hide = () => {
    statusBarItem.hide();
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      false,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      false,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsUtil",
      false,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsCommerce",
      false,
    );
  };

  if (!filePath || !filePath.endsWith(".bml")) {
    hide();
    return;
  }
  let meta = metadataLib.readMetadata(
    metadataLib.bmlPathToMetaPath(filePath),
  );
  if (!meta && filePath.endsWith("_ai.bml")) {
    const canonicalPath = filePath.replace(/_ai\.bml$/i, ".bml");
    meta = metadataLib.readMetadata(
      metadataLib.bmlPathToMetaPath(canonicalPath),
    );
  }

  const inferred = metadataLib.inferCommerceFromPath(filePath);
  const isCommerce = meta ? !!meta.commerceDocument : !!inferred;

  // Track whether the active file is commerce vs util so the Deploy button
  // in the editor title bar can show the right icon and invoke the right command.
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.activeFileIsCommerce",
    isCommerce,
  );
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.activeFileIsUtil",
    !isCommerce,
  );

  // If local metadata is not yet present and cannot be inferred from path,
  // trigger non-blocking smart fetch to discover whether it's commerce vs util.
  if (!meta && !inferred) {
    triggerSmartMetadataFetch(context, vscode, statusBarItem, filePath, options);
  }

  if (isCommerce) {
    const isStandard = meta ? !!meta.isStandardFunction : false;
    const isOverridden = meta ? !!meta.isOverridden : false;

    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      isStandard,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      isOverridden,
    );

    if (isStandard) {
      if (isOverridden) {
        statusBarItem.text = "$(gear) Override";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — standard function with your custom override. Click to remove override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        statusBarItem.command = "cpqBml.rest.removeOverride";
      } else {
        statusBarItem.text = "$(gear) System";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — read-only system function. Click to create an override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        statusBarItem.command = "cpqBml.rest.createOverride";
      }
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  } else {
    const isStandard = meta ? !!meta.isStandardFunction : false;
    const isOverridden = meta ? !!meta.isOverridden : false;

    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      isStandard,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      isOverridden,
    );

    if (isStandard) {
      if (isOverridden) {
        statusBarItem.text = "$(gear) Overridden";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — standard util function with your custom override. Click to remove override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        statusBarItem.command = "cpqBml.rest.removeOverride";
      } else {
        statusBarItem.text = "$(gear) System";
        statusBarItem.tooltip = `${(meta && meta.variableName) || "Function"} — read-only system function. Click to create an override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        statusBarItem.command = "cpqBml.rest.createOverride";
      }
      statusBarItem.show();
    } else if (meta) {
      statusBarItem.text = "$(gear) Custom";
      statusBarItem.tooltip = `${meta.variableName} — custom BML utility function.`;
      statusBarItem.backgroundColor = undefined;
      statusBarItem.command = undefined;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  }
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
  }

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
    vscode.commands.registerCommand("cpqBml.rest.debugCurrentFile", () =>
      runDebugCurrentFile(context, vscode, diagnosticCollection, resultsTerminal),
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
  runCreateOverride,
  runRemoveOverride,
  runDeployCommerceProcess,
  runDeployCurrentFile,
  runDeployUtilFunctions,
  runCreateBmlFunction,
  runChangeEnvironment,
  runGlobalSearchBml,
  runGetTransactions,
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
  triggerSmartMetadataFetch,
};
