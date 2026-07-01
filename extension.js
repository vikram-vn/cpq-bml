const net = require("net");
const vscode = require("vscode");
const { registerBmlIntelliSense } = require("./app/lang/intellisense");
const { registerBeautifier } = require("./app/lang/beautify");
const { registerDocHeaderCompletion } = require("./app/lang/beautify/docHeader");
const { registerBmlLinter } = require("./app/lang/lint");
const { registerBmlComments } = require("./app/lang/comments");
const { registerBmlRest } = require("./app/lang/rest");
const { registerMcp } = require("./app/lang/mcp");
const { registerSettingsPanel } = require("./app/lang/settingsPanel");
const { registerXslt } = require("./app/lang/xslt");
const { beautifyWorkspaceCommand } = require("./app/lang/beautify/commandWorkspace");
const { registerMetrics } = require("./app/lang/metrics");
const { registerBmlTestRunner, registerBmlSnapshot } = require("./app/lang/testing");

// How long Node's Happy Eyeballs (RFC 8305) dual-stack connection attempt waits
// before racing the next address family, for any outbound request this extension
// makes. Not available on every Node version the extension host may bundle.
const DEFAULT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS = 1000;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("CPQ-BML extension is now active!");

  if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
    net.setDefaultAutoSelectFamilyAttemptTimeout(
      DEFAULT_AUTO_SELECT_FAMILY_ATTEMPT_TIMEOUT_MS,
    );
  }

  // Example command
  const disposable = vscode.commands.registerCommand("cpq", () => {
    vscode.window.showInformationMessage("Thank you for using CPQ-BML!");
  });
  context.subscriptions.push(disposable);

  // Register Beautifier
  registerBeautifier(context);

  // Register IntelliSense (completion, hover, signature help, go-to-def, references, rename, symbols)
  registerBmlIntelliSense(context);

  // Register Auto Doc-Header completion (/// trigger)
  registerDocHeaderCompletion(context);

  // Register BMLint (real-time diagnostics)
  registerBmlLinter(context);

  // Register BML Better Comments (tag/directive/docHeader decorations + hover)
  registerBmlComments(context);

  // Register BML REST (live Oracle CPQ Util Library Function integration)
  registerBmlRest(context);

  // Register MCP server (lets an AI agent call the BML REST tools directly)
  registerMcp(context);

  // Register the WebView connection settings panel
  registerSettingsPanel(context);

  // Register XSLT preview & formatting support
  registerXslt(context);

  // Register Code Metrics report (cpqBml.metrics.openReport)
  registerMetrics(context);

  // Register BML Test Runner (cpqBml.test.runTests)
  registerBmlTestRunner(context);

  // Register BML Snapshot testing (cpqBml.test.updateSnapshot / compareSnapshot)
  registerBmlSnapshot(context);

  // Register workspace-wide BML beautify command
  const workspaceCmd = vscode.commands.registerCommand('cpqBml.beautifyWorkspace', beautifyWorkspaceCommand);
  context.subscriptions.push(workspaceCmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
