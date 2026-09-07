const api = require("../api");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  isSuccess,
  ensureCredentials,
} = require("./shared");

async function runPipelineViewerCommand(
  context,
  vscode,
  resultsTerminal,
  { id, transactionId, process, document, transport } = {},
) {
  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return {
      success: false,
      errorMessage: "CPQ-BML: credentials are not configured.",
    };
  }

  let txnId = id || transactionId;
  if (!txnId) {
    const input = await vscode.window.showInputBox({
      title: "CPQ-BML: Run Pipeline Viewer",
      prompt: "Enter Transaction ID (_id)",
      placeHolder: "e.g. 36365138",
    });
    if (!input || !input.trim()) {
      return { success: false, errorMessage: "Pipeline Viewer cancelled." };
    }
    txnId = input.trim();
  }

  if (resultsTerminal) {
    writeRunHeader(resultsTerminal, "Pipeline Viewer", `Transaction ${txnId}`);
    writeRunningLine(resultsTerminal, "Pipeline Viewer", `Transaction ${txnId}`);
    resultsTerminal.show();
  }

  const startedAt = Date.now();

  try {
    const result = await api.runPipelineViewer(
      context,
      vscode,
      { id: txnId, process, document },
      transport,
    );

    if (!isSuccess(result.statusCode)) {
      const message = `failed to execute Pipeline Viewer (HTTP ${result.statusCode}). ${describeError(result.body)}`;
      if (resultsTerminal) {
        writeTerminalMessage(
          resultsTerminal,
          "Pipeline Viewer failed: ",
          `${message} (${formatElapsed(startedAt)})`,
          "\x1b[31m",
        );
        resultsTerminal.show();
      }
      if (vscode && vscode.window) {
        vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
      }
      return { success: false, statusCode: result.statusCode, errorMessage: message };
    }

    if (resultsTerminal) {
      writeTerminalMessage(
        resultsTerminal,
        "Pipeline Viewer completed: ",
        `Transaction ${txnId} (${formatElapsed(startedAt)})`,
        "\x1b[32m",
      );

      const body = result.body;
      if (body && typeof body === "object") {
        if (Array.isArray(body.items) && body.items.length > 0) {
          resultsTerminal.writeLine(`\x1b[1mExecution Pipeline Steps (${body.items.length}):\x1b[0m`);
          for (let i = 0; i < body.items.length; i++) {
            const step = body.items[i];
            const name = step.name || step.ruleName || step.actionName || `Step ${i + 1}`;
            const type = step.type || step.ruleType || "";
            const time = step.executionTimeMs !== undefined ? ` (${step.executionTimeMs}ms)` : "";
            resultsTerminal.writeLine(`  ${i + 1}. [${type || "RULE"}] ${name}${time}`);
          }
        } else if (body.status || body.message) {
          resultsTerminal.writeLine(`  Status: ${body.status || "OK"}`);
          if (body.message) resultsTerminal.writeLine(`  Message: ${body.message}`);
        } else {
          resultsTerminal.writeLine(`\x1b[90m${JSON.stringify(body, null, 2)}\x1b[0m`);
        }
      }
      resultsTerminal.show();
    }

    if (vscode && vscode.window) {
      vscode.window.showInformationMessage(
        `CPQ-BML: Pipeline Viewer executed for transaction ${txnId}.`,
      );
    }

    return {
      success: true,
      statusCode: result.statusCode,
      body: result.body,
    };
  } catch (err) {
    const message = `Pipeline Viewer error: ${err.message || describeError(err)}`;
    if (resultsTerminal) {
      writeTerminalMessage(
        resultsTerminal,
        "Pipeline Viewer error: ",
        `${message} (${formatElapsed(startedAt)})`,
        "\x1b[31m",
      );
      resultsTerminal.show();
    }
    if (vscode && vscode.window) {
      vscode.window.showErrorMessage(`CPQ-BML: ${message}`);
    }
    return { success: false, errorMessage: message };
  }
}

module.exports = {
  runPipelineViewerCommand,
};
