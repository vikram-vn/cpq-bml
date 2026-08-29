let vscode;
try {
    vscode = require("vscode");
} catch {
    vscode = {};
}
const { createSettingsPanel } = require("./panel");
const { getHtml } = require("./html");
const { handleMessage } = require("./messageHandler");
const { titleForTab } = require("./tabTitles");
const { hasMissingCredentials } = require("../rest/config");

let currentPanel = null;

// globalState flag ensures the first-run auto-open fires once per install, not per window.
const FIRST_INSTALL_KEY = "cpqBml.settingsPanel.openedOnInstall";
const AUTO_OPENED_SESSION_KEY = "cpqBml.settingsPanel.sessionAutoOpened";
const BML_OPEN_AUTO_OPENED_KEY = "cpqBml.settingsPanel.bmlOpenAutoOpened";

function shouldAutoOpenOnInstall(context) {
  return !context.globalState.get(FIRST_INSTALL_KEY, false);
}

function registerSettingsPanel(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cpqBml.settings.open", (args) =>
      openPanel(context, vscode, args),
    ),
  );

  const config = vscode.workspace.getConfiguration("cpqBml");
  const siteUrl = (config.get("connection.siteUrl", "") || "").trim();
  const environments = config.get("connection.environments", []) || [];
  const isConfigEmpty =
    !siteUrl && (!Array.isArray(environments) || environments.length === 0);
  const hasAutoOpenedThisSession = context.workspaceState.get(
    AUTO_OPENED_SESSION_KEY,
    false,
  );

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
      context.globalState.update(FIRST_INSTALL_KEY, true);
      context.workspaceState.update(AUTO_OPENED_SESSION_KEY, true);
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

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      checkAndAutoOpenForBml(document);
    }),
  );
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function openPanel(context, vscode, args) {
  const targetTab =
    typeof args === "string" ? args : (args && args.tab) || "connection";

  if (currentPanel) {
    currentPanel.reveal();
    if (targetTab) {
      currentPanel.webview.postMessage({ type: "switchTab", tab: targetTab });
      currentPanel.title = titleForTab(targetTab);
    }
    return;
  }

  const panel = createSettingsPanel(context, vscode);
  currentPanel = panel;
  if (targetTab) {
    panel.targetTab = targetTab;
    panel.title = titleForTab(targetTab);
  }

  // Fall back to a visible error instead of a silently blank panel if HTML fails to build.
  try {
    panel.webview.html = getHtml(context, vscode, panel.webview);
  } catch (err) {
    panel.webview.html =
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:16px;">` +
      `<h3>CPQ-BML: Connection Settings failed to load</h3>` +
      `<pre style="white-space:pre-wrap;">${escapeHtml(err && err.stack ? err.stack : err)}</pre>` +
      `</body></html>`;
    vscode.window.showErrorMessage(
      `CPQ-BML: failed to Open Settings - ${err.message}`,
    );
  }

  panel.webview.onDidReceiveMessage((message) =>
    handleMessage(message, context, vscode, panel),
  );
  panel.onDidDispose(() => {
    currentPanel = null;
  });
}

module.exports = {
  registerSettingsPanel,
  shouldAutoOpenOnInstall,
  FIRST_INSTALL_KEY,
  BML_OPEN_AUTO_OPENED_KEY,
  hasMissingCredentials,
};
