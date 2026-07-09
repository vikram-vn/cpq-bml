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
    test("renders a dump as separate header/line tables even when  is off (default)", () =>
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

        //  deliberately left at its default (off) - the dump-table
        // rendering must not depend on it; only the generic JSON-object table does.
        const config = baseVscodeConfig();

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

    test("plain JSON object returnData is still NOT table-formatted when  is off (default) - only the dump format bypasses that setting", () =>
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

        const config = baseVscodeConfig(); //  left at its default (off)
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
  },
);
