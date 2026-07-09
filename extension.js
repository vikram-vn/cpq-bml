const net = require("net");
const vscode = require("vscode");

// How long Node's Happy Eyeballs (RFC 8305) dual-stack connection attempt waits
// before racing the next address family, for any outbound request this extension
// makes. Not available on every Node version the extension host may bundle.
const DEFAULT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS = 1000;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
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

  const { registerBeautifier } = require("./app/lang/beautify");
  const { registerDocHeaderCompletion } = require("./app/lang/beautify/docHeader");
  const { beautifyWorkspaceCommand } = require("./app/lang/beautify/commandWorkspace");
  const { registerBmlIntelliSense } = require("./app/lang/intellisense");
  const { registerBmlLinter } = require("./app/lang/lint");
  const { registerBmlComments } = require("./app/lang/comments");

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

  // ── Deferred path: register after the event loop yields ─────────────────────
  // These features are command/webview-driven and don't need to block activation.
  // setImmediate() lets VS Code finish showing the editor before we wire these up,
  // measurably reducing the extension's reported activation time.
  setImmediate(() => {
    const { registerBmlRest } = require("./app/lang/rest");
    const { registerSettingsPanel } = require("./app/lang/settings-panel");
    const { registerMcp } = require("./app/lang/mcp");
    const { registerXslt } = require("./app/lang/xslt");
    const { registerMetrics } = require("./app/lang/metrics");
    const { registerBmlTestRunner, registerBmlSnapshot } = require("./app/lang/testing");
    const { registerAiSetup } = require("./app/lang/ai-setup");

    registerBmlRest(context);
    registerSettingsPanel(context);
    registerMcp(context);
    registerXslt(context);
    registerMetrics(context);
    registerBmlTestRunner(context);
    registerBmlSnapshot(context);
    registerAiSetup(context);
  });
}

function deactivate() {}

module.exports = { activate, deactivate };
