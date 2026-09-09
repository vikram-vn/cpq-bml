const config = require("../rest/config");
const {
  writePassword,
  writeAuthToken,
  deletePassword,
  deleteAuthToken,
} = require("../rest/commands/secrets");
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
  "inlayHints.variableTypes",
  "inlayHints.variableTypes.enabled",
  "mcp.enable",
  "mcp.port",
  "mcp.logToTerminal",
  "debug.logRestDetails",
  "debug.logOutputToFile",
  "debug.showResultsAsTable",
  "debug.concurrency",
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
      let { key, value } = message;
      if (!ALLOWED_FIELDS.has(key)) {
        throw new Error(`CPQ-BML: unknown setting "${key}".`);
      }
      if (key === "inlayHints.variableTypes") {
        key = "inlayHints.variableTypes.enabled";
      }
      if (key === "debug.concurrency") {
        value = Math.max(2, Math.min(10, Math.round(Number(value)) || 2));
      }
      await vscode.workspace
        .getConfiguration(CPQ_SECTION)
        .update(key, value, vscode.ConfigurationTarget.Global);
      await sendState();
      return;
    }

    case "setPassword":
      await writePassword(context, vscode, message.value);
      await sendState();
      return;

    case "clearPassword":
      await deletePassword(context, vscode);
      await sendState();
      post({ type: "toast", message: "Password cleared successfully" });
      return;

    case "setAuthToken":
      await writeAuthToken(context, vscode, message.value);
      await sendState();
      return;

    case "clearAuthToken":
      await deleteAuthToken(context, vscode);
      await sendState();
      post({ type: "toast", message: "Auth token cleared successfully" });
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

    case "syncMetadata": {
      const { runSyncAllMetadata } = require("../rest/commands/sync");
      try {
        post({
          type: "syncProgress",
          isSyncing: true,
          message: "Starting metadata sync...",
          percent: 0,
        });
        const res = await runSyncAllMetadata(context, vscode, null, (info) => {
          post({
            type: "syncProgress",
            isSyncing: true,
            message: typeof info === "string" ? info : (info && info.message ? info.message : ""),
            percent: info && typeof info.percent === "number" ? info.percent : null,
            current: info && typeof info.current === "number" ? info.current : null,
            total: info && typeof info.total === "number" ? info.total : null,
            stage: info && info.stage ? info.stage : null,
          });
        });
        await sendState();
        post({
          type: "syncProgress",
          isSyncing: false,
          message: "Metadata sync completed.",
          percent: 100,
          done: true,
        });
        if (res && res.success) {
          post({
            type: "toast",
            message: `Metadata synced: ${res.commerceCount || 0} Commerce, ${res.configCount || 0} Config attributes.`,
          });
        } else {
          post({ type: "toast", message: "Metadata sync completed." });
        }
      } catch (err) {
        post({
          type: "syncProgress",
          isSyncing: false,
          message: `Sync failed: ${err.message}`,
          error: true,
          done: true,
        });
        post({ type: "error", message: `Sync failed: ${err.message}` });
      }
      return;
    }

    case "removeMetadata": {
      const { removeMetadata, getWorkspaceRoot } = require("../rest/commerceAttributes");
      removeMetadata(context, getWorkspaceRoot(vscode), vscode);
      await sendState();
      post({ type: "toast", message: "Metadata cache removed successfully." });
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

    case "toast":
      if (message.message) {
        post({ type: "toast", message: message.message });
      }
      return;

    case "importSettings": {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { "JSON Files": ["json"] },
        title: "Import CPQ-BML Settings",
      });
      if (!uris || uris.length === 0) {
        return;
      }
      try {
        const fileData = await vscode.workspace.fs.readFile(uris[0]);
        const jsonStr = Buffer.from(fileData).toString("utf8");
        const imported = JSON.parse(jsonStr);
        const settingsObj = imported.settings || imported;
        const cfg = vscode.workspace.getConfiguration(CPQ_SECTION);

        if (settingsObj.connection) {
          if (typeof settingsObj.connection.siteUrl === "string") {
            await cfg.update("connection.siteUrl", settingsObj.connection.siteUrl, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.connection.authMethod === "string") {
            await cfg.update("connection.authMethod", settingsObj.connection.authMethod, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.connection.username === "string") {
            await cfg.update("connection.username", settingsObj.connection.username, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.connection.enabled === "boolean") {
            await cfg.update("connection.enabled", settingsObj.connection.enabled, vscode.ConfigurationTarget.Global);
          }
        }
        if (Array.isArray(settingsObj.environments || (settingsObj.connection && settingsObj.connection.environments))) {
          const envs = settingsObj.environments || settingsObj.connection.environments;
          await cfg.update("connection.environments", envs, vscode.ConfigurationTarget.Global);
        }
        if (settingsObj.rest) {
          if (typeof settingsObj.rest.pullFolder === "string") {
            await cfg.update("rest.pullFolder", settingsObj.rest.pullFolder, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.rest.restVersion === "string") {
            await cfg.update("rest.restVersion", settingsObj.rest.restVersion, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.rest.commerceProcess === "string") {
            await cfg.update("rest.commerceProcess", settingsObj.rest.commerceProcess, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.rest.commerceDocument === "string") {
            await cfg.update("rest.commerceDocument", settingsObj.rest.commerceDocument, vscode.ConfigurationTarget.Global);
          }
        }
        if (settingsObj.features && typeof settingsObj.features === "object") {
          for (const [fKey, fVal] of Object.entries(settingsObj.features)) {
            if (typeof fVal === "boolean") {
              await cfg.update(`features.${fKey}`, fVal, vscode.ConfigurationTarget.Global);
            }
          }
        }
        if (settingsObj.inlayHints) {
          if (typeof settingsObj.inlayHints.enabled === "boolean") {
            await cfg.update("inlayHints.enabled", settingsObj.inlayHints.enabled, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.inlayHints.suppressWhenArgumentMatchesName === "boolean") {
            await cfg.update("inlayHints.suppressWhenArgumentMatchesName", settingsObj.inlayHints.suppressWhenArgumentMatchesName, vscode.ConfigurationTarget.Global);
          }
          if (settingsObj.inlayHints.variableTypes !== undefined) {
            const vtVal = typeof settingsObj.inlayHints.variableTypes === "object"
              ? settingsObj.inlayHints.variableTypes.enabled
              : settingsObj.inlayHints.variableTypes;
            if (typeof vtVal === "boolean") {
              await cfg.update("inlayHints.variableTypes.enabled", vtVal, vscode.ConfigurationTarget.Global);
            }
          }
        }
        if (settingsObj.mcp) {
          if (typeof settingsObj.mcp.enable === "boolean") {
            await cfg.update("mcp.enable", settingsObj.mcp.enable, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.mcp.port === "number") {
            await cfg.update("mcp.port", settingsObj.mcp.port, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.mcp.logToTerminal === "boolean") {
            await cfg.update("mcp.logToTerminal", settingsObj.mcp.logToTerminal, vscode.ConfigurationTarget.Global);
          }
        }
        if (settingsObj.debug) {
          if (typeof settingsObj.debug.logOutputToFile === "boolean") {
            await cfg.update("debug.logOutputToFile", settingsObj.debug.logOutputToFile, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.debug.logRestDetails === "boolean") {
            await cfg.update("debug.logRestDetails", settingsObj.debug.logRestDetails, vscode.ConfigurationTarget.Global);
          }
          if (typeof settingsObj.debug.showResultsAsTable === "boolean") {
            await cfg.update("debug.showResultsAsTable", settingsObj.debug.showResultsAsTable, vscode.ConfigurationTarget.Global);
          }
        }

        await sendState();
        vscode.window.showInformationMessage("CPQ-BML: Settings imported successfully.");
        post({ type: "toast", message: "Settings imported successfully" });
      } catch (err) {
        vscode.window.showErrorMessage(`CPQ-BML Import Failed: ${err.message}`);
        post({ type: "error", message: `Import Failed: ${err.message}` });
      }
      return;
    }
    case "exportSettings": {
      try {
        const cpqConfig = vscode.workspace.getConfiguration(CPQ_SECTION);
        const exportData = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          settings: {
            connection: {
              siteUrl: cpqConfig.get("connection.siteUrl", ""),
              authMethod: cpqConfig.get("connection.authMethod", "basic"),
              username: cpqConfig.get("connection.username", ""),
              enabled: cpqConfig.get("connection.enabled", true),
            },
            rest: {
              pullFolder: cpqConfig.get("rest.pullFolder", ""),
              restVersion: cpqConfig.get("rest.restVersion", "v17"),
              commerceProcess: cpqConfig.get("rest.commerceProcess", ""),
              commerceDocument: cpqConfig.get("rest.commerceDocument", ""),
            },
            features: {
              lint: cpqConfig.get("features.lint", true),
              comments: cpqConfig.get("features.comments", true),
              spelling: cpqConfig.get("features.spelling", true),
              beautifier: cpqConfig.get("features.beautifier", true),
              intellisense: cpqConfig.get("features.intellisense", true),
              docHeader: cpqConfig.get("features.docHeader", true),
              xslt: cpqConfig.get("features.xslt", true),
              metrics: cpqConfig.get("features.metrics", true),
              testing: cpqConfig.get("features.testing", true),
            },
            inlayHints: {
              enabled: cpqConfig.get("inlayHints.enabled", true),
              suppressWhenArgumentMatchesName: cpqConfig.get("inlayHints.suppressWhenArgumentMatchesName", true),
              variableTypes: {
                enabled: cpqConfig.get("inlayHints.variableTypes.enabled", false),
              },
            },
            mcp: {
              enable: cpqConfig.get("mcp.enable", false),
              port: cpqConfig.get("mcp.port", 47821),
              logToTerminal: cpqConfig.get("mcp.logToTerminal", false),
              aiSkills: cpqConfig.get("mcp.aiSkills", {}),
            },
            debug: {
              logOutputToFile: cpqConfig.get("debug.logOutputToFile", false),
              logRestDetails: cpqConfig.get("debug.logRestDetails", false),
              showResultsAsTable: cpqConfig.get("debug.showResultsAsTable", false),
            },
            environments: cpqConfig.get("connection.environments", []),
          },
        };

        const defaultUri = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
          ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, "cpq-bml-settings.json")
          : undefined;

        const uri = await vscode.window.showSaveDialog({
          defaultUri,
          filters: { "JSON Files": ["json"] },
          title: "Export CPQ-BML Settings",
        });

        if (!uri) {
          return;
        }

        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(JSON.stringify(exportData, null, 2), "utf8")
        );
        vscode.window.showInformationMessage(`CPQ-BML: Settings exported successfully.`);
        post({ type: "toast", message: "Settings exported successfully" });
      } catch (err) {
        vscode.window.showErrorMessage(`CPQ-BML Export Failed: ${err.message}`);
        post({ type: "error", message: `Export Failed: ${err.message}` });
      }
      return;
    }
    case "requestPerformanceStats": {
      // Simple performance stats using Node process APIs.
      const cpu = process.cpuUsage();
      const memory = process.memoryUsage();
      const cpuPercent = (cpu.user + cpu.system) / 1000; // Approx ms
      const memMb = Math.round(memory.rss / (1024 * 1024));
      post({ type: "performanceStats", cpu: cpuPercent, memory: memMb });
      return;
    }
    case "getMcpHealth": {
      // Return basic health based on MCP enable flag.
      post({ type: "mcpHealth", healthy: mcp.enable, port: mcp.port });
      return;
    }
    case "resetSettings": {
      const cfg = vscode.workspace.getConfiguration(CPQ_SECTION);
      const defaults = {
        "connection.siteUrl": "",
        "connection.authMethod": "basic",
        "connection.username": "",
        "connection.enabled": true,
        "rest.pullFolder": "library",
        "rest.restVersion": "v18",
        "rest.commerceProcess": "oraclecpqo",
        "rest.commerceDocument": "transaction",
        "features.lint": true,
        "features.comments": true,
        "features.spelling": true,
        "features.beautifier": true,
        "features.intellisense": true,
        "features.docHeader": true,
        "features.xslt": true,
        "features.metrics": true,
        "features.testing": true,
        "inlayHints.enabled": true,
        "inlayHints.suppressWhenArgumentMatchesName": true,
        "inlayHints.variableTypes.enabled": false,
        "mcp.enable": false,
        "mcp.port": 47821,
        "mcp.logToTerminal": false,
        "debug.logOutputToFile": false,
        "debug.logRestDetails": false,
        "debug.showResultsAsTable": false,
      };

      for (const [k, v] of Object.entries(defaults)) {
        await cfg.update(k, v, vscode.ConfigurationTarget.Global);
      }
      await sendState();
      vscode.window.showInformationMessage("CPQ-BML: Settings successfully reset to factory defaults.");
      post({ type: "toast", message: "Settings reset to defaults" });
      return;
    }
    case "cleanAiWorkspaceFiles": {
      const { cleanAllAiWorkspaceFiles } = require("../../ai/setup/workspaceAiCleaner");
      const wsFolders = vscode.workspace && vscode.workspace.workspaceFolders;
      if (wsFolders && wsFolders.length > 0) {
        const removed = cleanAllAiWorkspaceFiles(wsFolders[0].uri.fsPath);
        vscode.window.showInformationMessage(`CPQ-BML: Removed AI workspace files: ${removed.join(", ") || "None found"}`);
        post({ type: "toast", message: "AI files removed from workspace" });
      }
      await sendState();
      return;
    }

    default:
      throw new Error(`CPQ-BML: unknown message type "${message.type}".`);
  }
}

module.exports = { handleMessage, ALLOWED_FIELDS };
