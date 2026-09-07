const api = require("../api");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  ensureCredentials,
} = require("./shared");

async function runSyncCommerceMetadata(
  context,
  vscode,
  resultsTerminal,
  { process, document, fetchMenuItems = true, transport } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return {
      success: false,
      errorMessage: "CPQ-BML: credentials are not configured.",
    };
  }

  const workspaceFolders =
    vscode && vscode.workspace && vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    if (vscode && vscode.window) {
      vscode.window.showErrorMessage(
        "CPQ-BML: open a workspace folder before syncing commerce metadata.",
      );
    }
    return {
      success: false,
      errorMessage: "No workspace folder open.",
    };
  }

  if (resultsTerminal) {
    writeRunHeader(resultsTerminal, "Sync", "Commerce Metadata");
    writeRunningLine(resultsTerminal, "Sync", "Commerce Metadata");
    resultsTerminal.show();
  }

  const startedAt = Date.now();

  try {
    const data = await api.syncCommerceAttributes(
      context,
      vscode,
      { process, document, fetchMenuItems },
      transport,
    );

    const attrCount = Array.isArray(data.attributes) ? data.attributes.length : 0;
    const sysCount = Array.isArray(data.systemAttributes)
      ? data.systemAttributes.length
      : 0;

    if (vscode && vscode.commands && typeof vscode.commands.executeCommand === "function") {
      vscode.commands.executeCommand(
        "setContext",
        "cpqBml.commerceMetadataSynced",
        true,
      );
    }

    const msg = `Synced ${attrCount} attributes, ${sysCount} systemAttributes (${formatElapsed(startedAt)})`;
    if (resultsTerminal) {
      writeTerminalMessage(
        resultsTerminal,
        "Sync complete: ",
        msg,
        "\x1b[32m",
      );
      resultsTerminal.show();
    }

    if (vscode && vscode.window) {
      vscode.window.showInformationMessage(`CPQ-BML: ${msg}`);
    }

    return {
      success: true,
      data,
    };
  } catch (err) {
    const message = `failed to sync commerce metadata. ${err.message || describeError(err)}`;
    if (resultsTerminal) {
      writeTerminalMessage(
        resultsTerminal,
        "Sync failed: ",
        `${message} (${formatElapsed(startedAt)})`,
        "\x1b[31m",
      );
      resultsTerminal.show();
    }
    if (vscode && vscode.window) {
      vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
    }
    return {
      success: false,
      errorMessage: message,
    };
  }
}

module.exports = {
  runSyncCommerceMetadata,
};
