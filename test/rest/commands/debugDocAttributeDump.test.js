const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../testHelpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir } = require("./fixtures");

suite("BML REST commands - debug - documentNumber~variableName~value terminal tables", () => {
  test("renders a dump as separate header/line tables, sorted by line", () =>
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

      // Out of order on purpose - documentNumber 3 appears before 2 - to verify sorting.
      const dump = "1~customerName~Acme|1~customerId~12345|3~qty~5|3~price~49.99|2~qty~10|2~price~99.99";
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
      assert.ok(lines.some((l) => l.includes("customerName") && l.includes("Acme")));
      assert.ok(lines.some((l) => l.includes("customerId") && l.includes("12345")));

      const lineTableStart = lines.findIndex((l) => l.includes("Line Attributes:"));
      const lineTableLines = lines.slice(lineTableStart);
      const row2Index = lineTableLines.findIndex((l) => l.includes("99.99")); // line 2's price
      const row3Index = lineTableLines.findIndex((l) => l.includes("49.99")); // line 3's price
      assert.ok(row2Index !== -1 && row3Index !== -1, "both line rows should be present");
      assert.ok(row2Index < row3Index, "line 2 should be rendered before line 3 (sorted)");
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
});
