const { createSettingsPanel } = require("./panel");
const { getHtml } = require("./html");
const { handleMessage } = require("./messageHandler");

// Singleton panel - re-invoking the command reveals the existing one instead
// of creating duplicates.
let currentPanel = null;

// globalState flag so the first-run auto-open (below) fires exactly once per
// install on this machine, regardless of how many windows/workspaces are
// opened afterward.
const FIRST_INSTALL_KEY = "cpqBml.settingsPanel.openedOnInstall";
const AUTO_OPENED_SESSION_KEY = "cpqBml.settingsPanel.sessionAutoOpened";
const BML_OPEN_AUTO_OPENED_KEY = "cpqBml.settingsPanel.bmlOpenAutoOpened";

function shouldAutoOpenOnInstall(context) {
  return !context.globalState.get(FIRST_INSTALL_KEY, false);
}

async function hasMissingCredentials(context, vscode) {
  const {
    getSettings,
    getPasswordSecretKey,
    getTokenSecretKey,
    SECRET_PASSWORD,
    SECRET_TOKEN,
  } = require("../rest/config");
  const { siteUrl, authMethod, username } = getSettings(vscode);
  if (!siteUrl) {
    return true;
  }
  if (authMethod === "bearer") {
    const siteSpecificKey = getTokenSecretKey(siteUrl);
    let token = await context.secrets.get(siteSpecificKey);
    if (!token) {
      token = await context.secrets.get(SECRET_TOKEN);
    }
    return !token;
  } else {
    if (!username) {
      return true;
    }
    const siteSpecificKey = getPasswordSecretKey(siteUrl, username);
    let password = await context.secrets.get(siteSpecificKey);
    if (!password) {
      password = await context.secrets.get(SECRET_PASSWORD);
    }
    return !password;
  }
}

function registerSettingsPanel(context) {
  const vscode = require("vscode");

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

    // Only auto-open if connection features are enabled
    const enabled = vscode.workspace
      .getConfiguration("cpqBml")
      .get("connection.enabled", true);
    if (!enabled) {
      return;
    }

    // Smart activation: Only auto-open settings panel if the workspace contains at least one -meta.json file,
    // which signals they want to use REST integration.
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

    // Only auto-open if connection features are enabled
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
      // Check if the corresponding -meta.json file exists in the same directory level
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

  // Check currently open document at activation
  if (vscode.window.activeTextEditor) {
    checkAndAutoOpenForBml(vscode.window.activeTextEditor.document);
  }

  // Listen for documents being opened in the workspace
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
    }
    return;
  }

  const panel = createSettingsPanel(context, vscode);
  currentPanel = panel;
  if (targetTab) {
    panel.targetTab = targetTab;
  }

  // If building the real HTML fails for any reason (e.g. a packaging issue
  // where webview/index.html didn't ship), fall back to a visible error
  // instead of leaving the panel silently blank with no way to tell why.
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
