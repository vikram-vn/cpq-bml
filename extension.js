const net = require("net");
const vscode = require("vscode");

const { registerBeautifier } = require("./app/lang/beautify");
const { registerDocHeaderCompletion } = require("./app/lang/beautify/docHeader");
const { beautifyWorkspaceCommand } = require("./app/lang/beautify/commandWorkspace");
const { registerBmlIntelliSense } = require("./app/lang/intellisense");
const { registerBmlLinter } = require("./app/lang/lint");
const { registerBmlComments } = require("./app/lang/comments");
const { registerBmlRest } = require("./app/lang/rest");
const { setExtensionContext } = require("./app/lang/rest/commerceAttributes");
const { registerSettingsPanel } = require("./app/lang/settings-panel");
const { registerMcp } = require("./app/lang/mcp");
const { registerXslt } = require("./app/lang/xslt");
const { registerBmlTestRunner, registerBmlSnapshot } = require("./app/lang/testing");
const { registerEnvironmentSwitcher } = require("./app/lang/statusBar/environmentSwitcher");
const { syncGlobalAgySkills } = require("./app/ai/setup/globalSkillSync");
const { registerChatParticipant } = require("./app/ai/chatParticipant");
const { registerTestController } = require("./app/lang/test/bmlTestController");
const { registerDatatableEditor } = require("./app/lang/datatable/datatableEditorProvider");
const { registerSchemaIntrospector } = require("./app/lang/intellisense/schemaIntrospector");
const { BmqlConsolePanel } = require("./app/lang/bmql/bmqlConsolePanel");
const { getCoverageDecorator } = require("./app/lang/test/coverageDecorator");
const { registerDataTableCommands } = require("./app/lang/datatable/datatableCommands");
const { registerLogCommands } = require("./app/lang/rest/commands/logs");
const { registerTransactionMockCommands } = require("./app/lang/rest/commands/transactionMock");
const { registerCacheFlushCommand } = require("./app/lang/rest/commands/cacheFlush");
const { registerActionSimulatorCommands } = require("./app/lang/rest/apiActionSimulator");
const { registerInstanceMonitorCommands } = require("./app/lang/rest/instanceMonitor");
const { getSessionKeepAlive } = require("./app/lang/rest/sessionKeepAlive");
const { registerCloudExplorer } = require("./app/lang/cloud/cloudExplorer");
const { registerCloudTypeDefCommands } = require("./app/lang/cloud/cloudTypeDefSync");
const { registerCloudDataTables } = require("./app/lang/cloud/cloudDataTables");
const { registerRemoteTestCommands } = require("./app/lang/test/remoteTestRunner");
const { runPreflightSafetyCheck, formatPreflightSummary } = require("./app/lang/rest/preflightChecker");

const DEFAULT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS = 1000;

function activate(context) {
  setExtensionContext(context);
  const output = vscode.window.createOutputChannel("CPQ-BML");
  context.subscriptions.push(output);
  output.appendLine("CPQ-BML extension is now active!");

  if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
    net.setDefaultAutoSelectFamilyAttemptTimeout(
      DEFAULT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS,
    );
  }

  const disposable = vscode.commands.registerCommand("cpq", () => {
    vscode.window.showInformationMessage("Thank you for using CPQ-BML!");
  });
  context.subscriptions.push(disposable);

  registerBeautifier(context);
  registerBmlIntelliSense(context);
  registerDocHeaderCompletion(context);
  registerBmlLinter(context);
  registerBmlComments(context);

  const workspaceCmd = vscode.commands.registerCommand(
    "cpqBml.beautifyWorkspace",
    beautifyWorkspaceCommand,
  );
  context.subscriptions.push(workspaceCmd);

  registerBmlRest(context);
  registerSettingsPanel(context);
  registerMcp(context);
  registerXslt(context);
  registerBmlTestRunner(context);
  registerBmlSnapshot(context);
  registerChatParticipant(context);
  registerEnvironmentSwitcher(context);
  registerTestController(context);
  registerDatatableEditor(context);
  registerSchemaIntrospector(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.openBmqlConsole", () => {
      BmqlConsolePanel.createOrShow(context);
    })
  );

  const coverageDecorator = getCoverageDecorator();
  context.subscriptions.push(
    coverageDecorator,
    vscode.commands.registerCommand("cpqBml.toggleCoverage", () => {
      coverageDecorator.toggle();
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) coverageDecorator.updateActiveEditor();
    })
  );

  registerDataTableCommands(context);
  registerLogCommands(context);
  registerTransactionMockCommands(context);
  registerCacheFlushCommand(context);
  registerActionSimulatorCommands(context);
  registerInstanceMonitorCommands(context);
  getSessionKeepAlive().start(vscode);

  registerCloudExplorer(context);
  registerCloudTypeDefCommands(context);
  registerCloudDataTables(context);
  registerRemoteTestCommands(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.rest.preflightCheck", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("Open a BML or BMLT file to run Pre-Flight Safety Check.");
        return;
      }
      await vscode.window.withProgress({
        location: 15,
        title: "Running Pre-Flight Safety & Impact Analysis...",
        cancellable: false
      }, async () => {
        try {
          const report = await runPreflightSafetyCheck(editor.document.uri.fsPath, vscode, context);
          const channel = vscode.window.createOutputChannel("CPQ Pre-Flight Report");
          channel.show(true);
          channel.appendLine(formatPreflightSummary(report));
          if (report.canDeploy) {
            vscode.window.showInformationMessage(
              `Pre-Flight Check PASSED for ${report.functionName}. Referenced in ${report.impact.callersCount} workspace files.`
            );
          } else {
            vscode.window.showWarningMessage(
              `Pre-Flight Check flagged issues for ${report.functionName}. See output channel for full report.`
            );
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Pre-Flight check error: ${err.message}`);
        }
      });
    })
  );

  try {
    const { synced, errors } = syncGlobalAgySkills(context.extensionPath);
    if (errors.length > 0) {
      console.warn('CPQ-BML: Antigravity skill sync warnings:', errors);
    } else {
      output.appendLine(`CPQ-BML: Synced ${synced} BML skills to Antigravity global config.`);
    }
  } catch (e) {
    console.warn('CPQ-BML: Antigravity skill sync failed (non-fatal):', e);
  }

  const ICON_THEME_ID = "bml-icon-theme";
  if (!context.globalState.get("bmlIconThemeInitialized")) {
    context.globalState.update("bmlIconThemeInitialized", true);
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    if (workbenchConfig.get("iconTheme") !== ICON_THEME_ID) {
      workbenchConfig.update(
        "iconTheme",
        ICON_THEME_ID,
        vscode.ConfigurationTarget.Global,
      );
    }
  }

  const activateIconsCmd = vscode.commands.registerCommand(
    "cpqBml.activateIconTheme",
    async () => {
      await vscode.workspace
        .getConfiguration("workbench")
        .update("iconTheme", ICON_THEME_ID, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        "BML Material Icon Theme is now active!",
      );
    },
  );
  context.subscriptions.push(activateIconsCmd);

  let syncTimeout = null;
  const triggerFolderSync = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      try {
        syncRuntimeWorkspaceFolders(context, vscode.workspace.workspaceFolders);
      } catch (_) {}
    }, 150);
  };

  triggerFolderSync();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(triggerFolderSync),
    vscode.workspace.onDidCreateFiles(triggerFolderSync),
    vscode.workspace.onDidRenameFiles(triggerFolderSync)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
