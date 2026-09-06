const assert = require("assert");
const fs = require("fs");
const path = require("path");
const tools = require("../../app/lang/mcp/tools");
const metadataLib = require("../../app/lang/rest/metadata");
const { createFakeVscode } = require("../rest/testHelpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir } = require("../rest/commands/fixtures");

function vscodeRootedAt(tmpDir, overrides) {
  return createFakeVscode({
    config: baseVscodeConfig(overrides),
    workspaceFolders: [{ uri: { fsPath: tmpDir } }],
  });
}

const JSON_HEADERS = { "content-type": "application/json" };
function jsonResponse(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, text: JSON.stringify(body) };
}

suite("MCP tools - lookup", () => {
  suite("listUtilFunctions", () => {
    test("paginates and returns variableName/name/namespace for every item", () =>
      withTempDir(async (tmpDir) => {
        const pages = [
          { items: [{ variableName: "a", name: "A", folderName: "util" }], hasMore: true },
          { items: [{ variableName: "b", name: "B", folderName: "util" }], hasMore: false },
        ];
        let call = 0;
        const transport = async () => jsonResponse(200, pages[call++]);

        const result = await tools.listUtilFunctions(makeContext(), vscodeRootedAt(tmpDir), {}, transport);

        assert.strictEqual(result.success, true);
        assert.deepStrictEqual(result.functions.map((f) => f.variableName), ["a", "b"]);
        assert.ok(result.log.some((l) => l.includes("Found 2 function")));
      }));

    test("reports an error when the list call fails", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => jsonResponse(500, { detail: "boom" });
        const result = await tools.listUtilFunctions(makeContext(), vscodeRootedAt(tmpDir), {}, transport);
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("boom"));
        assert.ok(result.log.some((l) => l.includes("List failed")));
      }));
  });

  suite("listCommerceFunctions", () => {
    test("targets the configured commerce process/document by default", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          return jsonResponse(200, { items: [], hasMore: false });
        };
        await tools.listCommerceFunctions(makeContext(), vscodeRootedAt(tmpDir), {}, transport);
        assert.ok(calls[0].startsWith("/rest/v18/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions"));
      }));

    test("honors an explicit commerceProcess/commerceDocument override", () =>
      withTempDir(async (tmpDir) => {
        const calls = [];
        const transport = async (opts) => {
          calls.push(opts.path);
          return jsonResponse(200, { items: [], hasMore: false });
        };
        await tools.listCommerceFunctions(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { commerceProcess: "otherProc", commerceDocument: "otherDoc" },
          transport,
        );
        assert.ok(calls[0].startsWith("/rest/v18/commerceProcessSetups/otherProc/documents/otherDoc/bml/library/functions"));
      }));
  });

  suite("pullFunction", () => {
    test("fetches a util function from CPQ, writes the canonical copy, and hands back an -AI working copy", () =>
      withTempDir(async (tmpDir) => {
        const transport = async (opts) => {
          if (opts.method === "GET" && opts.path.includes("/functions/concatString")) {
            return jsonResponse(200, SAMPLE_FUNCTION);
          }
          // list call (used to find the variableName)
          return jsonResponse(200, { items: [SAMPLE_FUNCTION], hasMore: false });
        };

        const result = await tools.pullFunction(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "concatString", type: "util" },
          transport,
        );

        assert.strictEqual(result.success, true);

        // localPath is the AI working copy - "_ai" suffixed file, never the canonical one.
        assert.strictEqual(path.basename(result.localPath), "concatString_ai.bml");
        assert.ok(fs.existsSync(result.localPath), "AI copy should be written");
        assert.strictEqual(fs.readFileSync(result.localPath, "utf8"), SAMPLE_FUNCTION.scriptText);
        const aiMeta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(result.localPath));
        assert.strictEqual(aiMeta.variableName, "concatString");

        // canonicalPath is the pristine pulled copy, untouched by the AI.
        assert.ok(fs.existsSync(result.canonicalPath), "canonical copy should also exist");
        assert.notStrictEqual(result.canonicalPath, result.localPath);
        assert.strictEqual(fs.readFileSync(result.canonicalPath, "utf8"), SAMPLE_FUNCTION.scriptText);

        // every call - success or failure - carries a human-readable log of what happened.
        assert.ok(result.log.some((l) => l.includes("Pull") && l.includes("concatString")));
        assert.ok(result.log.some((l) => l.includes("Pulled")));
      }));

    test("returns an error when the function cannot be found on CPQ", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => jsonResponse(200, { items: [], hasMore: false });
        const result = await tools.pullFunction(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { variableName: "missingFn" },
          transport,
        );
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("missingFn"));
        assert.ok(result.log.some((l) => l.includes("Pull failed")));
      }));

    test("requires a variableName", async () => {
      const result = await tools.pullFunction(makeContext(), createFakeVscode({}), {}, async () => {});
      assert.strictEqual(result.success, false);
    });
  });

  suite("pullFunctions", () => {
    test("requires a non-empty items array", async () => {
      const result = await tools.pullFunctions(makeContext(), createFakeVscode({}), {}, async () => {});
      assert.strictEqual(result.success, false);
    });

    test("pulls a mix of util and commerce functions, tolerating a per-item variableName mistake", () =>
      withTempDir(async (tmpDir) => {
        const transport = async (opts) => {
          if (opts.method === "GET" && opts.path.includes("/functions/concatString")) {
            return jsonResponse(200, SAMPLE_FUNCTION);
          }
          return jsonResponse(200, { items: [SAMPLE_FUNCTION], hasMore: false });
        };

        const result = await tools.pullFunctions(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { items: [{ variableName: "concatString", type: "util" }, { type: "util" }] },
          transport,
        );

        assert.strictEqual(result.success, false); // one item had no variableName
        assert.strictEqual(result.successCount, 1);
        assert.strictEqual(result.failureCount, 1);
        assert.strictEqual(result.results.length, 2);
        assert.strictEqual(result.results[0].success, true);
        assert.strictEqual(result.results[0].variableName, "concatString");
        assert.strictEqual(result.results[1].success, false);
        assert.ok(result.results[1].error.includes("variableName"));
      }));

    test("reports overall success when every item pulls successfully", () =>
      withTempDir(async (tmpDir) => {
        const transport = async (opts) => jsonResponse(200, { items: [SAMPLE_FUNCTION], hasMore: false });
        const transportWithGet = async (opts) => {
          if (opts.method === "GET" && opts.path.includes("/functions/")) return jsonResponse(200, SAMPLE_FUNCTION);
          return transport(opts);
        };

        const result = await tools.pullFunctions(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { items: [{ variableName: "concatString" }] },
          transportWithGet,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.successCount, 1);
        assert.strictEqual(result.failureCount, 0);
      }));
  });

  suite("globalSearchBml", () => {
    test("rejects call when query is missing", async () => {
      const result = await tools.globalSearchBml(makeContext(), createFakeVscode(), {});
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes("query is required"));
    });

    test("executes search and returns items, locations, counts, and log", () =>
      withTempDir(async (tmpDir) => {
        const mockResponse = {
          items: [
            {
              scriptText: "recordset = bmql(\"SELECT Part FROM RAM\");\nquantity = 0;\ncounter = 0;",
              locations: [
                {
                  type: "Attribute",
                  name: "price_attr",
                  variableName: "price_attr",
                  path: "oraclecpq/products/models/default",
                },
              ],
            },
          ],
          count: 1,
          totalResults: 1,
          hasMore: false,
        };

        const transport = async (opts) => {
          assert.ok(opts.path.startsWith("/rest/v19/bml/scripts?"));
          assert.strictEqual(opts.method, "GET");
          return jsonResponse(200, mockResponse);
        };

        const result = await tools.globalSearchBml(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { query: "counter" },
          transport,
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.query, "counter");
        assert.strictEqual(result.count, 1);
        assert.strictEqual(result.totalResults, 1);
        assert.strictEqual(result.items.length, 1);
        assert.strictEqual(result.items[0].locations[0].variableName, "price_attr");
        assert.ok(result.log.some((l) => l.includes("Found 1 match")));
      }));

    test("handles API errors gracefully", () =>
      withTempDir(async (tmpDir) => {
        const transport = async () => jsonResponse(400, { error: "Invalid query syntax" });
        const result = await tools.globalSearchBml(
          makeContext(),
          vscodeRootedAt(tmpDir),
          { query: "badQuery" },
          transport,
        );
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.statusCode, 400);
        assert.ok(result.error.includes("Invalid query syntax") || result.error.includes("400"));
        assert.ok(result.log.some((l) => l.includes("Search failed")));
      }));

    test("alias searchBmlScripts invokes same handler", async () => {
      assert.strictEqual(tools.searchBmlScripts, tools.globalSearchBml);
    });
  });
});

