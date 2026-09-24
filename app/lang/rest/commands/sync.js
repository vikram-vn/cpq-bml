const api = require("@/lang/rest/api");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  ensureCredentials,
} = require("@/lang/rest/commands/shared");

const { getExtensionContext, normalizeCommandArgs } = require("@/extensionContext");

async function runSyncCommerceMetadata(
  resultsTerminal,
  options = {},
) {
  const normArgs = normalizeCommandArgs(arguments);
  resultsTerminal = normArgs[0] || resultsTerminal;
  const effectiveOpts = (normArgs.length > 1 ? normArgs[1] : options) || {};
  const { process, document, fetchMenuItems = true, transport, onProgress: externalOnProgress } = effectiveOpts;
  const { vscode } = getExtensionContext();

  const hasCredentials = await ensureCredentials();
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

  const withProgress =
    vscode &&
    vscode.window &&
    typeof vscode.window.withProgress === "function"
      ? (task) =>
          vscode.window.withProgress(
            {
              location:
                (vscode.ProgressLocation && vscode.ProgressLocation.Notification) ||
                15,
              title: "CPQ-BML: Syncing Metadata",
              cancellable: true,
            },
            task,
          )
      : (task) =>
          task(
            { report: () => {} },
            { isCancellationRequested: false, onCancellationRequested: () => {} },
          );

  try {
    return await withProgress(async (progress, token) => {
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const signal = controller ? controller.signal : null;
      if (token && typeof token.onCancellationRequested === "function" && controller) {
        token.onCancellationRequested(() => controller.abort());
      }

      let lastReportedPercent = 0;
      const onProgress = (info) => {
        const msg = typeof info === "string" ? info : (info && info.message ? info.message : "");
        let increment;
        if (info && typeof info.percent === "number") {
          const delta = info.percent - lastReportedPercent;
          if (delta > 0) {
            increment = delta;
            lastReportedPercent = info.percent;
          }
        }
        if (progress && typeof progress.report === "function") {
          progress.report({ message: msg, increment });
        }
        if (externalOnProgress && typeof externalOnProgress === "function") {
          externalOnProgress(info);
        }
      };

      onProgress({ message: "Syncing commerce attributes...", percent: 0, stage: "commerce" });

      const data = await api.syncCommerceAttributes(
        { process, document, includeSubDocuments: true, fetchMenuItems, signal, onProgress },
        transport,
      );

      let configData = null;
      try {
        if (typeof api.syncConfigurationAttributes === "function") {
          onProgress({ message: "Syncing configuration attributes & models...", stage: "config" });
          configData = await api.syncConfigurationAttributes(
            { signal, onProgress },
            transport,
          );
        }
      } catch (cfgErr) {
        if (signal && signal.aborted) throw cfgErr;
        // Configuration module is optional; fail gracefully if not configured
      }

      const attrCount = Array.isArray(data.attributes) ? data.attributes.length : 0;
      const lineCount = Array.isArray(data.lineAttributes)
        ? data.lineAttributes.length
        : (data.lookups && Array.isArray(data.lookups.transactionLine) ? data.lookups.transactionLine.length : 0);
      const sysCount = Array.isArray(data.systemAttributes)
        ? data.systemAttributes.length
        : 0;
      const cfgCount =
        configData && Array.isArray(configData.attributes)
          ? configData.attributes.length
          : 0;

      if (vscode && vscode.commands && typeof vscode.commands.executeCommand === "function") {
        vscode.commands.executeCommand(
          "setContext",
          "cpqBml.commerceMetadataSynced",
          true,
        );
      }

      let msg = lineCount > 0
        ? `Synced ${attrCount} header attributes, ${lineCount} line attributes, ${sysCount} systemAttributes`
        : `Synced ${attrCount} attributes, ${sysCount} systemAttributes`;
      if (cfgCount > 0) {
        msg += `, ${cfgCount} configAttributes`;
      }
      msg += ` (${formatElapsed(startedAt)})`;
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
        configData,
      };
    });
  } catch (err) {
    const isCancelled =
      err &&
      (err.message === "Request aborted" ||
        err.message === "Sync cancelled" ||
        err.name === "AbortError");
    const message = isCancelled
      ? "Sync cancelled by user."
      : `failed to sync commerce metadata. ${err.message || describeError(err)}`;
    if (resultsTerminal) {
      writeTerminalMessage(
        resultsTerminal,
        isCancelled ? "Sync cancelled: " : "Sync failed: ",
        `${message} (${formatElapsed(startedAt)})`,
        isCancelled ? "\x1b[33m" : "\x1b[31m",
      );
      resultsTerminal.show();
    }
    if (vscode && vscode.window) {
      if (isCancelled) {
        if (typeof vscode.window.showWarningMessage === "function") {
          vscode.window.showWarningMessage(`CPQ-BML: ${message}`);
        }
      } else {
        vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
      }
    }
    return {
      success: false,
      errorMessage: message,
    };
  }
}

async function runSyncAllMetadata(terminal, onProgress) {
  const normArgs = normalizeCommandArgs(arguments);
  terminal = normArgs[0] || terminal;
  onProgress = normArgs[1] || onProgress;
  const { syncConfigurationAttributes } = require("@/lang/rest/apiConfig");
  const commRes = await runSyncCommerceMetadata(terminal, {
    fetchMenuItems: false,
    onProgress,
  });
  let configCount = 0;
  try {
    if (onProgress && typeof onProgress === "function") {
      onProgress({ message: "Syncing configuration attributes...", stage: "config" });
    }
    const cfgRes = await syncConfigurationAttributes({ limit: 1000, onProgress });
    configCount = cfgRes ? cfgRes.count : 0;
  } catch (e) {}
  return {
    success: commRes ? commRes.success : true,
    commerceCount: commRes && commRes.data && commRes.data.attributes ? commRes.data.attributes.length : 0,
    configCount,
  };
}

async function runRemoveCommerceMetadata(terminal) {
  const normArgs = normalizeCommandArgs(arguments);
  terminal = normArgs[0] || terminal;
  const { vscode } = getExtensionContext();
  const { removeMetadata, getWorkspaceRoot } = require("@/lang/rest/commerceAttributes");
  const wsRoot = getWorkspaceRoot();
  removeMetadata(wsRoot);
  if (terminal) {
    writeRunHeader(terminal, "Remove", "Offline Metadata");
    writeTerminalMessage(terminal, "Offline cached metadata removed successfully.");
  }
  if (vscode && vscode.window && typeof vscode.window.showInformationMessage === "function") {
    vscode.window.showInformationMessage("CPQ-BML: Offline cached metadata removed successfully.");
  }
  return { success: true };
}

module.exports = {
  runSyncCommerceMetadata,
  runSyncAllMetadata,
  runRemoveCommerceMetadata,
};
