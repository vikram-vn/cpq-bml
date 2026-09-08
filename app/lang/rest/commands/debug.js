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
  parseErrorLine,
  resolveMetadataForFile,
  appendDebugOutputToFile,
  appendDebugPrintToFile,
  ensureCredentials,
} = require("./shared");
const {
  formatAsTable,
  tableLinesToString,
  formatDocAttributeDumpTables,
  parseDocAttributeDump,
} = require("./debugTableFormat");

// Structural elements (borders) are dimmed gray and headers are bold with no forced color, so
// the table reads clearly and adapts to any terminal theme - not the same green used for plain
// success output elsewhere in this file, which read as an unintentional/uniform table color.
const TABLE_BORDER_COLOR = "\x1b[90m";
const TABLE_HEADER_STYLE = "\x1b[1m";

function writeTableLines(resultsTerminal, tableLines) {
  for (const line of tableLines) {
    const style =
      line.type === "border"
        ? TABLE_BORDER_COLOR
        : line.type === "header"
          ? TABLE_HEADER_STYLE
          : "";
    resultsTerminal.writeLine(
      style ? `${style}${line.text}\x1b[0m` : line.text,
    );
  }
}

/**
 * Concurrency pool executor: limits in-flight async tasks between minConcurrency (default 2)
 * and maxConcurrency (default 10).
 */
async function runConcurrentPool(
  items,
  worker,
  concurrency = 5,
  minConcurrency = 2,
  maxConcurrency = 10,
) {
  if (!items || items.length === 0) return [];
  const effectiveConcurrency = Math.max(
    minConcurrency,
    Math.min(maxConcurrency, concurrency),
  );
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workerCount = Math.min(effectiveConcurrency, items.length);
  const workers = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(runner());
  }

  await Promise.all(workers);
  return results;
}

/**
 * Runs debug execution for a single transaction or util function.
 */
async function runDebugSingleExecution({
  txnId,
  context,
  vscode,
  metadata,
  scriptText,
  parameterValues,
  transport,
  outputLogPath,
  printLogPath,
  diagnosticCollection,
  doc,
  resultsTerminal,
  quiet = false,
}) {
  const startedAt = Date.now();
  const isCommerce = !!metadata.commerceDocument;
  const txnMetadata = JSON.parse(JSON.stringify(metadata));

  if (isCommerce && txnId) {
    const loadPayload = metadataLib.buildFunctionPayload(
      txnMetadata,
      scriptText,
    );
    loadPayload.transactionId = isNaN(Number(txnId))
      ? txnId
      : Number(txnId);
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
      const errorMessage = `CPQ-BML: failed to load transaction data (HTTP ${loadResult.statusCode}). ${message}`;
      if (!quiet) {
        if (resultsTerminal) {
          writeTerminalMessage(
            resultsTerminal,
            "Debug error: ",
            `Failed to load transaction data (HTTP ${loadResult.statusCode}). ${message} (${formatElapsed(startedAt)})`,
            "\x1b[31m",
          );
          resultsTerminal.show();
        }
        vscode.window.showErrorMessage(errorMessage);
      }
      return {
        transactionId: txnId,
        success: false,
        errorMessage,
        statusCode: loadResult.statusCode,
        elapsedMs: Date.now() - startedAt,
      };
    }

    const loadedData = loadResult.body || {};
    if (loadedData.systemAttributes)
      txnMetadata.systemAttributes = loadedData.systemAttributes;
    if (loadedData.mainDocAttributes)
      txnMetadata.mainDocAttributes = loadedData.mainDocAttributes;
    if (loadedData.subDocAttributes)
      txnMetadata.subDocAttributes = loadedData.subDocAttributes;
    // subDocAttributes only carries attribute names; the actual per-line values live here,
    // one array per transactionLine row. Without it the script iterates zero line items.
    if (loadedData.subDocAttributesData)
      txnMetadata.subDocAttributesData = loadedData.subDocAttributesData;
    if (loadedData.contextParams)
      txnMetadata.contextParams = loadedData.contextParams;
  }

  const payload = metadataLib.buildDebugPayload(
    txnMetadata,
    scriptText,
    parameterValues,
  );
  if (isCommerce && txnId) {
    payload.transactionId = isNaN(Number(txnId))
      ? txnId
      : Number(txnId);
  }

  const { statusCode, body } = await api.debugLibraryFunction(
    context,
    vscode,
    payload,
    transport,
  );

  if (!isSuccess(statusCode)) {
    const message = describeError(body);
    const lineNum = parseErrorLine(message);
    if (!quiet) {
      if (resultsTerminal) {
        writeTerminalMessage(
          resultsTerminal,
          "Debug error: ",
          `${message} (${formatElapsed(startedAt)})`,
          "\x1b[31m",
        );
        resultsTerminal.show();
      }
      vscode.window.showErrorMessage(
        `CPQ-BML: debug failed (HTTP ${statusCode}). ${message}`,
      );
    }

    if (lineNum !== null && diagnosticCollection && doc) {
      const lineIdx = Math.max(0, lineNum - 1);
      const lineText = doc.lineCount > lineIdx ? doc.lineAt(lineIdx).text : "";
      const startChar = lineText.length - lineText.trimStart().length;
      const endChar = lineText.length;
      const range = new vscode.Range(lineIdx, startChar, lineIdx, endChar);

      const diagnostic = new vscode.Diagnostic(
        range,
        `BML Debug Runtime Error: ${message}`,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = "BML Debug";
      diagnostic.code = "bml-debug-runtime-error";

      diagnosticCollection.set(doc.uri, [diagnostic]);
    }
    return {
      transactionId: txnId,
      success: false,
      errorMessage: message,
      errorLine: lineNum,
      statusCode,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const returnVal = body && body.returnData;
  let tableOutput = null;
  let dumpTables = null;
  const showAsTable = configLib.getShowDebugResultsAsTable(vscode);

  if (showAsTable && typeof returnVal === "string") {
    const parsedDump = parseDocAttributeDump(returnVal);
    if (parsedDump) dumpTables = formatDocAttributeDumpTables(parsedDump);
  }

  if (
    !dumpTables &&
    showAsTable &&
    returnVal !== undefined &&
    returnVal !== null &&
    returnVal !== ""
  ) {
    try {
      let parsed = null;
      if (typeof returnVal === "string") {
        parsed = JSON.parse(returnVal);
      } else if (typeof returnVal === "object") {
        parsed = returnVal;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        tableOutput = formatAsTable(parsed);
      }
    } catch (e) {
      // Not a valid JSON or not an object, fall back to normal output
    }
  }

  let outputForLog = returnVal;
  if (dumpTables) {
    const logParts = [];
    if (dumpTables.headerTable) {
      logParts.push(
        "Header Attributes:",
        tableLinesToString(dumpTables.headerTable),
      );
    }
    if (dumpTables.lineTable) {
      logParts.push(
        "Line Attributes:",
        tableLinesToString(dumpTables.lineTable),
      );
    }
    outputForLog = logParts.join("\n");
  } else if (tableOutput) {
    outputForLog = tableLinesToString(tableOutput);
  }

  const logIdentifier = txnId
    ? `${metadata.variableName}[${txnId}]`
    : metadata.variableName;
  appendDebugOutputToFile(outputLogPath, logIdentifier, outputForLog);

  const logs =
    body &&
    (body.executionLog ||
      body.printBuffer ||
      body.printLog ||
      body.logs ||
      body.printData);
  let printOutput = [];
  if (logs) {
    const logLines = String(logs).split(/\r?\n/);
    if (logLines.length > 0 && logLines[logLines.length - 1] === "") {
      logLines.pop();
    }
    appendDebugPrintToFile(printLogPath, logIdentifier, String(logs));
    printOutput = logLines;
  }

  if (!quiet && resultsTerminal) {
    if (dumpTables) {
      resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Debug output:\x1b[0m`);
      if (dumpTables.headerTable) {
        resultsTerminal.writeLine(`\x1b[1m\x1b[36mHeader Attributes:\x1b[0m`);
        writeTableLines(resultsTerminal, dumpTables.headerTable);
      }
      if (dumpTables.lineTable) {
        resultsTerminal.writeLine(`\x1b[1m\x1b[36mLine Attributes:\x1b[0m`);
        writeTableLines(resultsTerminal, dumpTables.lineTable);
      }
    } else if (tableOutput) {
      resultsTerminal.writeLine(`\x1b[32m${getTimestamp()} Debug output:\x1b[0m`);
      writeTableLines(resultsTerminal, tableOutput);
    } else if (
      returnVal !== undefined &&
      returnVal !== null &&
      returnVal !== ""
    ) {
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

    if (printOutput.length > 0) {
      for (const line of printOutput) {
        resultsTerminal.writeLine(
          `\x1b[38;2;206;145;120m${getTimestamp()} Debug print: ${line}\x1b[0m`,
        );
      }
    }

    const scriptSizePrefix =
      body && body.scriptSize ? `${body.scriptSize} ` : "";
    resultsTerminal.writeLine(
      `\x1b[90m${scriptSizePrefix}(${formatElapsed(startedAt)})\x1b[0m`,
    );
    resultsTerminal.show();
  }

  return {
    transactionId: txnId,
    success: true,
    returnValue: returnVal,
    table: parseDocAttributeDump(returnVal),
    dumpTables,
    tableOutput,
    printOutput,
    scriptSize: body && body.scriptSize,
    elapsedMs: Date.now() - startedAt,
  };
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

  if (
    diagnosticCollectionOrTerminal &&
    typeof diagnosticCollectionOrTerminal.writeLine === "function"
  ) {
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
    const errorMessage = "CPQ-BML: open a .bml file to debug.";
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  if (diagnosticCollection) {
    diagnosticCollection.delete(editor.document.uri);
  }

  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return {
      success: false,
      errorMessage: "CPQ-BML: credentials are not configured.",
    };
  }

  const doc = editor.document;
  const metadata = await resolveMetadataForFile(
    context,
    vscode,
    doc.uri.fsPath,
    transport,
  );
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(doc.uri.fsPath);
    const errorMessage = `CPQ-BML: could not find CPQ metadata for "${variableName}" locally or on the server. Run "CPQ-BML: Pull Util Library Functions from CPQ" first, or confirm the function exists in CPQ.`;
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  writeRunHeader(resultsTerminal, "Debug", metadata.variableName);
  resultsTerminal.show();

  const isCommerce = !!metadata.commerceDocument;
  const hasInputs =
    (metadata.parameters && metadata.parameters.length > 0) || isCommerce;

  let transactionIds = [];
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
        ? `Transaction(s): ${cached.transactionId || "None"}`
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
          description: "Enter new transaction ID(s) and parameter values",
          id: "new",
        },
      ];

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: `Debug "${metadata.variableName}": choose inputs option`,
        ignoreFocusOut: true,
      });

      if (!selected)
        return {
          success: false,
          errorMessage: "Cancelled: no debug inputs selected.",
        };

      if (selected.id === "last") {
        useCached = true;
        const rawCachedTx = cached.transactionId;
        if (Array.isArray(rawCachedTx)) {
          transactionIds = rawCachedTx
            .map((t) => String(t).trim())
            .filter(Boolean);
        } else if (typeof rawCachedTx === "string" && rawCachedTx.includes(",")) {
          transactionIds = rawCachedTx
            .split(/[\s,]+/)
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (
          rawCachedTx !== undefined &&
          rawCachedTx !== null &&
          String(rawCachedTx).trim()
        ) {
          transactionIds = [String(rawCachedTx).trim()];
        }
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
      if (value === undefined)
        return {
          success: false,
          errorMessage: `Cancelled: no value given for parameter "${param.name}".`,
        };
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
        prompt:
          "Transaction ID(s) for debugging (e.g. 48420727 or 48420727, 48420728 - 2 to 10 concurrent) - leave blank to pick from CPQ transactions",
        value: prefill,
        ignoreFocusOut: true,
      });
      if (transactionIdStr === undefined)
        return {
          success: false,
          errorMessage: "Cancelled: no transaction ID given.",
        };

      if (transactionIdStr && transactionIdStr.trim()) {
        transactionIds = transactionIdStr
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      if (transactionIds.length === 0) {
        try {
          const res = await api.getTransactions(
            context,
            vscode,
            {
              process: metadata.commerceProcess,
              document: metadata.commerceDocument,
              limit: 25,
            },
            transport,
          );
          if (
            res &&
            res.body &&
            Array.isArray(res.body.items) &&
            res.body.items.length > 0
          ) {
            const picks = res.body.items.map((it) => ({
              label: String(it.transactionID_t || it._id),
              description: `_id: ${it._id}${it.transactionID_t ? ` (${it.transactionID_t})` : ""}`,
              id: String(it._id || it.transactionID_t),
            }));
            const picked = await vscode.window.showQuickPick(picks, {
              placeHolder:
                "Select transaction(s) from CPQ to use for debugging (up to 10)",
              ignoreFocusOut: true,
              canPickMany: true,
            });
            if (Array.isArray(picked)) {
              transactionIds = picked.map((it) =>
                String(it.id || it.label || it),
              );
            } else if (picked) {
              transactionIds = [String(picked.id || picked.label || picked)];
            }
          }
        } catch (e) {}
      }

      if (transactionIds.length > 10) {
        if (
          vscode.window &&
          typeof vscode.window.showWarningMessage === "function"
        ) {
          vscode.window.showWarningMessage(
            `CPQ-BML: Capped at 10 transactions max for concurrent debugging (${transactionIds.length} requested).`,
          );
        }
        transactionIds = transactionIds.slice(0, 10);
      }

      if (transactionIds.length === 0) {
        const errorMessage =
          "CPQ-BML: Transaction ID is required to debug commerce functions.";
        vscode.window.showErrorMessage(errorMessage);
        return { success: false, errorMessage };
      }
    }

    if (hasInputs && context.workspaceState) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      await context.workspaceState.update(cacheKey, {
        transactionId: transactionIds.join(", "),
        parameterValues,
      });
    }
  }

  // Resolve log file paths once (both return null when setting is off).
  const outputLogPath = configLib.getDebugOutputLogPath(vscode);
  const printLogPath = configLib.getDebugPrintLogPath(vscode);
  const settings = configLib.getSettings(vscode);

  const startedAt = Date.now();

  // Multi-transaction concurrent debugging (2 to 10 transactions)
  if (isCommerce && transactionIds.length > 1) {
    const configuredLimit = typeof configLib.getDebugConcurrency === "function"
      ? configLib.getDebugConcurrency(vscode)
      : 10;
    const concurrency = Math.max(
      2,
      Math.min(10, Math.min(configuredLimit, transactionIds.length)),
    );
    writeRunningLine(
      resultsTerminal,
      "Debug",
      `${metadata.variableName} on ${transactionIds.length} transactions (concurrency: ${concurrency}, max: 10)`,
    );
    resultsTerminal.show();

    const results = await runConcurrentPool(
      transactionIds,
      async (txnId) => {
        return runDebugSingleExecution({
          txnId,
          context,
          vscode,
          metadata,
          scriptText: doc.getText(),
          parameterValues,
          transport,
          outputLogPath,
          printLogPath,
          diagnosticCollection: null,
          doc,
          resultsTerminal: null,
          quiet: true,
        });
      },
      concurrency,
      2,
      10,
    );

    for (const res of results) {
      resultsTerminal.writeLine(
        `\n\x1b[1;36m[Transaction: ${res.transactionId}]\x1b[0m`,
      );
      if (!res.success) {
        resultsTerminal.writeLine(
          `\x1b[31mDebug error: ${res.errorMessage}\x1b[0m`,
        );
      } else {
        if (res.dumpTables) {
          resultsTerminal.writeLine(
            `\x1b[32m${getTimestamp()} Debug output:\x1b[0m`,
          );
          if (res.dumpTables.headerTable) {
            resultsTerminal.writeLine(
              `\x1b[1m\x1b[36mHeader Attributes:\x1b[0m`,
            );
            writeTableLines(resultsTerminal, res.dumpTables.headerTable);
          }
          if (res.dumpTables.lineTable) {
            resultsTerminal.writeLine(
              `\x1b[1m\x1b[36mLine Attributes:\x1b[0m`,
            );
            writeTableLines(resultsTerminal, res.dumpTables.lineTable);
          }
        } else if (res.tableOutput) {
          resultsTerminal.writeLine(
            `\x1b[32m${getTimestamp()} Debug output:\x1b[0m`,
          );
          writeTableLines(resultsTerminal, res.tableOutput);
        } else if (
          res.returnValue !== undefined &&
          res.returnValue !== null &&
          res.returnValue !== ""
        ) {
          writeTerminalMessage(
            resultsTerminal,
            "Debug output: ",
            res.returnValue,
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

        if (res.printOutput && res.printOutput.length > 0) {
          for (const line of res.printOutput) {
            resultsTerminal.writeLine(
              `\x1b[38;2;206;145;120m${getTimestamp()} Debug print: ${line}\x1b[0m`,
            );
          }
        }
        const scriptSizePrefix = res.scriptSize ? `${res.scriptSize} ` : "";
        resultsTerminal.writeLine(
          `\x1b[90m${scriptSizePrefix}(${res.elapsedMs}ms)\x1b[0m`,
        );
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const allSuccess = successCount === results.length;
    const summaryColor = allSuccess ? "\x1b[1;32m" : "\x1b[1;33m";
    resultsTerminal.writeLine(
      `\n${summaryColor}Debug summary: ${successCount}/${results.length} transactions succeeded (${formatElapsed(startedAt)})\x1b[0m`,
    );
    resultsTerminal.show();

    return {
      success: allSuccess,
      results,
      transactionCount: results.length,
      concurrency,
      returnValue: results[0]?.returnValue,
      table: results[0]?.table,
      printOutput: results.flatMap((r) => r.printOutput || []),
      elapsedMs: Date.now() - startedAt,
    };
  }

  // Single transaction or util function execution
  writeRunningLine(resultsTerminal, "Debug", metadata.variableName);
  resultsTerminal.show();

  const singleResult = await runDebugSingleExecution({
    txnId: isCommerce ? transactionIds[0] : undefined,
    context,
    vscode,
    metadata,
    scriptText: doc.getText(),
    parameterValues,
    transport,
    outputLogPath,
    printLogPath,
    diagnosticCollection,
    doc,
    resultsTerminal,
    quiet: false,
  });

  return singleResult;
}

module.exports = {
  runDebugCurrentFile,
  parseDocAttributeDump,
  runConcurrentPool,
  runDebugSingleExecution,
};
