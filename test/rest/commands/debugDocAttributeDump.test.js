const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../testHelpers");
const {
  SAMPLE_FUNCTION,
  baseVscodeConfig,
  makeContext,
  withTempDir,
} = require("./fixtures");

suite(
  "BML REST commands - debug - documentNumber~variableName~value terminal tables",
  () => {
    test("renders a dump as separate header/line tables when showResultsAsTable is on", () =>
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

        // Dump-table rendering is gated behind showResultsAsTable, same as the generic
        // JSON-object table - must be explicitly enabled to see either as a table.
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

        // Out of order on purpose - documentNumber 3 appears before 2 - to verify sorting.
        const dump =
          "1~customerName~Acme|1~customerId~12345|3~qty~5|3~price~49.99|2~qty~10|2~price~99.99";
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ returnData: dump }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          resultsTerminal,
          { transport },
        );

        assert.ok(lines.some((l) => l.includes("Header Attributes:")));
        assert.ok(lines.some((l) => l.includes("Line Attributes:")));
        assert.ok(
          lines.some((l) => l.includes("customerName") && l.includes("Acme")),
        );
        assert.ok(
          lines.some((l) => l.includes("customerId") && l.includes("12345")),
        );

        // The line table is transposed (one row per variable, one column per line), so line
        // order shows up left-to-right across the header/data lines, not top-to-bottom.
        assert.ok(lines.some((l) => l.includes("Label") && l.includes("Variable Name") && l.includes("Line 2") && l.includes("Line 3")));
        const headerLine = lines.find((l) => l.includes("Line 2") && l.includes("Line 3"));
        assert.ok(
          headerLine.indexOf("Line 2") < headerLine.indexOf("Line 3"),
          "line 2's column should come before line 3's column (sorted)",
        );
        assert.ok(lines.some((l) => l.includes("Qty") && l.includes("qty") && l.includes("10") && l.includes("5")));
        assert.ok(lines.some((l) => l.includes("Price") && l.includes("price") && l.includes("99.99") && l.includes("49.99")));
      }));

    test("renders a dump as raw plain text (no tables) when showResultsAsTable is off (default)", () =>
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

        const config = baseVscodeConfig(); // showResultsAsTable left at its default (off)

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

        const dump =
          "1~customerName~Acme|1~customerId~12345|3~qty~5|3~price~49.99|2~qty~10|2~price~99.99";
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ returnData: dump }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          resultsTerminal,
          { transport },
        );

        assert.ok(!lines.some((l) => l.includes("Header Attributes:")));
        assert.ok(!lines.some((l) => l.includes("Line Attributes:")));
        assert.ok(lines.some((l) => l.includes(dump)), "should print the raw dump string instead");
      }));

    test("falls back to plain text when returnData doesn't match the dump format", () =>
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
          text: JSON.stringify({ returnData: "just a plain string result" }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          resultsTerminal,
          { transport },
        );

        assert.ok(!lines.some((l) => l.includes("Header Attributes:")));
        assert.ok(!lines.some((l) => l.includes("Line Attributes:")));
        assert.ok(lines.some((l) => l.includes("just a plain string result")));
      }));

    test("plain JSON object returnData is NOT table-formatted when showResultsAsTable is off (default)", () =>
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

        const config = baseVscodeConfig(); // showResultsAsTable left at its default (off)
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

        assert.ok(
          !lines.some((l) => l.includes("key") && l.includes("value")),
          "should not render the key/value table header",
        );
        assert.ok(
          lines.some((l) => l.includes('{"name":"Devtest","status":"Active"}')),
          "should print the raw JSON string instead",
        );
      }));

    test("saves the same table to bml_debug_output.log that the terminal shows, when a dump is detected", () =>
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
        const outputLog = path.join(tmpDir, "logs", "transaction-debug-logs", "bml_debug_output.log");

        const vscode = createFakeVscode({
          config: baseVscodeConfig({ "debug.logOutputToFile": true, "debug.showResultsAsTable": true }),
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        });

        const dump = "1~status_t~Active|2~qty_l~10|2~price_l~99.99";
        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ returnData: dump }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          { writeLine: () => {}, show: () => {} },
          { transport },
        );

        const logContent = fs.readFileSync(outputLog, "utf8");
        // The log should contain the rendered tables, not the raw pipe/tilde dump.
        assert.ok(!logContent.includes(dump), "raw dump string should not be logged as-is");
        assert.ok(logContent.includes("Header Attributes:"));
        assert.ok(logContent.includes("Line Attributes:"));
        assert.ok(logContent.includes("Status") && logContent.includes("status_t") && logContent.includes("Active"));
        assert.ok(logContent.includes("Qty") && logContent.includes("qty_l") && logContent.includes("10"));
        assert.ok(logContent.includes("┌") && logContent.includes("│"), "should contain box-drawing table borders");
      }));

    test("saves the raw text to bml_debug_output.log when no table was rendered, matching what the terminal shows", () =>
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
        const outputLog = path.join(tmpDir, "logs", "transaction-debug-logs", "bml_debug_output.log");

        const vscode = createFakeVscode({
          config: baseVscodeConfig({ "debug.logOutputToFile": true }), // showResultsAsTable left off
          window: {
            activeTextEditor: editor,
            showInputBox: async () => "value",
          },
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        });

        const transport = async () => ({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ returnData: "just a plain string result" }),
        });

        await commands.runDebugCurrentFile(
          makeContext(),
          vscode,
          { writeLine: () => {}, show: () => {} },
          { transport },
        );

        const logContent = fs.readFileSync(outputLog, "utf8");
        assert.ok(logContent.includes("just a plain string result"));
        assert.ok(!logContent.includes("Header Attributes:"));
        assert.ok(!logContent.includes("┌"), "should not contain table borders for non-table output");
      }));
  },
);
