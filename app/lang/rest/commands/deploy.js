const api = require("../api");
const metadataLib = require("../metadata");
const { getCommerceProcess } = require("../config");
const {
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  isSuccess,
  resolveMetadataForFile,
  ensureCredentials,
} = require("./shared");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls until the task leaves the queued/running state, so we report the real outcome instead of "queued" as "deployed".
async function pollTaskStatus(
  context,
  vscode,
  taskId,
  transport,
  { intervalMs = 3000, timeoutMs = 120000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await api.getTask(context, vscode, taskId, transport);
    const status = isSuccess(result.statusCode) && result.body && result.body.status;
    if (status && /complete|error|fail/i.test(status)) {
      return { status, body: result.body };
    }
    if (Date.now() >= deadline) {
      return { status: null, body: result.body };
    }
    await delay(intervalMs);
  }
}

async function runDeployCommerceProcess(
  context,
  vscode,
  resultsTerminal,
  { transport, pollIntervalMs, pollTimeoutMs } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  const editor = vscode.window.activeTextEditor;
  let processVarName = '';

  if (editor && editor.document.languageId === 'bml') {
    const metadata = await resolveMetadataForFile(context, vscode, editor.document.uri.fsPath, transport);
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

  const startedAt = Date.now();
  const result = await api.deployCommerceProcess(
    context,
    vscode,
    processVarName,
    transport,
  );

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

  const taskResult = await pollTaskStatus(context, vscode, taskId, transport, {
    intervalMs: pollIntervalMs,
    timeoutMs: pollTimeoutMs,
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
  vscode.window.showWarningMessage(message);
  return { success: true, processVarName, status: "running", message, taskId, elapsedMs: Date.now() - startedAt };
}

// Deploys the util function open in the active editor; it must already exist in CPQ (Save first if new).
async function runDeployCurrentFile(
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "bml") {
    const errorMessage = "CPQ-BML: open a .bml file to deploy.";
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  const metadata = await resolveMetadataForFile(context, vscode, editor.document.uri.fsPath, transport);
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(editor.document.uri.fsPath);
    const errorMessage = `CPQ-BML: could not find CPQ metadata for "${variableName}" locally or on the server. Run "CPQ-BML: Pull Util Library Functions from CPQ" first, or save it once to create it.`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  if (metadata.commerceDocument) {
    const errorMessage = `CPQ-BML: "${metadata.variableName}" is a commerce function - use "CPQ-BML: Deploy Commerce Process Setup" instead.`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to deploy util function "${metadata.variableName}" to live CPQ?`,
    { modal: true },
    "Deploy"
  );
  if (confirm !== "Deploy") {
    return { success: false, errorMessage: "CPQ-BML: deployment cancelled by user." };
  }

  writeRunHeader(resultsTerminal, "Deploy", metadata.variableName);
  writeRunningLine(resultsTerminal, "Deploy", metadata.variableName);
  resultsTerminal.show();

  const startedAt = Date.now();
  const deployResult = await api.deployLibraryFunctions(
    context,
    vscode,
    [metadataLib.buildDeployItem(metadata)],
    transport,
  );

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
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return { success: false, errorMessage: "CPQ-BML: credentials are not configured." };
  }

  let allItems = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { statusCode, body } = await api.listLibraryFunctions(context, vscode, { offset, limit }, transport);
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
  const deployResult = await api.deployLibraryFunctions(context, vscode, items, transport);

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
