require("./scripts/register-alias");
const net = require("net");
const vscode = require("vscode");

const { registerBeautifier } = require("@/lang/beautify");
const { registerDocHeaderCompletion } = require("@/lang/beautify/docHeader");
const { beautifyWorkspaceCommand } = require("@/lang/beautify/commandWorkspace");
const { registerBmlIntelliSense } = require("@/lang/intellisense");
const { registerBmlLinter } = require("@/lang/lint");
const { registerBmlComments } = require("@/lang/comments");
const { registerBmlRest } = require("@/lang/rest");
const { setExtensionContext } = require("@/lang/rest/commerceAttributes");
const { registerSettingsPanel } = require("@/lang/settings-panel");
const { registerMcp } = require("@/lang/mcp");
const { registerXslt } = require("@/lang/xslt");
const { registerEnvironmentSwitcher } = require("@/lang/status-bar/environmentSwitcher");
const { syncGlobalAgySkills } = require("@/ai/setup/globalSkillSync");
const { registerChatParticipant } = require("@/ai/chatParticipant");
const { registerTestController } = require("@/lang/test-controller/bmlTestController");
const { registerSchemaIntrospector } = require("@/lang/intellisense/schemaIntrospector");
const { getCoverageDecorator } = require("@/lang/test-controller/coverageDecorator");
const { registerLogCommands } = require("@/lang/rest/commands/logs");
const { registerTransactionMockCommands } = require("@/lang/rest/commands/transactionMock");
const { registerCacheFlushCommand } = require("@/lang/rest/commands/cacheFlush");
const { registerActionSimulatorCommands } = require("@/lang/rest/apiActionSimulator");
const { registerInstanceMonitorCommands } = require("@/lang/rest/instanceMonitor");
const { getSessionKeepAlive } = require("@/lang/rest/sessionKeepAlive");
const { registerCloudExplorer } = require("@/lang/cloud/cloudExplorer");
const { registerCommerceExplorer } = require("@/lang/cloud/cloudCommerceExplorer");
const { registerConfigExplorer } = require("@/lang/cloud/cloudConfigExplorer");
const { registerCloudTypeDefCommands } = require("@/lang/cloud/cloudTypeDefSync");
const { registerCloudDataTables } = require("@/lang/cloud/cloudDataTables");
const { registerCloudTransactions } = require("@/lang/cloud/cloudTransactions");
const { registerCloudDeploymentCenter } = require("@/lang/cloud/cloudDeploymentCenter");
const { registerCloudGlobalSearch } = require("@/lang/cloud/cloudGlobalSearch");
const { registerRemoteTestCommands } = require("@/lang/test-controller/remoteTestRunner");
const { runPreflightSafetyCheck, formatPreflightSummary } = require("@/lang/rest/preflightChecker");
const { invalidateIndex } = require("@/lang/intellisense/workspaceIndex");
const { invalidateApiData } = require("@/lang/intellisense/apiData");
const { isConfigured } = require("@/lang/rest/config");

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
  registerChatParticipant(context);
  registerEnvironmentSwitcher(context);
  registerTestController(context);
  registerSchemaIntrospector(context);

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

  registerLogCommands(context);
  registerTransactionMockCommands(context);
  registerCacheFlushCommand(context);
  registerActionSimulatorCommands(context);
  registerInstanceMonitorCommands(context);

  const keepAlive = getSessionKeepAlive();
  if (isConfigured(vscode)) {
    keepAlive.start(vscode);
  }
  context.subscriptions.push(
    keepAlive,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("cpqBml.connection") || e.affectsConfiguration("cpqBml.auth")) {
        if (isConfigured(vscode)) {
          keepAlive.start(vscode);
        } else {
          keepAlive.stop();
        }
      }
    })
  );

  registerCloudExplorer(context);
  registerCommerceExplorer(context);
  registerConfigExplorer(context);
  registerCloudTypeDefCommands(context);
  registerCloudDataTables(context);
  registerCloudTransactions(context);
  registerCloudDeploymentCenter(context);
  registerCloudGlobalSearch(context);
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


  const syncRuntimeWorkspaceFolders = () => {
    invalidateIndex();
    invalidateApiData();
  };

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
    { dispose: () => { if (syncTimeout) clearTimeout(syncTimeout); } },
    vscode.workspace.onDidChangeWorkspaceFolders(triggerFolderSync),
    vscode.workspace.onDidCreateFiles(triggerFolderSync),
    vscode.workspace.onDidRenameFiles(triggerFolderSync)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
