const assert = require("assert");
const fs = require("fs");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const shared = require("../../../app/lang/rest/commands/shared");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../testHelpers");
const { baseVscodeConfig, makeContext, withTempDir } = require("./fixtures");

suite("BML REST commands - shared", () => {
  test("describeError best-effort extracts a readable message from various error body shapes", () => {
    assert.strictEqual(commands.describeError(null), "");
    assert.strictEqual(
      commands.describeError("plain text error"),
      "plain text error",
    );
    assert.strictEqual(commands.describeError({ detail: "d" }), "d");
    assert.strictEqual(commands.describeError({ title: "t" }), "t");
    assert.strictEqual(commands.describeError({ message: "m" }), "m");
    assert.strictEqual(
      commands.describeError({
        "o:errorDetails": [{ title: "Compilation error: missing semicolon" }],
        title: "Invalid payload."
      }),
      "Compilation error: missing semicolon"
    );
    assert.strictEqual(
      commands.describeError({ weird: "shape" }),
      JSON.stringify({ weird: "shape" }),
    );
  });

  suite("resolveMetadataForFile", () => {
    test("infers commerceProcess and commerceDocument from path when missing in sidecar", () =>
      withTempDir(async (tmpDir) => {
        const processDir = path.join(tmpDir, "oraclecpqo");
        const docDir = path.join(processDir, "transaction");
        const libsDir = path.join(docDir, "libraries");
        const funcDir = path.join(libsDir, "myFunc");
        fs.mkdirSync(funcDir, { recursive: true });

        const bmlPath = path.join(funcDir, "myFunc.bml");
        const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);

        const partialMetadata = {
          variableName: "myFunc",
          name: "My Func",
          description: "Desc",
          returnType: "String",
          parameters: []
        };
        metadataLib.writeMetadata(metaPath, partialMetadata);

        const vscode = createFakeVscode({ config: baseVscodeConfig() });
        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath);

        assert.strictEqual(metadata.commerceProcess, "oraclecpqo");
        assert.strictEqual(metadata.commerceDocument, "transaction");
      }));

    test("with missing sidecar and path inference: queries specific commerce process/document if inferred", () =>
      withTempDir(async (tmpDir) => {
        const processDir = path.join(tmpDir, "oraclecpqo");
        const docDir = path.join(processDir, "transaction");
        const libsDir = path.join(docDir, "libraries");
        const funcDir = path.join(libsDir, "myFunc");
        fs.mkdirSync(funcDir, { recursive: true });
        const bmlPath = path.join(funcDir, "myFunc.bml");

        const queries = [];
        const transport = async (opts) => {
          queries.push({ path: opts.path, method: opts.method });
          if (opts.path.includes("bml/library/functions?")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                items: [{ variableName: "myFunc", name: "myFunc" }],
                hasMore: false
              })
            };
          }
          if (opts.method === "GET") {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                variableName: "myFunc",
                name: "myFunc",
                scriptText: "return;"
              })
            };
          }
          return { statusCode: 200, headers: {}, text: "" };
        };

        const vscode = createFakeVscode({ config: baseVscodeConfig() });
        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath, transport);

        assert.ok(metadata);
        assert.strictEqual(metadata.commerceProcess, "oraclecpqo");
        assert.strictEqual(metadata.commerceDocument, "transaction");
        assert.strictEqual(queries.length, 2);
        assert.ok(queries[0].path.includes("commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions?"));
        assert.ok(queries[1].path.includes("commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/myFunc"));
      }));

    test("with missing sidecar and NO path inference: returns null if user cancels the prompt", () =>
      withTempDir(async (tmpDir) => {
        const bmlPath = path.join(tmpDir, "myFunc.bml");
        const queries = [];
        const transport = async (opts) => {
          queries.push({ path: opts.path });
          return { statusCode: 404, headers: {}, text: "" };
        };

        let quickPickItems = null;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showQuickPick: async (items) => {
              quickPickItems = items;
              return undefined;
            }
          }
        });
        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath, transport);

        assert.strictEqual(metadata, null);
        assert.strictEqual(queries.length, 0);
        assert.ok(quickPickItems);
        assert.strictEqual(quickPickItems.length, 3);
        assert.strictEqual(quickPickItems[0].id, 'fetch_util');
        assert.strictEqual(quickPickItems[1].id, 'fetch_commerce');
        assert.strictEqual(quickPickItems[2].id, 'create');
      }));

    test("with missing sidecar and NO path inference: queries utility library if user selects Utility", () =>
      withTempDir(async (tmpDir) => {
        const bmlPath = path.join(tmpDir, "myFunc.bml");
        const queries = [];
        const transport = async (opts) => {
          queries.push({ path: opts.path, method: opts.method });
          if (opts.path.includes("bml/library/functions?")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                items: [{ variableName: "myFunc", name: "myFunc" }],
                hasMore: false
              })
            };
          }
          if (opts.method === "GET") {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                variableName: "myFunc",
                name: "myFunc",
                scriptText: "return;"
              })
            };
          }
          return { statusCode: 404, headers: {}, text: "" };
        };

        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showQuickPick: async (items) => items.find(i => i.id === 'fetch_util')
          }
        });
        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath, transport);

        assert.ok(metadata);
        assert.strictEqual(metadata.commerceProcess, undefined);
        assert.strictEqual(metadata.commerceDocument, undefined);
        assert.strictEqual(queries.length, 2);
        assert.ok(queries[0].path.endsWith("/v18/bml/library/functions?offset=0&limit=1000"));
        assert.ok(queries[1].path.endsWith("/v18/bml/library/functions/myFunc"));
      }));

    test("with missing sidecar and NO path inference: queries transaction library if user selects transaction", () =>
      withTempDir(async (tmpDir) => {
        const bmlPath = path.join(tmpDir, "myFunc.bml");
        const queries = [];
        const transport = async (opts) => {
          queries.push({ path: opts.path, method: opts.method });
          if (opts.path.includes("bml/library/functions?")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                items: [{ variableName: "myFunc", name: "myFunc" }],
                hasMore: false
              })
            };
          }
          if (opts.method === "GET") {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                variableName: "myFunc",
                name: "myFunc",
                scriptText: "return;"
              })
            };
          }
          return { statusCode: 404, headers: {}, text: "" };
        };

        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            showQuickPick: async (items) => items.find(i => i.id === 'fetch_commerce')
          }
        });
        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath, transport);

        assert.ok(metadata);
        assert.strictEqual(metadata.commerceProcess, "oraclecpqo");
        assert.strictEqual(metadata.commerceDocument, "transaction");
        assert.strictEqual(queries.length, 2);
        assert.ok(queries[0].path.includes("commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions?"));
        assert.ok(queries[1].path.includes("commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions/myFunc"));

        const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
        const cachedMeta = metadataLib.readMetadata(metaPath);
        assert.strictEqual(cachedMeta.commerceProcess, "oraclecpqo");
        assert.strictEqual(cachedMeta.commerceDocument, "transaction");
      }));

    test("with missing sidecar and NO path inference: creates metadata locally if user selects Create New Function Metadata", () =>
      withTempDir(async (tmpDir) => {
        const bmlPath = path.join(tmpDir, "myFunc.bml");
        fs.writeFileSync(bmlPath, "return;", "utf8");

        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          workspaceFolders: [{ uri: { fsPath: tmpDir } }],
          window: {
            showQuickPick: async (items) => {
              if (items[0].id === 'fetch_util') {
                return items.find(i => i.id === 'create');
              }
              if (items[0].id === 'util') {
                return items.find(i => i.id === 'commerce');
              }
              return items.find(i => i.label === 'String');
            },
            showInputBox: async (options) => {
              if (options.prompt && options.prompt.includes("display name")) {
                return "My Func Display";
              }
              if (options.prompt && options.prompt.includes("description")) {
                return "Desc";
              }
              return "util";
            }
          }
        });

        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath);

        assert.ok(metadata);
        assert.strictEqual(metadata.name, "My Func Display");
        assert.strictEqual(metadata.variableName, "myFunc");
        assert.strictEqual(metadata.commerceProcess, "oraclecpqo");
        assert.strictEqual(metadata.commerceDocument, "transaction");

        const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
        assert.ok(fs.existsSync(metaPath));
        const savedMeta = metadataLib.readMetadata(metaPath);
        assert.strictEqual(savedMeta.name, "My Func Display");
      }));

    test("automatically resolves dependent attributes when local metadata has libraryFunctions", () =>
      withTempDir(async (tmpDir) => {
        const bmlPath = path.join(tmpDir, "myFunc.bml");
        const metaPath = metadataLib.bmlPathToMetaPath(bmlPath);
        const initialMetadata = {
          name: "My Func",
          variableName: "myFunc",
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
          libraryFunctions: [
            { variableName: "oRCL_INT_GetTemplates", type: "UTIL_LIBRARY" }
          ]
        };
        metadataLib.writeMetadata(metaPath, initialMetadata);

        const queries = [];
        const transport = async (opts) => {
          queries.push({ path: opts.path, method: opts.method });
          if (opts.path.includes("actions/dependentAttributes")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                systemAttributes: [{ name: "_system_current_step_var" }],
                mainDocAttributes: [{ name: "transactionID_t" }],
                subDocAttributes: [{ name: "_document_number" }]
              })
            };
          }
          return { statusCode: 200, headers: {}, text: "" };
        };

        const vscode = createFakeVscode({ config: baseVscodeConfig() });
        const metadata = await commands.resolveMetadataForFile(makeContext(), vscode, bmlPath, transport);

        assert.ok(metadata);
        assert.deepStrictEqual(metadata.systemAttributes, [{ name: "_system_current_step_var" }]);
        assert.deepStrictEqual(metadata.mainDocAttributes, [{ name: "transactionID_t" }]);
        assert.deepStrictEqual(metadata.subDocAttributes, [{ name: "_document_number" }]);

        const savedMeta = metadataLib.readMetadata(metaPath);
        assert.deepStrictEqual(savedMeta.systemAttributes, [{ name: "_system_current_step_var" }]);
      }));
  });
});
