const api = require("../api");
const configLib = require("../config");
const metadataLib = require("../metadata");
const {
  getTimestamp,
  writeTerminalMessage,
  writeRunHeader,
  writeRunningLine,
  formatElapsed,
  describeError,
  isSuccess,
  mergeAttributes,
  resolveMetadataForFile,
  appendDebugOutputToFile,
  appendDebugPrintToFile,
  ensureCredentials,
} = require("./shared");

function formatAsTable(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  let maxKeyLen = 3; // "key"
  let maxValLen = 5; // "value"

  const rows = keys.map(k => {
    const val = data[k];
    const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
    maxKeyLen = Math.max(maxKeyLen, k.length);
    maxValLen = Math.max(maxValLen, valStr.length);
    return { key: k, val: valStr };
  });

  const headerKey = "key".padEnd(maxKeyLen);
  const headerVal = "value".padEnd(maxValLen);
  const separator = "-".repeat(maxKeyLen) + "-+-" + "-".repeat(maxValLen);

  const lines = [
    `${headerKey} | ${headerVal}`,
    separator
  ];

  for (const row of rows) {
    lines.push(`${row.key.padEnd(maxKeyLen)} | ${row.val}`);
  }

  return lines.join('\n');
}

function parseErrorLine(message) {
  if (!message) return null;
  const match = message.match(/(?:on|at|near)?\s*line\s+(\d+)\b/i);
  return match ? parseInt(match[1], 10) : null;
}

async function runDebugCurrentFile(
  context,
  vscode,
  diagnosticCollectionOrTerminal,
  resultsTerminalOrOptions,
  optionsOrUndefined,
) {
  let diagnosticCollection = null;
  let resultsTerminal = null;
  let options = {};

  if (diagnosticCollectionOrTerminal && typeof diagnosticCollectionOrTerminal.writeLine === "function") {
    resultsTerminal = diagnosticCollectionOrTerminal;
    options = resultsTerminalOrOptions || {};
  } else {
    diagnosticCollection = diagnosticCollectionOrTerminal;
    resultsTerminal = resultsTerminalOrOptions;
    options = optionsOrUndefined || {};
  }
  const { transport } = options;

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "bml") {
    vscode.window.showErrorMessage("CPQ-BML: open a .bml file to debug.");
    return;
  }

  if (diagnosticCollection) {
    diagnosticCollection.delete(editor.document.uri);
  }

  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) return;

  const doc = editor.document;
  const metadata = await resolveMetadataForFile(
    context,
    vscode,
    doc.uri.fsPath,
    transport,
  );
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(doc.uri.fsPath);
    vscode.window.showErrorMessage(
      `CPQ-BML: could not find CPQ metadata for "${variableName}" locally or on the server. Run "CPQ-BML: Pull Util Library Functions from CPQ" first, or confirm the function exists in CPQ.`,
    );
    return;
  }

  writeRunHeader(resultsTerminal, "Debug", metadata.variableName);
  resultsTerminal.show();

  const isCommerce = !!metadata.commerceDocument;

  // Dependent attributes are automatically resolved and merged during resolveMetadataForFile.

  const hasInputs =
    (metadata.parameters && metadata.parameters.length > 0) || isCommerce;

  let transactionId;
  const parameterValues = {};
  let useCached = false;

  if (hasInputs && context.workspaceState) {
    const cacheKey = `debugCache:${metadata.variableName}`;
    const cached = context.workspaceState.get(cacheKey);
    if (cached) {
      const paramsSummary = (metadata.parameters || [])
        .map((p) => {
          const val = cached.parameterValues && cached.parameterValues[p.name];
          return `${p.name}=${val !== undefined ? val : ""}`;
        })
        .join(", ");
      const txSummary = isCommerce
        ? `Transaction: ${cached.transactionId || "None"}`
        : "";
      const summary = [txSummary, paramsSummary].filter(Boolean).join("; ");

      const picks = [
        {
          label: "$(play) Run with last inputs",
          description: summary,
          id: "last",
        },
        {
          label: "$(gear) Configure inputs...",
          description: "Enter new transaction ID and parameter values",
          id: "new",
        },
      ];

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: `Debug "${metadata.variableName}": choose inputs option`,
        ignoreFocusOut: true,
      });

      if (!selected) return; // cancelled

      if (selected.id === "last") {
        useCached = true;
        transactionId = cached.transactionId;
        Object.assign(parameterValues, cached.parameterValues || {});
      }
    }
  }

  if (!useCached) {
    for (const param of metadata.parameters || []) {
      const typeLabel = param.dataType && param.dataType.displayValue;
      const cacheKey = `debugCache:${metadata.variableName}`;
      const cached = context.workspaceState
        ? context.workspaceState.get(cacheKey)
        : null;
      const prefill =
        cached && cached.parameterValues
          ? cached.parameterValues[param.name]
          : "";

      let value = await vscode.window.showInputBox({
        prompt: `Value for parameter "${param.name}"${typeLabel ? ` (${typeLabel})` : ""}`,
        value: String(prefill !== undefined && prefill !== null ? prefill : ""),
        ignoreFocusOut: true,
      });
      if (value === undefined) return; // cancelled
      value = metadataLib.normalizeNumericValue(value, param.dataType);
      parameterValues[param.name] = value;
    }

    if (isCommerce) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      const cached = context.workspaceState
        ? context.workspaceState.get(cacheKey)
        : null;
      const prefill =
        cached && cached.transactionId ? String(cached.transactionId) : "";

      const transactionIdStr = await vscode.window.showInputBox({
        prompt: "Transaction ID for debugging (e.g. 48420727)",
        value: prefill,
        ignoreFocusOut: true,
      });
      if (transactionIdStr === undefined) return; // cancelled
      transactionId = transactionIdStr.trim();
      if (!transactionId) {
        vscode.window.showErrorMessage(
          "CPQ-BML: Transaction ID is required to debug commerce functions.",
        );
        return;
      }
    }

    if (hasInputs && context.workspaceState) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      await context.workspaceState.update(cacheKey, {
        transactionId,
        parameterValues,
      });
    }
  }

  // Resolve log file paths once (both return null when setting is off).
  const outputLogPath = configLib.getDebugOutputLogPath(vscode);
  const printLogPath = configLib.getDebugPrintLogPath(vscode);

  // Timed from here on: every prompt above is user think-time, not something
  // an elapsed/"Running..." indicator should account for.
  writeRunningLine(resultsTerminal, "Debug", metadata.variableName);
  resultsTerminal.show();
  const startedAt = Date.now();

  if (isCommerce) {
    const loadPayload = metadataLib.buildFunctionPayload(
      metadata,
      doc.getText(),
    );
    loadPayload.transactionId = isNaN(Number(transactionId))
      ? transactionId
      : Number(transactionId);
    loadPayload.libraryFunctions = [];

    const loadResult = await api.loadTransactionData(
      context,
      vscode,
      loadPayload,
      { contextParams: "language=en,currency=USD" },
      transport,
    );

    if (!isSuccess(loadResult.statusCode)) {
      const message = describeError(loadResult.body);
      writeTerminalMessage(
        resultsTerminal,
        "Debug error: ",
        `Failed to load transaction data (HTTP ${loadResult.statusCode}). ${message} (${formatElapsed(startedAt)})`,
        "\x1b[31m",
      );
      resultsTerminal.show();
      vscode.window.showErrorMessage(
        `CPQ-BML: failed to load transaction data (HTTP ${loadResult.statusCode}). ${message}`,
      );
      return;
    }

    const loadedData = loadResult.body || {};
    if (loadedData.systemAttributes)
      metadata.systemAttributes = loadedData.systemAttributes;
    if (loadedData.mainDocAttributes)
      metadata.mainDocAttributes = loadedData.mainDocAttributes;
    if (loadedData.subDocAttributes)
      metadata.subDocAttributes = loadedData.subDocAttributes;
  }

  const payload = metadataLib.buildDebugPayload(
    metadata,
    doc.getText(),
    parameterValues,
  );
  if (isCommerce) {
    payload.transactionId = isNaN(Number(transactionId))
      ? transactionId
      : Number(transactionId);
  }

  const { statusCode, body } = await api.debugLibraryFunction(
    context,
    vscode,
    payload,
    transport,
  );
  if (!isSuccess(statusCode)) {
    const message = describeError(body);
    writeTerminalMessage(
      resultsTerminal,
      "Debug error: ",
      `${message} (${formatElapsed(startedAt)})`,
      "\x1b[31m",
    );
    resultsTerminal.show();
    vscode.window.showErrorMessage(
      `CPQ-BML: debug failed (HTTP ${statusCode}). ${message}`,
    );

    const lineNum = parseErrorLine(message);
    if (lineNum !== null && diagnosticCollection) {
      const lineIdx = Math.max(0, lineNum - 1);
      const lineText = doc.lineCount > lineIdx ? doc.lineAt(lineIdx).text : "";
      const startChar = lineText.length - lineText.trimStart().length;
      const endChar = lineText.length;
      const range = new vscode.Range(lineIdx, startChar, lineIdx, endChar);
      
      const diagnostic = new vscode.Diagnostic(
        range,
        `BML Debug Runtime Error: ${message}`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = 'BML Debug';
      diagnostic.code = 'bml-debug-runtime-error';
      
      diagnosticCollection.set(doc.uri, [diagnostic]);
    }
    return;
  }

  const returnVal = body && body.returnData;
  let tableOutput = null;

  if (configLib.getShowDebugResultsAsTable(vscode) && returnVal !== undefined && returnVal !== null && returnVal !== "") {
    try {
      let parsed = null;
      if (typeof returnVal === 'string') {
        parsed = JSON.parse(returnVal);
      } else if (typeof returnVal === 'object') {
        parsed = returnVal;
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        tableOutput = formatAsTable(parsed);
      }
    } catch (e) {
      // Not a valid JSON or not an object, fall back to normal output
    }
  }

  if (tableOutput) {
    resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Debug output:\x1b[0m`);
    const tableLines = tableOutput.split('\n');
    for (const line of tableLines) {
      resultsTerminal.writeLine(`\x1b[32m${line}\x1b[0m`);
    }
  } else if (returnVal !== undefined && returnVal !== null && returnVal !== "") {
    writeTerminalMessage(
      resultsTerminal,
      "Debug output: ",
      returnVal,
      "\x1b[32m",
    );
  } else {
    writeTerminalMessage(
      resultsTerminal,
      "Debug output: ",
      "no output found",
      "\x1b[32m",
    );
  }
  // Persist return value to bml_debug_output.log (if enabled).
  appendDebugOutputToFile(outputLogPath, metadata.variableName, returnVal);

  const logs =
    body &&
    (body.executionLog ||
      body.printBuffer ||
      body.printLog ||
      body.logs ||
      body.printData);
  if (logs) {
    const logLines = String(logs).split(/\r?\n/);
    if (logLines.length > 0 && logLines[logLines.length - 1] === "") {
      logLines.pop();
    }
    for (const line of logLines) {
      resultsTerminal.writeLine(
        `\x1b[38;2;206;145;120m${getTimestamp()} Debug print: ${line}\x1b[0m`,
      );
    }
    // Persist print statements to bml_debug_print.log (if enabled).
    appendDebugPrintToFile(printLogPath, metadata.variableName, String(logs));
  }

  const scriptSizePrefix = body && body.scriptSize ? `${body.scriptSize} ` : "";
  resultsTerminal.writeLine(
    `\x1b[90m${scriptSizePrefix}(${formatElapsed(startedAt)})\x1b[0m`,
  );
  resultsTerminal.show();
}

module.exports = { runDebugCurrentFile };
