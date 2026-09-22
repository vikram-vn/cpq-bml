const api = require("@/lang/rest/api");
const configLib = require("@/lang/rest/config");
const metadataLib = require("@/lang/rest/metadata");
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
} = require("@/lang/rest/commands/shared");
const {
  formatAsTable,
  tableLinesToString,
  formatDocAttributeDumpTables,
  parseDocAttributeDump,
} = require("@/lang/rest/commands/debugTableFormat");
const {
  writeTableLines,
  runConcurrentPool,
  runDebugSingleExecution,
} = require("@/lang/rest/commands/debugExecution");
const { promptDebugInputs } = require("@/lang/rest/commands/debugInputs");


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

  let doc = null;
  if (options && options.document) {
    doc = options.document;
  } else if (options && (options.targetUri || options.uri || options.file)) {
    const targetUri =
      options.targetUri ||
      options.uri ||
      (typeof options.file === "string"
        ? vscode?.Uri?.file
          ? vscode.Uri.file(options.file)
          : { fsPath: options.file }
        : options.file);
    try {
      if (vscode.workspace && typeof vscode.workspace.openTextDocument === "function") {
        doc = await vscode.workspace.openTextDocument(targetUri);
      }
    } catch (_) {}
  }
  if (!doc) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document) {
      doc = editor.document;
    }
  }

  if (!doc || (doc.languageId && doc.languageId !== "bml")) {
    const errorMessage = "CPQ-BML: open a .bml file to debug.";
    vscode.window.showErrorMessage(errorMessage);
    return { success: false, errorMessage };
  }

  if (diagnosticCollection && doc.uri) {
    diagnosticCollection.delete(doc.uri);
  }

  const hasCredentials = await ensureCredentials(context, vscode);
  if (!hasCredentials) {
    return {
      success: false,
      errorMessage: "CPQ-BML: credentials are not configured.",
    };
  }

  let metadata = await resolveMetadataForFile(
    context,
    vscode,
    doc.uri.fsPath,
    transport,
  );
  if (!metadata) {
    const variableName = metadataLib.variableNameFromBmlPath(doc.uri.fsPath);
    const inferred = metadataLib.inferCommerceFromPath(doc.uri.fsPath);
    const process = (inferred && inferred.commerceProcess) || configLib.getCommerceProcess(vscode) || "oraclecpqo";
    const document = (inferred && inferred.commerceDocument) || configLib.getCommerceDocument(vscode) || "transaction";

    // Attempt on-the-fly fetch from CPQ without saving a -meta.json sidecar to disk
    try {
      const serverFn = await api.getLibraryFunction(context, vscode, variableName, transport, inferred ? { commerceProcess: process, commerceDocument: document } : undefined);
      if (serverFn && serverFn.statusCode >= 200 && serverFn.statusCode < 300 && serverFn.body) {
        const split = metadataLib.splitFunctionResponse(serverFn.body);
        metadata = split.metadata || {};
        metadata.variableName = metadata.variableName || variableName;
        metadata.name = metadata.name || variableName;
      }
    } catch {}

    // If still not found on CPQ, synthesize in-memory metadata for seamless debugging
    if (!metadata) {
      metadata = {
        name: variableName,
        variableName,
        returnType: { type: "String" },
        parameters: [],
        libraryFunctions: [],
        attributes: [],
        commerceProcess: process,
        commerceDocument: document,
        inMemoryOnly: true,
      };
    }
  }

  writeRunHeader(resultsTerminal, "Debug", metadata.variableName);
  resultsTerminal.show();

  const inputResult = await promptDebugInputs({
    context,
    vscode,
    metadata,
    options,
    resultsTerminal,
    transport
  });

  if (inputResult.cancelled) {
    return inputResult.result;
  }

  const { transactionIds, parameterValues, isCommerce } = inputResult;


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
