const api = require("@/lang/rest/api");
const configLib = require("@/lang/rest/config");
const metadataLib = require("@/lang/rest/metadata");
const {
  getTimestamp,
  writeTerminalMessage,
  formatElapsed,
  describeError,
  isSuccess,
  parseErrorLine,
  appendDebugOutputToFile,
  appendDebugPrintToFile,
} = require("@/lang/rest/commands/shared");
const {
  formatAsTable,
  tableLinesToString,
  formatDocAttributeDumpTables,
  parseDocAttributeDump,
} = require("@/lang/rest/commands/debugTableFormat");

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
  concurrency = 2,
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

module.exports = {
  TABLE_BORDER_COLOR,
  TABLE_HEADER_STYLE,
  writeTableLines,
  runConcurrentPool,
  runDebugSingleExecution,
};
