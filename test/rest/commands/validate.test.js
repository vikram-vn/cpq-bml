const assert = require("assert");
const fs = require("fs");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../test-helpers");
const {
  SAMPLE_FUNCTION,
  baseVscodeConfig,
  makeContext,
  withTempDir,
  fakeResultsTerminal,
} = require("./fixtures");

suite("BML REST commands - validate", () => {
  suite("runValidateCurrentFile", () => {
    function makeEditorWithMetadata(tmpDir, scriptText) {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      return {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => scriptText,
        },
      };
    }

    test("shows an error when no .bml editor is active", async () => {
      const errors = [];
      const vscode = createFakeVscode({
        window: {
          showErrorMessage: (m) => errors.push(m),
          activeTextEditor: undefined,
        },
      });
      await commands.runValidateCurrentFile(
        makeContext(),
        vscode,
        { delete: () => {} },
        fakeResultsTerminal(),
      );
      assert.ok(errors[0].includes("open a .bml file"));
    });

    test("falls back to searching the live library by filename when no sidecar exists, and reports an error if no match is found there either", () =>
      withTempDir(async (tmpDir) => {
        const errors = [];
        const bmlPath = path.join(tmpDir, "untracked.bml");
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showErrorMessage: (m) => errors.push(m),
            showQuickPick: async (items) => items.find((i) => i.id === "fetch_util"),
            activeTextEditor: {
              document: {
                languageId: "bml",
                uri: { fsPath: bmlPath },
                getText: () => "x = 1;",
              },
            },
          },
        });
        let listedQuery;
        const transport = async (opts) => {
          listedQuery = opts.path;
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ items: [], hasMore: false }),
          };
        };

        await commands.runValidateCurrentFile(
          makeContext(),
          vscode,
          { delete: () => {} },
          fakeResultsTerminal(),
          { transport },
        );

        assert.ok(
          listedQuery.startsWith("/rest/v18/bml/library/functions?"),
          'should have searched the live library for variable name "untracked"',
        );
        assert.ok(
          errors[0].includes('could not find CPQ metadata for "untracked"'),
        );
        assert.ok(errors[0].includes("Pull Util Library Functions"));
      }));

    test("resolves metadata from the live library when no sidecar exists, then caches it locally", () =>
      withTempDir(async (tmpDir) => {
        const infos = [];
        const bmlPath = path.join(tmpDir, "concatString.bml");
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showInformationMessage: (m) => infos.push(m),
            showQuickPick: async (items) => items.find((i) => i.id === "fetch_util"),
            activeTextEditor: {
              document: {
                languageId: "bml",
                uri: { fsPath: bmlPath },
                getText: () => SAMPLE_FUNCTION.scriptText,
              },
            },
          },
        });
        const transport = async (opts) => {
          if (opts.path.startsWith("/rest/v18/bml/library/functions?")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                items: [{ variableName: "concatString", folderName: "util" }],
                hasMore: false,
              }),
            };
          }
          if (opts.method === "GET") {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify(SAMPLE_FUNCTION),
            };
          }
          return { statusCode: 204, headers: {}, text: "" };
        };

        await commands.runValidateCurrentFile(
          makeContext(),
          vscode,
          { delete: () => {} },
          fakeResultsTerminal(),
          { transport },
        );

        assert.ok(infos[0].includes("concatString is valid"));
        const cachedMetaPath = metadataLib.bmlPathToMetaPath(bmlPath);
        assert.strictEqual(
          JSON.parse(fs.readFileSync(cachedMetaPath, "utf8")).variableName,
          "concatString",
        );
      }));

    test("on success (204), clears diagnostics, shows an info message, and writes to the results terminal", () =>
      withTempDir(async (tmpDir) => {
        const infos = [];
        const lines = [];
        let deletedUri;
        const editor = makeEditorWithMetadata(tmpDir, "return stringOne;");
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showInformationMessage: (m) => infos.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async () => ({
          statusCode: 204,
          headers: {},
          text: "",
        });

        await commands.runValidateCurrentFile(
          makeContext(),
          vscode,
          {
            delete: (uri) => {
              deletedUri = uri;
            },
          },
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.ok(infos[0].includes("concatString is valid"));
        assert.strictEqual(deletedUri, editor.document.uri);
        assert.ok(
          lines.some((l) => l.includes("Validation passed: no errors found")),
        );
      }));

    test("on failure, shows an error message and writes the failure detail to the results terminal", () =>
      withTempDir(async (tmpDir) => {
        const errors = [];
        const lines = [];
        const editor = makeEditorWithMetadata(tmpDir, "return ;;;");
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showErrorMessage: (m) => errors.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async () => ({
          statusCode: 400,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ detail: "Unexpected token ;" }),
        });

        await commands.runValidateCurrentFile(
          makeContext(),
          vscode,
          { delete: () => {} },
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.ok(errors[0].includes("Unexpected token ;"));
        assert.ok(
          lines.some((l) =>
            l.includes("Validation failed: Unexpected token ;"),
          ),
        );
      }));

    test("on multiline failure, splits lines and indents subsequent lines to avoid stair-stepping", () =>
      withTempDir(async (tmpDir) => {
        const errors = [];
        const lines = [];
        const editor = makeEditorWithMetadata(tmpDir, "return ;;;");
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showErrorMessage: (m) => errors.push(m),
            activeTextEditor: editor,
          },
        });
        const transport = async () => ({
          statusCode: 400,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ detail: "Line 1\nLine 2" }),
        });

        await commands.runValidateCurrentFile(
          makeContext(),
          vscode,
          { delete: () => {} },
          fakeResultsTerminal(lines),
          { transport },
        );

        assert.strictEqual(lines.length, 5);
        assert.ok(lines[3].includes("Validation failed: Line 1"));
        assert.ok(lines[4].includes(" ".repeat(45) + "Line 2"));
      }));
  });
});
