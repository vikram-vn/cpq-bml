let vscode;
try {
    vscode = require("vscode");
} catch {
    vscode = {};
}
const { handleMessage } = require("@/lang/settings/messageHandler");
const { titleForTab } = require("@/lang/settings/tabTitles");
const { hasMissingCredentials } = require("@/lang/rest/config");
const { getContext } = require("@/extensionContext");

let currentPanel = null;

// globalState flag ensures the first-run auto-open fires once per install, not per window.
const FIRST_INSTALL_KEY = "cpqBml.settingsPanel.openedOnInstall";
const AUTO_OPENED_SESSION_KEY = "cpqBml.settingsPanel.sessionAutoOpened";
const BML_OPEN_AUTO_OPENED_KEY = "cpqBml.settingsPanel.bmlOpenAutoOpened";

function shouldAutoOpenOnInstall(context) {
  const ctx = context || getContext();
  return ctx && ctx.globalState ? !ctx.globalState.get(FIRST_INSTALL_KEY, false) : false;
}

function registerSettingsPanel(context) {
  context = context || getContext();
  if (context && context.subscriptions) {
    context.subscriptions.push(
      vscode.commands.registerCommand("cpqBml.settings.open", (args) =>
        openPanel(context, vscode, args),
      ),
    );
  }

  const config = vscode.workspace.getConfiguration("cpqBml");
  const siteUrl = (config.get("connection.siteUrl", "") || "").trim();
  const environments = config.get("connection.environments", []) || [];
  const isConfigEmpty =
    !siteUrl && (!Array.isArray(environments) || environments.length === 0);
  const hasAutoOpenedThisSession = (context && context.workspaceState)
    ? context.workspaceState.get(AUTO_OPENED_SESSION_KEY, false)
    : false;

  const isTestEnv = () => {
    return !!(
      process.env.VSCODE_TEXTTEST_MODULE || typeof global.it === "function"
    );
  };

  const checkAndAutoOpenOnboard = async () => {
    if (isTestEnv()) {
      return;
    }

    const enabled = vscode.workspace
      .getConfiguration("cpqBml")
      .get("connection.enabled", true);
    if (!enabled) {
      return;
    }

    // Only auto-open if the workspace looks like a CPQ project (has a -meta.json file).
    const metaFiles = await vscode.workspace.findFiles(
      "**/*-meta.json",
      undefined,
      1,
    );
    if (!metaFiles || metaFiles.length === 0) {
      return;
    }

    if (
      shouldAutoOpenOnInstall(context) ||
      (isConfigEmpty && !hasAutoOpenedThisSession)
    ) {
      if (context && context.globalState) context.globalState.update(FIRST_INSTALL_KEY, true);
      if (context && context.workspaceState) context.workspaceState.update(AUTO_OPENED_SESSION_KEY, true);
      if (!siteUrl) {
        openPanel(context, vscode);
      }
    }
  };

  checkAndAutoOpenOnboard();

  const checkAndAutoOpenForBml = async (document) => {
    if (isTestEnv()) {
      return;
    }
    if (!document) {
      return;
    }

    const enabled = vscode.workspace
      .getConfiguration("cpqBml")
      .get("connection.enabled", true);
    if (!enabled) {
      return;
    }

    const isBml =
      document.languageId === "bml" ||
      (document.uri &&
        document.uri.path &&
        document.uri.path.toLowerCase().endsWith(".bml"));
    if (isBml) {
      const metaUri = document.uri.with({
        path: document.uri.path.replace(/\.bml$/i, "-meta.json"),
      });
      let hasMeta = false;
      try {
        await vscode.workspace.fs.stat(metaUri);
        hasMeta = true;
      } catch {
        hasMeta = false;
      }

      if (hasMeta) {
        const missing = await hasMissingCredentials(context, vscode);
        if (missing) {
          openPanel(context, vscode);
        }
      }
    }
  };

  if (vscode.window.activeTextEditor) {
    checkAndAutoOpenForBml(vscode.window.activeTextEditor.document);
  }

  if (context && context.subscriptions) {
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        checkAndAutoOpenForBml(document);
      }),
    );
  }
}

function openPanel(context, vscode, args) {
  const targetTab =
    typeof args === "string" ? args : (args && args.tab) || "connection";

  const { openWebPanel } = require("@/lang/web-panel/webPanelManager");
  const panel = openWebPanel(context, {
    page: "settings",
    payload: { tab: targetTab },
    vscodeInstance: vscode,
  });
  if (panel) {
    currentPanel = panel;
    return;
  }
}

module.exports = {
  registerSettingsPanel,
  shouldAutoOpenOnInstall,
  FIRST_INSTALL_KEY,
  BML_OPEN_AUTO_OPENED_KEY,
  hasMissingCredentials,
};
