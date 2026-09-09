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
const { registerMetrics } = require("./app/lang/metrics");
const { registerBmlTestRunner, registerBmlSnapshot } = require("./app/lang/testing");
const { registerEnvironmentSwitcher } = require("./app/lang/statusBar/environmentSwitcher");
const { syncRuntimeWorkspaceFolders } = require("./app/lang/icons/dynamicFolderIcons");
const { syncGlobalAgySkills } = require("./app/ai/setup/globalSkillSync");
const { registerChatParticipant } = require("./app/ai/chatParticipant");

// How long Node's Happy Eyeballs (RFC 8305) dual-stack connection attempt waits
// before racing the next address family, for any outbound request this extension
// makes. Not available on every Node version the extension host may bundle.
const DEFAULT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS = 1000;

// Main activation entry point for CPQ-BML extension host
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

  // ── Critical path: register immediately ─────────────────────────────────────
  // These features must be live from the moment the first .bml file opens.

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
  registerMetrics(context);
  registerBmlTestRunner(context);
  registerBmlSnapshot(context);
  registerChatParticipant(context);
  registerEnvironmentSwitcher(context);

  // Sync BML skills into Antigravity's global config dir (~/.gemini/config/skills/)
  // so Antigravity IDE can discover them natively (on-demand, by name). Other AI
  // tools (Claude, Cursor, Copilot, Codex) receive skills via the MCP instructions
  // payload when they connect to the CPQ-BML MCP server — no files needed for them.
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

  // ── Icon Theme: activate by default on first run ────────────────────────────
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

  // ── Runtime Dynamic Folder Icon Sync ────────────────────────────────────────
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
