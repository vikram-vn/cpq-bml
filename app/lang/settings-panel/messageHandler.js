const config = require("../rest/config");
const { writePassword, writeAuthToken } = require("../rest/commands/secrets");
const { autoSetupAiSkills } = require("../../ai/setup");
const {
  applyEnvironment,
  addEnvironment,
  updateEnvironment,
  deleteEnvironment,
} = require("../rest/commands/env");
const { buildState } = require("./state");
const { titleForTab } = require("./tabTitles");

const CPQ_SECTION = "cpqBml";

// Settings the webview may write via 'updateField'; secrets have dedicated message types below.
const ALLOWED_FIELDS = new Set([
  "connection.enabled",
  "connection.siteUrl",
  "connection.authMethod",
  "connection.username",
  "rest.restVersion",
  "rest.commerceProcess",
  "rest.commerceDocument",
  "rest.pullFolder",
  "features.lint",
  "features.comments",
  "features.spelling",
  "features.beautifier",
  "features.intellisense",
  "features.docHeader",
  "features.xslt",
  "features.metrics",
  "features.testing",
  "inlayHints.enabled",
  "inlayHints.suppressWhenArgumentMatchesName",
  "inlayHints.variableTypes.enabled",
  "mcp.enable",
  "mcp.port",
  "mcp.logToTerminal",
  "mcp.aiSkills.claude",
  "mcp.aiSkills.cursor",
  "mcp.aiSkills.copilot",
  "debug.logRestDetails",
  "debug.logOutputToFile",
  "debug.showResultsAsTable",
]);

// Every mutating case re-sends a fresh 'state' snapshot so the webview never relies on stale state.
async function handleMessage(message, context, vscode, panel) {
  try {
    await dispatch(message || {}, context, vscode, panel);
  } catch (err) {
    panel.webview.postMessage({ type: "error", message: err.message });
  }
}

async function dispatch(message, context, vscode, panel) {
  const post = (msg) => panel.webview.postMessage(msg);
  const sendState = async () =>
    post({ type: "state", ...(await buildState(context, vscode)) });

  switch (message.type) {
    case "ready": {
      const state = await buildState(context, vscode);
      if (panel.targetTab) {
        state.activeTab = panel.targetTab;
        panel.targetTab = null;
      }
      post({ type: "state", ...state });
      return;
    }

    case "updateField": {
      const { key, value } = message;
      if (!ALLOWED_FIELDS.has(key)) {
        throw new Error(`CPQ-BML: unknown setting "${key}".`);
      }
      await vscode.workspace
        .getConfiguration(CPQ_SECTION)
        .update(key, value, vscode.ConfigurationTarget.Global);
        
      // Re-sync on the initial MCP enable, or whenever a specific tool's AI
      // skills toggle changes after MCP is already enabled - autoSetupAiSkills
      // scaffolds newly-enabled tools AND removes the native folder for any
      // tool just switched off, so the workspace always matches the toggles.
      // Toggling an aiSkills.* setting while MCP itself is off has no effect
      // until MCP is enabled.
      const isInitialMcpEnable = key === "mcp.enable" && value === true;
      const isAiSkillsToggleChange = key.startsWith("mcp.aiSkills.") &&
        vscode.workspace.getConfiguration(CPQ_SECTION).get("mcp.enable", false);
      if (isInitialMcpEnable || isAiSkillsToggleChange) {
        await autoSetupAiSkills(context);
      }

      await sendState();
      return;
    }

    case "setPassword":
      await writePassword(context, vscode, message.value);
      await sendState();
      return;

    case "setAuthToken":
      await writeAuthToken(context, vscode, message.value);
      await sendState();
      return;

    case "testConnection": {
      const result = await config.runTestConnection(context, vscode);
      post({
        type: "testConnectionResult",
        ok: result.ok,
        message: result.message,
      });
      return;
    }

    case "activateEnvironment": {
      const environments =
        vscode.workspace
          .getConfiguration(CPQ_SECTION)
          .get("connection.environments", []) || [];
      const env = environments[message.index];
      if (!env) throw new Error("CPQ-BML: environment index out of range.");
      await applyEnvironment(vscode, env);
      await sendState();
      return;
    }

    case "addEnvironment":
      await addEnvironment(vscode, message.env);
      await sendState();
      return;

    case "updateEnvironment":
      await updateEnvironment(vscode, message.index, message.env);
      await sendState();
      return;

    case "deleteEnvironment":
      await deleteEnvironment(vscode, message.index);
      await sendState();
      return;

    case "openNativeSettings":
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        message.filter || CPQ_SECTION,
      );
      return;

    // User clicked a different tab in the sidebar - keep the editor tab title in sync.
    case "tabChanged":
      panel.title = titleForTab(message.tab);
      return;

    default:
      throw new Error(`CPQ-BML: unknown message type "${message.type}".`);
  }
}

module.exports = { handleMessage, ALLOWED_FIELDS };
