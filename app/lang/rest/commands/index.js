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
const { runDownloadLogFile } = require("./logs");
const {
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
} = require("./shared");
const metadataLib = require("../metadata");
const { hasMissingCredentials } = require("../config");

// Gates the editor/title toolbar icons on a fully usable connection (siteUrl + username/token + matching secret), not just the enabled toggle.
async function refreshConnectionConfiguredContext(context, vscode) {
  const missing = await hasMissingCredentials(context, vscode);
  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.connection.configured",
    !missing,
  );
}

function refreshBmlStatus(vscode, statusBarItem, filePath) {
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
  };

  if (!filePath || !filePath.endsWith(".bml")) {
    hide();
    return;
  }
  const meta = metadataLib.readMetadata(
    metadataLib.bmlPathToMetaPath(filePath),
  );
  if (!meta) {
    hide();
    return;
  }

  const isCommerce = !!meta.commerceDocument;
  const isUtil = !isCommerce;

  vscode.commands.executeCommand(
    "setContext",
    "cpqBml.activeFileIsUtil",
    isUtil,
  );

  if (isCommerce) {
    if (!meta.isStandardFunction) {
      hide();
      return;
    }

    const isOverridden = !!meta.isOverridden;
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsStandard",
      true,
    );
    vscode.commands.executeCommand(
      "setContext",
      "cpqBml.activeFileIsOverridden",
      isOverridden,
    );

    if (isOverridden) {
      statusBarItem.text = "$(gear) Override";
      statusBarItem.tooltip = `${meta.variableName} — standard function with your custom override. Click to remove override.`;
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
      statusBarItem.command = "cpqBml.rest.removeOverride";
    } else {
      statusBarItem.text = "$(gear) System";
      statusBarItem.tooltip = `${meta.variableName} — read-only system function. Click to create an override.`;
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      statusBarItem.command = "cpqBml.rest.createOverride";
    }
    statusBarItem.show();
  } else {
    const isStandard = !!meta.isStandardFunction;
    const isOverridden = !!meta.isOverridden;

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
        statusBarItem.tooltip = `${meta.variableName} — standard util function with your custom override. Click to remove override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        statusBarItem.command = "cpqBml.rest.removeOverride";
      } else {
        statusBarItem.text = "$(gear) System";
        statusBarItem.tooltip = `${meta.variableName} — read-only system function. Click to create an override.`;
        statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground",
        );
        statusBarItem.command = "cpqBml.rest.createOverride";
      }
    } else {
      statusBarItem.text = "$(gear) Custom";
      statusBarItem.tooltip = `${meta.variableName} — custom BML utility function.`;
      statusBarItem.backgroundColor = undefined;
      statusBarItem.command = undefined;
    }
    statusBarItem.show();
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
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      refreshBmlStatus(
        vscode,
        statusBarItem,
        editor && editor.document.uri.fsPath,
      );
    }),
  );

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
    vscode.commands.registerCommand("cpqBml.rest.downloadLogFile", () =>
      runDownloadLogFile(context, vscode),
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
      );
    }),
  );
}

module.exports = {
  registerBmlRestCommands,
  refreshConnectionConfiguredContext,
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
  runDownloadLogFile,
  describeError,
  findLibraryFunctionByVariableName,
  resolveMetadataForFile,
};
