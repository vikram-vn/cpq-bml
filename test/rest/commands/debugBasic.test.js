const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../testHelpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

suite("BML REST commands - debug (util functions)", () => {
  suite("runDebugCurrentFile", () => {
    test("prompts for each parameter, sends them to debug, and prints the result to the output channel", () =>
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

        const prompts = [];
        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async ({ prompt }) => {
              prompts.push(prompt);
              return prompts.length === 1 ? "hello" : "world";
            },
          },
        });
        const resultsTerminal = {
          writeLine: (l) => lines.push(l),
          show: () => {},
        };

        let sentBody;
        const transport = async (opts) => {
          sentBody = JSON.parse(opts.body);
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              returnData: "hello world",
              scriptSize: "*** 10 bytes ***",
            }),
          };
        };

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          resultsTerminal,
          { transport },
        );

        assert.strictEqual(prompts.length, 2);
        assert.deepStrictEqual(
          sentBody.parameters.map((p) => p.value),
          ["hello", "world"],
        );
        assert.ok(lines.some((l) => l.includes("hello world")));
      }));

    test("aborts without calling debug if a parameter prompt is cancelled", () =>
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

        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => undefined,
          },
        });
        let transportCalled = false;
        const transport = async () => {
          transportCalled = true;
          return { statusCode: 200, headers: {}, text: "" };
        };

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          { writeLine: () => {}, show: () => {} },
          { transport },
        );

        assert.strictEqual(transportCalled, false);
      }));

    test("on multiline debug error, splits lines and indents subsequent lines to avoid stair-stepping", () =>
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

        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
        });
        const transport = async () => ({
          statusCode: 400,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ detail: "Error Line 1\nError Line 2" }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.strictEqual(lines.length, 5);
        assert.ok(lines[3].includes("Debug error: Error Line 1"));
        assert.ok(lines[4].includes(" ".repeat(39) + "Error Line 2"));
      }));

    test("splits print logs by line and omits trailing empty line properly", () =>
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

        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
        });
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            returnData: "some output",
            logs: "Print Line 1\nPrint Line 2\n",
          }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.strictEqual(lines.length, 7);
        assert.ok(lines[4].includes("Debug print: Print Line 1"));
        assert.ok(lines[5].includes("Debug print: Print Line 2"));
      }));

    test("supports printData field in debug response for print output", () =>
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

        const lines = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
        });
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            returnData: "some output",
            printData: "Print Line 1\nPrint Line 2\n",
          }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.strictEqual(lines.length, 7);
        assert.ok(lines[4].includes("Debug print: Print Line 1"));
        assert.ok(lines[5].includes("Debug print: Print Line 2"));
      }));

    test("writes return value to bml_debug_output.log and print lines to bml_debug_print.log when logOutputToFile is enabled", () =>
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

        const fs = require("fs");
        const outputLog = path.join(tmpDir, "bml_debug_output.log");
        const printLog = path.join(tmpDir, "bml_debug_print.log");

        const vscode = createFakeVscode({
          config: baseVscodeConfig({ "debug.logOutputToFile": true }),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        });
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            returnData: "hello world",
            printData: "Print Line 1\nPrint Line 2\n",
          }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          { writeLine: () => {}, show: () => {} },
          { transport },
        );

        assert.ok(fs.existsSync(outputLog), "bml_debug_output.log should be created");
        assert.ok(fs.existsSync(printLog), "bml_debug_print.log should be created");

        const outputContent = fs.readFileSync(outputLog, "utf8");
        assert.ok(outputContent.includes("hello world"), "output log should contain returnData");
        assert.ok(outputContent.includes("[concatString]"), "output log should include variableName");

        const printContent = fs.readFileSync(printLog, "utf8");
        assert.ok(printContent.includes("Print Line 1"), "print log should contain print lines");
        assert.ok(printContent.includes("Print Line 2"), "print log should contain print lines");
        assert.ok(printContent.includes("[concatString]"), "print log should include variableName");
      }));

    test("does not create log files when logOutputToFile is disabled (default)", () =>
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

        const fs = require("fs");
        const outputLog = path.join(tmpDir, "bml_debug_output.log");
        const printLog = path.join(tmpDir, "bml_debug_print.log");

        const vscode = createFakeVscode({
          config: baseVscodeConfig(), // logOutputToFile defaults to false
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        });
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            returnData: "result",
            printData: "some print\n",
          }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          { writeLine: () => {}, show: () => {} },
          { transport },
        );

        assert.ok(!fs.existsSync(outputLog), "bml_debug_output.log should NOT be created when setting is off");
        assert.ok(!fs.existsSync(printLog), "bml_debug_print.log should NOT be created when setting is off");
      }));

    test("formats JSON returnData as a table when showResultsAsTable is enabled", () =>
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

        const config = baseVscodeConfig();
        config["debug.showResultsAsTable"] = true;

        const vscode = createFakeVscode({
          config,
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
        });

        const lines = [];
        const resultsTerminal = {
          writeLine: (l) => lines.push(l),
          show: () => {},
        };

        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            returnData: JSON.stringify({ name: "Devtest", status: "Active" }),
          }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          resultsTerminal,
          { transport },
        );

        // Verify table output contains the headers and keys/values
        assert.ok(lines.some((l) => l.includes("key")), "Should contain 'key' header");
        assert.ok(lines.some((l) => l.includes("value")), "Should contain 'value' header");
        assert.ok(lines.some((l) => l.includes("name") && l.includes("Devtest")), "Should contain name -> Devtest row");
        assert.ok(lines.some((l) => l.includes("status") && l.includes("Active")), "Should contain status -> Active row");
      }));

    test("publishes diagnostic error on the correct line when debug fails with a line number in the error", () =>
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
            lineCount: 10,
            lineAt: (idx) => ({ text: "  some line of BML code" }),
          },
        };

        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
        });

        let publishedDiagnostics = null;
        const mockDiagnosticCollection = {
          delete: () => {},
          set: (uri, diags) => {
            publishedDiagnostics = diags;
          },
        };

        const transport = async () => ({
          statusCode: 400,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            message: "BML Runtime Error: Division by zero on line 3",
          }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          mockDiagnosticCollection,
          { writeLine: () => {}, show: () => {} },
          { transport },
        );

        assert.ok(publishedDiagnostics, "Should have published diagnostics");
        assert.strictEqual(publishedDiagnostics.length, 1);
        const diag = publishedDiagnostics[0];
        assert.strictEqual(diag.range.start.line, 2, "Line 3 is index 2");
        assert.match(diag.message, /Division by zero on line 3/);
      }));
  });
});
