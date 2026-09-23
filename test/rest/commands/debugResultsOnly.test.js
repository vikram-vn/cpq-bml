const assert = require("assert");
const path = require("path");
const commands = require("@/lang/rest/commands");
const metadataLib = require("@/lang/rest/metadata");
const { createFakeVscode } = require("@/test/rest/testHelpers");
const {
  SAMPLE_FUNCTION,
  baseVscodeConfig,
  makeContext,
  withTempDir,
  fakeResultsTerminal,
} = require("@/test/rest/commands/fixtures");

const COMMERCE_FUNCTION = {
  ...SAMPLE_FUNCTION,
  commerceProcess: "oraclecpqo",
  commerceDocument: "transaction",
  parameters: [],
};

suite("BML REST commands - debug results-only show option (smart)", () => {
  test("resultsOnly option suppresses run header, running line, per-line timestamps, and elapsed time footer", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => SAMPLE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "arg",
        },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          returnData: "clean-result-output",
          scriptSize: "*** 12 bytes ***",
        }),
      });

      await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport, resultsOnly: true },
      );

      // Verify header and running lines are completely suppressed
      assert.ok(!terminalLines.some((l) => l.includes("--- Debug:")));
      assert.ok(!terminalLines.some((l) => l.includes("Running Debug for")));
      // Verify no elapsed time footer (e.g. '(12ms)' or '*** 12 bytes ***')
      assert.ok(!terminalLines.some((l) => l.includes("*** 12 bytes ***")));
      // Verify clean output is printed without date/time bracket prefixes
      assert.ok(terminalLines.some((l) => l.includes("Debug output: clean-result-output")));
      assert.ok(!terminalLines.some((l) => /\[\d{4}-\d{2}-\d{2}/.test(l)));
    }));

  test("resultsOnly outputs print statements cleanly without timestamps", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => SAMPLE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "arg",
        },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          returnData: "final-res",
          executionLog: "line 1 log\nline 2 log\n",
        }),
      });

      await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport, resultsOnly: true },
      );

      assert.ok(terminalLines.some((l) => l.includes("Debug print: line 1 log")));
      assert.ok(terminalLines.some((l) => l.includes("Debug print: line 2 log")));
      assert.ok(terminalLines.some((l) => l.includes("Debug output: final-res")));
      // No timestamps
      assert.ok(!terminalLines.some((l) => /\[\d{4}-\d{2}-\d{2}/.test(l)));
    }));

  test("resultsOnly displays (no output) cleanly when function returns empty/void", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => SAMPLE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "arg",
        },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          returnData: "",
        }),
      });

      await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport, resultsOnly: true },
      );

      assert.ok(terminalLines.some((l) => l.includes("Debug output: (no output)")));
    }));

  test("smart error retention: retains full error details and diagnostics on execution failure", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          lineCount: 10,
          lineAt: () => ({ text: "return x;" }),
          uri: { fsPath: bmlPath },
          getText: () => SAMPLE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      let errorMessageShown = "";
      const diagnosticsSet = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "arg",
          showErrorMessage: (msg) => {
            errorMessageShown = msg;
          },
        },
      });
      const diagnosticCollection = {
        delete: () => {},
        set: (uri, diags) => diagnosticsSet.push(...diags),
      };
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async () => ({
        statusCode: 400,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          exceptionMessage: "Error at line 4: Variable 'x' is undefined.",
        }),
      });

      const res = await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        diagnosticCollection,
        resultsTerminal,
        { transport, resultsOnly: true },
      );

      assert.strictEqual(res.success, false);
      // Smart error retention: Error is NOT swallowed
      assert.ok(terminalLines.some((l) => l.includes("Debug error:") && l.includes("Variable 'x' is undefined")));
      assert.ok(errorMessageShown.includes("Variable 'x' is undefined"));
      assert.strictEqual(diagnosticsSet.length, 1);
      assert.strictEqual(diagnosticsSet[0].source, "BML Debug");
    }));

  test("smart error retention: retains error when transaction data load fails in commerce debug", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "commerceFunc.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(COMMERCE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => COMMERCE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      let errorShown = "";
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "99999",
          showErrorMessage: (m) => {
            errorShown = m;
          },
        },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      // Mock transport where loadTransactionData fails with 404
      const transport = async (opts) => {
        if (opts.path && opts.path.includes("actions/loadTransactionData")) {
          return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ exceptionMessage: "Transaction 99999 not found" }),
          };
        }
        return { statusCode: 200, headers: {}, text: "{}" };
      };

      const res = await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport, resultsOnly: true },
      );

      assert.strictEqual(res.success, false);
      assert.ok(terminalLines.some((l) => l.includes("Debug error:") && l.includes("Failed to load transaction data")));
      assert.ok(errorShown.includes("failed to load transaction data"));
    }));

  test("activates automatically when cpqBml.debug.showResultsOnly setting is enabled", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => SAMPLE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      const config = baseVscodeConfig({ "debug.showResultsOnly": true });
      const vscode = createFakeVscode({
        config,
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "arg",
        },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          returnData: "config-activated-result",
        }),
      });

      // No resultsOnly option passed in options; should read from config
      await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport },
      );

      assert.ok(!terminalLines.some((l) => l.includes("--- Debug:")));
      assert.ok(!terminalLines.some((l) => l.includes("Running Debug for")));
      assert.ok(terminalLines.some((l) => l.includes("Debug output: config-activated-result")));
    }));

  test("multi-transaction debugging with resultsOnly cleanly isolates results and errors", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "commerceFunc.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(COMMERCE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => COMMERCE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          activeTextEditor: editor,
          showInputBox: async () => "1001, 1002",
        },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async (opts) => {
        if (opts.path && opts.path.includes("actions/loadTransactionData")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ systemAttributes: [] }),
          };
        }
        const body = JSON.parse(opts.body);
        if (body.transactionId === 1001) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ returnData: "success-txn-1" }),
          };
        }
        return {
          statusCode: 500,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ message: "Transaction 1002 crashed" }),
        };
      };

      const res = await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport, resultsOnly: true },
      );

      assert.strictEqual(res.transactionCount, 2);
      // Suppresses global debug header, running line, and summary
      assert.ok(!terminalLines.some((l) => l.includes("--- Debug:")));
      assert.ok(!terminalLines.some((l) => l.includes("Debug summary:")));
      // Formats each transaction cleanly
      assert.ok(terminalLines.some((l) => l.includes("[Transaction: 1001]")));
      assert.ok(terminalLines.some((l) => l.includes("Debug output: success-txn-1")));
      // Smart error retention for failing transaction
      assert.ok(terminalLines.some((l) => l.includes("[Transaction: 1002]")));
      assert.ok(terminalLines.some((l) => l.includes("Debug error: Transaction 1002 crashed")));
    }));

  test("resultsOnly cleanly outputs formatted table without timestamps when showResultsAsTable is on", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => SAMPLE_FUNCTION.scriptText,
        },
      };

      const terminalLines = [];
      const config = baseVscodeConfig({
        "debug.showResultsAsTable": true,
        "debug.showResultsOnly": true,
      });
      const vscode = createFakeVscode({
        config,
        window: { activeTextEditor: editor, showInputBox: async () => "arg" },
      });
      const resultsTerminal = {
        writeLine: (l) => terminalLines.push(l),
        show: () => {},
      };

      const transport = async () => ({
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          returnData: JSON.stringify({ keyA: "valA", keyB: "valB" }),
        }),
      });

      await commands.runDebugCurrentFile(
        makeContext(),
        vscode,
        resultsTerminal,
        { transport },
      );

      assert.ok(!terminalLines.some((l) => /\[\d{4}-\d{2}-\d{2}/.test(l)));
      assert.ok(terminalLines.some((l) => l.includes("keyA") && l.includes("valA")));
      assert.ok(!terminalLines.some((l) => l.includes("--- Debug:")));
    }));

  test("getShowDebugResultsOnly returns true when configured", () => {
    const configLib = require("@/lang/rest/config");
    const vscodeOn = createFakeVscode({ config: { "debug.showResultsOnly": true } });
    const vscodeOff = createFakeVscode({ config: { "debug.showResultsOnly": false } });
    const vscodeAlias = createFakeVscode({ config: { "debug.resultsOnly": true } });

    assert.strictEqual(configLib.getShowDebugResultsOnly(vscodeOn), true);
    assert.strictEqual(configLib.getShowDebugResultsOnly(vscodeOff), false);
    assert.strictEqual(configLib.getShowDebugResultsOnly(vscodeAlias), true);
  });
});
