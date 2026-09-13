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

  const forceConfigure = Boolean(
    options && (options.configureInputs || options.newInputs || options.prompt),
  );
  const smartReuse = configLib.getSmartDebugReuseInputs
    ? configLib.getSmartDebugReuseInputs(vscode)
    : true;

  if (options && options.transactionId) {
    transactionIds = [String(options.transactionId)];
    useCached = true;
    if (context && context.workspaceState) {
      const cacheKey = `debugCache:${metadata.variableName}`;
      const cached = context.workspaceState.get(cacheKey) || {};
      cached.transactionId = options.transactionId;
      context.workspaceState.update(cacheKey, cached);
    }
  } else if (hasInputs && context.workspaceState && !forceConfigure) {
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

      const hasTx = !isCommerce || (cached.transactionId !== undefined && cached.transactionId !== null && String(cached.transactionId).trim() !== "");
      const hasAllParams = !metadata.parameters || metadata.parameters.every((p) => cached.parameterValues && cached.parameterValues[p.name] !== undefined);

      if (smartReuse && hasTx && hasAllParams) {
        // Smart Debug: Automatically reuse cached inputs without showing QuickPick
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

        if (vscode.window && typeof vscode.window.setStatusBarMessage === "function") {
          const txInfo = transactionIds.length > 0 ? ` (txn: ${transactionIds.join(", ")})` : "";
          vscode.window.setStatusBarMessage(`CPQ-BML: Smart Debug reused previous inputs${txInfo}`, 4000);
        }
        writeTerminalMessage(
          resultsTerminal,
          "[Smart Debug] ",
          `Reusing previous inputs: ${summary}. (Run "CPQ-BML: Debug Current Function (Configure New Inputs / Transaction...)" to change)`,
          "\x1b[36m",
        );
      } else if (!smartReuse) {
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
