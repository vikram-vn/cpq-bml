const api = require("@/lang/rest/api");
const metadataLib = require("@/lang/rest/metadata");
const { getCommerceProcess, getSettings, getBaseUrl } = require("@/lang/rest/config");
const { runPreflightSafetyCheck, formatPreflightSummary } = require("@/lang/rest/preflightChecker");
const { saveSnapshot } = require("@/lang/rest/snapshotManager");
const { compareAndPromptPreDeploy } = require("@/lang/rest/deployDiffReviewer");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  isSuccess,
  resolveMetadataForFile,
  ensureCredentials,
} = require("@/lang/rest/commands/shared");
const { getExtensionContext, normalizeCommandArgs } = require("@/extensionContext");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function handleDeployError(err, startedAt, resultsTerminal, vscodeArg, prefix = "deploy") {
  const vscode = vscodeArg || getExtensionContext().vscode;
  const isTimeout = /timeout/i.test(err && (err.message || String(err))) || (err && err.code === "ETIMEDOUT");
  const elapsed = formatElapsed(startedAt);
  const rawMsg = (err && (err.message || String(err))) || "unknown error";
  const detailedMsg = isTimeout
    ? `CPQ-BML: ${prefix} request timed out (${elapsed}). The CPQ server may still be deploying in the background. You can increase the deployment timeout in settings ('cpqBml.rest.deployTimeoutMs') or check the CPQ Deployment Center.`
    : `CPQ-BML: ${prefix} failed: ${rawMsg} (${elapsed})`;

  if (resultsTerminal) {
    writeTerminalMessage(
      resultsTerminal,
      isTimeout ? "Deployment timed out: " : "Deployment error: ",
      `${rawMsg} (${elapsed})`,
      "\x1b[31m",
    );
    if (isTimeout) {
      resultsTerminal.writeLine(
        `\x1b[33m${getTimestamp()} Tip: Large scripts or instances with high load take longer to compile on CPQ. Increase cpqBml.rest.deployTimeoutMs in Settings.\x1b[0m`,
      );
    }
    resultsTerminal.show();
  }

  if (vscode && vscode.window && typeof vscode.window.showErrorMessage === "function") {
    const actions = isTimeout ? ["Open Deployment Center", "Open Settings"] : [];
    const promise = vscode.window.showErrorMessage(detailedMsg, ...actions);
    if (promise && typeof promise.then === "function") {
      promise.then((choice) => {
        if (choice === "Open Deployment Center" && vscode.commands && typeof vscode.commands.executeCommand === "function") {
          vscode.commands.executeCommand("cpqBml.cloud.refreshDeploymentCenter");
        } else if (choice === "Open Settings" && vscode.commands && typeof vscode.commands.executeCommand === "function") {
          vscode.commands.executeCommand("workbench.action.openSettings", "cpqBml.rest");
        }
      });
    }
  }

  return {
    success: false,
    errorMessage: detailedMsg,
    isTimeout,
    elapsedMs: Date.now() - startedAt,
  };
}

// Polls until the task leaves the queued/running state, so we report the real outcome instead of "queued" as "deployed".
async function pollTaskStatus(
  taskId,
  transport,
  options = {},
) {
  if (typeof taskId !== 'string' && typeof transport === 'string') {
    // Legacy (context, vscode, taskId, transport, options)
    taskId = arguments[2];
    transport = arguments[3];
    options = arguments[4] || {};
  }
  const { intervalMs = 3000, timeoutMs = 120000, resultsTerminal } = options || {};
  const deadline = Date.now() + timeoutMs;
  let lastBody = null;
  for (;;) {
    try {
      const result = await api.getTask(taskId, transport);
      if (result && result.body) lastBody = result.body;
      const status = isSuccess(result.statusCode) && result.body && result.body.status;
      if (status && /complete|error|fail/i.test(status)) {
        return { status, body: result.body, timedOut: false };
      }
    } catch (err) {
      if (resultsTerminal) {
        resultsTerminal.writeLine(
          `\x1b[90m${getTimestamp()} Transient issue polling task ${taskId}: ${err.message || err}. Retrying...\x1b[0m`,
        );
      }
    }
    if (Date.now() >= deadline) {
      return { status: null, body: lastBody, timedOut: true };
    }
    await delay(intervalMs);
  }
}

async function runDeployCommerceProcess(
  resultsTerminal,
  options = {},
) {
  const normArgs = normalizeCommandArgs(arguments);
  resultsTerminal = normArgs[0] || resultsTerminal;
  const effectiveOpts = (normArgs.length > 1 ? normArgs[1] : options) || {};
  const { transport, pollIntervalMs, pollTimeoutMs } = effectiveOpts;
  const { vscode } = getExtensionContext();

  const hasCredentials = await ensureCredentials();
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  const editor = vscode.window.activeTextEditor;
  let processVarName = '';

  if (editor && editor.document.languageId === 'bml') {
    const metadata = await resolveMetadataForFile(editor.document.uri.fsPath, transport);
    if (metadata && metadata.commerceProcess) {
      processVarName = metadata.commerceProcess;
    }
  }

  if (!processVarName) {
    processVarName = getCommerceProcess(vscode);
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to deploy Commerce Process "${processVarName}" to live CPQ?`,
    { modal: true },
    "Deploy"
  );
  if (confirm !== "Deploy") {
    return { success: false, errorMessage: "CPQ-BML: commerce process deployment cancelled by user." };
  }

  writeRunHeader(resultsTerminal, "Deploy Commerce Process", processVarName);
  writeRunningLine(resultsTerminal, "Deploy Commerce Process", processVarName);
  resultsTerminal.show();

  const settings = getSettings(vscode);
  const effectivePollInterval = typeof pollIntervalMs === "number" ? pollIntervalMs : (settings.pollIntervalMs || 3000);
  const effectivePollTimeout = typeof pollTimeoutMs === "number" ? pollTimeoutMs : (settings.pollTimeoutMs || 300000);

  const startedAt = Date.now();
  let result;
  try {
    result = await api.deployCommerceProcess(
      processVarName,
      transport,
    );
  } catch (err) {
    return handleDeployError(err, startedAt, resultsTerminal, vscode, `Commerce process "${processVarName}" deployment`);
  }

  if (!isSuccess(result.statusCode)) {
    const message = describeError(result.body);
    writeTerminalMessage(
      resultsTerminal,
      "Deployment failed: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    const errorMessage = `CPQ-BML: commerce process deployment failed (HTTP ${result.statusCode}). ${message}`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, processVarName, errorMessage, statusCode: result.statusCode, elapsedMs: Date.now() - startedAt };
  }

  const taskId = result.body && result.body.taskId;
  if (!taskId) {
    // No task to poll - take the 2xx at face value.
    resultsTerminal.writeLine(
      `\x1b[32m${getTimestamp()} Commerce process deployment queued (${formatElapsed(startedAt)})\x1b[0m`,
    );
    resultsTerminal.show();
    const message = `CPQ-BML: commerce process "${processVarName}" deployment queued.`;
    vscode.window.showInformationMessage(message);
    return { success: true, processVarName, status: "queued", message, elapsedMs: Date.now() - startedAt };
  }

  resultsTerminal.writeLine(
    `\x1b[90m${getTimestamp()} Deployment queued as task ${taskId}. Waiting for it to finish...\x1b[0m`,
  );
  resultsTerminal.show();

  const taskResult = await pollTaskStatus(taskId, transport, {
    intervalMs: effectivePollInterval,
    timeoutMs: effectivePollTimeout,
    resultsTerminal,
  });
  const elapsed = formatElapsed(startedAt);

  if (taskResult.status && /complete/i.test(taskResult.status)) {
    resultsTerminal.writeLine(
      `\x1b[32m${getTimestamp()} Commerce process deployed successfully (${elapsed})\x1b[0m`,
    );
    resultsTerminal.show();
    const message = `CPQ-BML: commerce process "${processVarName}" deployed.`;
    vscode.window.showInformationMessage(message);
    return { success: true, processVarName, status: "complete", message, taskId, elapsedMs: Date.now() - startedAt };
  }
  if (taskResult.status) {
    const detail = (taskResult.body && taskResult.body.detailStatus && taskResult.body.detailStatus.message) || taskResult.status;
    writeTerminalMessage(
      resultsTerminal,
      "Deployment failed: ",
      `${detail} (${elapsed})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    const errorMessage = `CPQ-BML: commerce process deployment failed. ${detail}`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, processVarName, errorMessage, taskId, elapsedMs: Date.now() - startedAt };
  }
  resultsTerminal.writeLine(
    `\x1b[33m${getTimestamp()} Deployment still running after ${elapsed} - check the CPQ Deployment Center for task ${taskId}.\x1b[0m`,
  );
  resultsTerminal.show();
  const message = `CPQ-BML: commerce process deployment (task ${taskId}) is still running - check the CPQ Deployment Center.`;
  const warnPromise = vscode.window.showWarningMessage(message, "Open Deployment Center", "Check Task Status");
  if (warnPromise && typeof warnPromise.then === "function") {
    warnPromise.then((choice) => {
      if (choice === "Open Deployment Center" && vscode.commands && typeof vscode.commands.executeCommand === "function") {
        vscode.commands.executeCommand("cpqBml.cloud.refreshDeploymentCenter");
      } else if (choice === "Check Task Status" && vscode.commands && typeof vscode.commands.executeCommand === "function") {
        vscode.commands.executeCommand("cpqBml.cloud.viewTaskDetails", { id: taskId, taskId });
      }
    });
  }
  return { success: true, processVarName, status: "running", message, taskId, elapsedMs: Date.now() - startedAt };
}

// Deploys the util function open in the active editor; it must already exist in CPQ (Save first if new).
async function runDeployCurrentFile(
  resultsTerminal,
  options = {},
) {
  const normArgs = normalizeCommandArgs(arguments);
  resultsTerminal = normArgs[0] || resultsTerminal;
  const effectiveOpts = (normArgs.length > 1 ? normArgs[1] : options) || {};
  const transport = effectiveOpts.transport;
  const { context, vscode } = getExtensionContext();

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "bml") {
    const errorMessage = "CPQ-BML: open a .bml file to deploy.";
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  const hasCredentials = await ensureCredentials();
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  const metadata = await resolveMetadataForFile(editor.document.uri.fsPath, transport);
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(editor.document.uri.fsPath);
    const errorMessage = `CPQ-BML: could not find CPQ metadata for "${variableName}" locally or on the server. Run "CPQ-BML: Pull Util Library Functions from CPQ" first, or save it once to create it.`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  if (metadata.commerceDocument) {
    if (vscode.commands && typeof vscode.commands.executeCommand === "function") {
      vscode.commands.executeCommand("cpqBml.internal.refreshStatus");
    }
    return runDeployCommerceProcess(resultsTerminal, { transport });
  }

  // Pre-Flight Safety & Impact Analysis
  try {
    const preflight = await runPreflightSafetyCheck(editor.document.uri.fsPath, vscode, context, { transport });
    if (!preflight.canDeploy) {
      const err = preflight.server.passed ? 'Code failed complexity or linter threshold' : preflight.server.message;
      const choice = await vscode.window.showErrorMessage(
        `Pre-Flight Safety Check Failed for "${metadata.variableName}": ${err}`,
        "View Safety Report",
        "Deploy Anyway",
        "Cancel"
      );
      if (choice === "View Safety Report") {
        resultsTerminal.show();
        resultsTerminal.writeLine(formatPreflightSummary(preflight));
        return { success: false, errorMessage: "Deployment halted by Pre-Flight check failure." };
      }
      if (choice !== "Deploy Anyway") {
        return { success: false, errorMessage: "CPQ-BML: deployment cancelled by user." };
      }
    } else {
      resultsTerminal.writeLine(`\x1b[90m${getTimestamp()} Pre-Flight Safety Check: PASSED (Referenced in ${preflight.impact.callersCount} files)\x1b[0m`);
    }
  } catch (_) {
    // Pre-flight check error should not prevent deployment if user insists
  }

  let remoteContent = '';
  if (!effectiveOpts.skipDiffReview && !transport) {
    try {
      const diffCheck = await compareAndPromptPreDeploy({
        vscode,
        localPath: editor.document.uri.fsPath,
        localContent: editor.document.getText(),
        metadata,
        transport
      });
      if (!diffCheck.canProceed) {
        return { success: false, errorMessage: "CPQ-BML: deployment cancelled by user." };
      }
      remoteContent = diffCheck.remoteContent;
    } catch (_) {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to deploy util function "${metadata.variableName}" to live CPQ?`,
        { modal: true },
        "Deploy"
      );
      if (confirm !== "Deploy") {
        return { success: false, errorMessage: "CPQ-BML: deployment cancelled by user." };
      }
    }
  } else if (!effectiveOpts.skipConfirmation) {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to deploy util function "${metadata.variableName}" to live CPQ?`,
      { modal: true },
      "Deploy"
    );
    if (confirm !== "Deploy") {
      return { success: false, errorMessage: "CPQ-BML: deployment cancelled by user." };
    }
  }

  // Save pre-deploy rollback snapshot
  try {
    const wsFolder = vscode.workspace && typeof vscode.workspace.getWorkspaceFolder === 'function'
      ? vscode.workspace.getWorkspaceFolder(editor.document.uri)
      : null;
    saveSnapshot({
      workspaceRoot: wsFolder ? wsFolder.uri.fsPath : null,
      variableName: metadata.variableName,
      functionType: metadata.commerceDocument ? 'commerce' : 'util',
      environment: getBaseUrl(vscode),
      remoteContent,
      localContent: editor.document.getText(),
      metadata
    });
  } catch (_) {}

  writeRunHeader(resultsTerminal, "Deploy", metadata.variableName);
  writeRunningLine(resultsTerminal, "Deploy", metadata.variableName);
  resultsTerminal.show();

  const startedAt = Date.now();
  let deployResult;
  try {
    deployResult = await api.deployLibraryFunctions(
      [metadataLib.buildDeployItem(metadata)],
      transport,
    );
  } catch (err) {
    return handleDeployError(err, startedAt, resultsTerminal, vscode, `Deploy "${metadata.variableName}"`);
  }

  if (!isSuccess(deployResult.statusCode)) {
    const message = describeError(deployResult.body);
    writeTerminalMessage(
      resultsTerminal,
      "Deployment failed: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    const errorMessage = `CPQ-BML: deploy failed (HTTP ${deployResult.statusCode}). ${message}`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage, statusCode: deployResult.statusCode, elapsedMs: Date.now() - startedAt };
  }

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Deployed (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  const message = `CPQ-BML: ${metadata.variableName} deployed.`;
  vscode.window.showInformationMessage(message);
  return { success: true, message, elapsedMs: Date.now() - startedAt };
}

// Synchronous (204 directly), unlike deployCommerceProcess's task polling above.
async function runDeployUtilFunctions(
  resultsTerminal,
  options = {},
) {
  const normArgs = normalizeCommandArgs(arguments);
  resultsTerminal = normArgs[0] || resultsTerminal;
  const effectiveOpts = (normArgs.length > 1 ? normArgs[1] : options) || {};
  const transport = effectiveOpts.transport;
  const { vscode } = getExtensionContext();

  const hasCredentials = await ensureCredentials();
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  let allItems = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { statusCode, body } = await api.listLibraryFunctions({ offset, limit }, transport);
    if (!isSuccess(statusCode)) {
      const errorMessage = `CPQ-BML: failed to list util library functions (HTTP ${statusCode}). ${describeError(body)}`;
      vscode.window.showErrorMessage(errorMessage);
      return { success: false, errorMessage };
    }
    allItems = allItems.concat(body.items || []);
    if (!body.hasMore) break;
    offset += limit;
  }

  if (allItems.length === 0) {
    const errorMessage = "CPQ-BML: no util library functions found.";
    vscode.window.showInformationMessage(errorMessage);
    return { success: false, errorMessage };
  }

  const picks = allItems.map((item) => ({
    label: item.name || item.variableName,
    description: metadataLib.namespaceVariableNameFor(item),
    item,
  }));

  const selected = await vscode.window.showQuickPick(picks, {
    canPickMany: true,
    placeHolder: "Select util library functions to deploy",
  });
  if (!selected || selected.length === 0) {
    return { success: false, errorMessage: "CPQ-BML: no util library functions were selected to deploy." };
  }

  const items = selected.map((pick) => metadataLib.buildDeployItem(pick.item));
  const label = items.length === 1 ? items[0].variableName : `${items.length} functions`;

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to deploy ${items.length} util function(s) to live CPQ?`,
    { modal: true },
    "Deploy"
  );
  if (confirm !== "Deploy") {
    return { success: false, errorMessage: "CPQ-BML: mass deployment cancelled by user." };
  }

  writeRunHeader(resultsTerminal, "Mass Deploy", label);
  writeRunningLine(resultsTerminal, "Mass Deploy", label);
  resultsTerminal.show();

  const startedAt = Date.now();
  let deployResult;
  try {
    deployResult = await api.deployLibraryFunctions(items, transport);
  } catch (err) {
    return handleDeployError(err, startedAt, resultsTerminal, vscode, `Mass deploy (${items.length} functions)`);
  }

  if (!isSuccess(deployResult.statusCode)) {
    const message = describeError(deployResult.body);
    writeTerminalMessage(
      resultsTerminal,
      "Deployment failed: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    const errorMessage = `CPQ-BML: deploy failed (HTTP ${deployResult.statusCode}). ${message}`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage, statusCode: deployResult.statusCode, elapsedMs: Date.now() - startedAt };
  }

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Deployed ${items.length} function(s) (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  const message = `CPQ-BML: deployed ${items.length} util function(s).`;
  vscode.window.showInformationMessage(message);
  return {
    success: true,
    message,
    deployedVariableNames: items.map((i) => i.variableName),
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { runDeployCommerceProcess, runDeployCurrentFile, runDeployUtilFunctions };
