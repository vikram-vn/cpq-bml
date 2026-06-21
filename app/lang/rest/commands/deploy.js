const api = require("../api");
const metadataLib = require("../metadata");
const { getCommerceProcess } = require("../config");
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
} = require("./shared");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deploying queues an async task (the POST only returns a taskId) - poll
// GET /rest/<version>/tasks/{taskId} until it leaves the queued/running state
// so the command reports the real outcome instead of "queued" as "deployed".
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
  if (!hasCredentials) return;

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
    vscode.window.showErrorMessage(
      `CPQ-BML: commerce process deployment failed (HTTP ${result.statusCode}). ${message}`,
    );
    return;
  }

  const taskId = result.body && result.body.taskId;
  if (!taskId) {
    // No task to poll - take the 2xx at face value.
    resultsTerminal.writeLine(
      `\x1b[32m${getTimestamp()} Commerce process deployment queued (${formatElapsed(startedAt)})\x1b[0m`,
    );
    resultsTerminal.show();
    vscode.window.showInformationMessage(
      `CPQ-BML: commerce process "${processVarName}" deployment queued.`,
    );
    return;
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
    vscode.window.showInformationMessage(
      `CPQ-BML: commerce process "${processVarName}" deployed.`,
    );
  } else if (taskResult.status) {
    const detail = (taskResult.body && taskResult.body.detailStatus && taskResult.body.detailStatus.message) || taskResult.status;
    writeTerminalMessage(
      resultsTerminal,
      "Deployment failed: ",
      `${detail} (${elapsed})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    vscode.window.showErrorMessage(
      `CPQ-BML: commerce process deployment failed. ${detail}`,
    );
  } else {
    resultsTerminal.writeLine(
      `\x1b[33m${getTimestamp()} Deployment still running after ${elapsed} - check the CPQ Deployment Center for task ${taskId}.\x1b[0m`,
    );
    resultsTerminal.show();
    vscode.window.showWarningMessage(
      `CPQ-BML: commerce process deployment (task ${taskId}) is still running - check the CPQ Deployment Center.`,
    );
  }
}

// Icon-driven individual deploy: deploys whichever single util function is
// open in the active editor (the function must already exist in CPQ - run
// Save first if it's new or has unsaved script changes). Commerce functions
// use the deployCommerceProcess icon/command instead - the two are mutually
// exclusive via the editor/title "when" clauses in package.json.
async function runDeployCurrentFile(
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "bml") {
    vscode.window.showErrorMessage("CPQ-BML: open a .bml file to deploy.");
    return;
  }

  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) return;

  const metadata = await resolveMetadataForFile(context, vscode, editor.document.uri.fsPath, transport);
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(editor.document.uri.fsPath);
    vscode.window.showErrorMessage(
      `CPQ-BML: could not find CPQ metadata for "${variableName}" locally or on the server. Run "CPQ-BML: Pull Util Library Functions from CPQ" first, or save it once to create it.`,
    );
    return;
  }

  if (metadata.commerceDocument) {
    vscode.window.showErrorMessage(
      `CPQ-BML: "${metadata.variableName}" is a commerce function - use "CPQ-BML: Deploy Commerce Process Setup" instead.`,
    );
    return;
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
    vscode.window.showErrorMessage(
      `CPQ-BML: deploy failed (HTTP ${deployResult.statusCode}). ${message}`,
    );
    return;
  }

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Deployed (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  vscode.window.showInformationMessage(
    `CPQ-BML: ${metadata.variableName} deployed.`,
  );
}

// Util function deploys are synchronous (the live API returns 204 directly,
// no taskId/polling involved) - unlike deployCommerceProcess above.
async function runDeployUtilFunctions(
  context,
  vscode,
  resultsTerminal,
  { transport } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) return;

  let allItems = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { statusCode, body } = await api.listLibraryFunctions(context, vscode, { offset, limit }, transport);
    if (!isSuccess(statusCode)) {
      vscode.window.showErrorMessage(`CPQ-BML: failed to list util library functions (HTTP ${statusCode}). ${describeError(body)}`);
      return;
    }
    allItems = allItems.concat(body.items || []);
    if (!body.hasMore) break;
    offset += limit;
  }

  if (allItems.length === 0) {
    vscode.window.showInformationMessage("CPQ-BML: no util library functions found.");
    return;
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
  if (!selected || selected.length === 0) return;

  const items = selected.map((pick) => metadataLib.buildDeployItem(pick.item));
  const label = items.length === 1 ? items[0].variableName : `${items.length} functions`;

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
    vscode.window.showErrorMessage(
      `CPQ-BML: deploy failed (HTTP ${deployResult.statusCode}). ${message}`,
    );
    return;
  }

  resultsTerminal.writeLine(
    `\x1b[32m${getTimestamp()} Deployed ${items.length} function(s) (${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
  vscode.window.showInformationMessage(
    `CPQ-BML: deployed ${items.length} util function(s).`,
  );
}

module.exports = { runDeployCommerceProcess, runDeployCurrentFile, runDeployUtilFunctions };
