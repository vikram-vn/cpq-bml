const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const api = require("../../app/lang/rest/api");
const { createFakeVscode, createFakeContext } = require("./testHelpers");

const SECRET_PASSWORD = "cpqBml.connection.password";

function baseConfig(extra = {}) {
  return {
    "connection.siteUrl": "https://sitename.bigmachines.com",
    "connection.username": "alice",
    ...extra,
  };
}

function fakeContext() {
  return createFakeContext({ [SECRET_PASSWORD]: "secret" });
}

suite("BML REST apiCommerceSync - syncCommerceAttributes", () => {
  test("syncCommerceAttributes aggregates attributes and systemAttributes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-test-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    const mockTransport = async (opts) => {
      if (opts.path.includes("/attributes/status_t/menuItems")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ items: [{ id: "val1", value: "val1", label: "Open" }] }),
        };
      }
      if (opts.path.includes("/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { variableName: "status_t", name: "Status", dataType: "Single Select Menu" },
            ],
          }),
        };
      }
      if (opts.path.includes("/systemAttributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "_transaction_id", name: "Transaction ID" }],
          }),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchMenuItems: true },
      mockTransport,
    );

    assert.strictEqual(result.attributes.length, 1);
    assert.strictEqual(result.attributes[0].variableName, "status_t");
    assert.strictEqual(result.attributes[0].menuItems.length, 1);
    assert.strictEqual(result.systemAttributes.length, 1);
    assert.strictEqual(result.systemAttributes[0].variableName, "_transaction_id");

    // Verify written to disk cache
    const cacheFile = path.join(tempDir, ".cpq", "commerce.attributes.min.json");
    assert.ok(fs.existsSync(cacheFile));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("syncCommerceAttributes handles object dataType and normalizes to string without error", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-obj-type-test-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    const mockTransport = async (opts) => {
      if (opts.path.includes("/attributes/status_t/menuItems")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ items: [{ id: "val1", value: "val1", label: "Open" }] }),
        };
      }
      if (opts.path.includes("/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              {
                variableName: "status_t",
                name: "Status",
                dataType: { value: 1, displayValue: "Single Select Menu" },
              },
              {
                variableName: "doc_num",
                name: "Document Number",
                dataType: { value: 5, displayValue: "String" },
              },
            ],
          }),
        };
      }
      if (opts.path.includes("/systemAttributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify([
            {
              label: "Current User's Name",
              variableName: "_system_user_name",
              type: "String",
              description: "Current User's Name",
            },
          ]),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchMenuItems: true },
      mockTransport,
    );

    assert.strictEqual(result.attributes.length, 2);
    assert.strictEqual(result.attributes[0].variableName, "status_t");
    assert.strictEqual(result.attributes[0].dataType, "Single Select Menu");
    assert.strictEqual(result.attributes[0].menuItems.length, 1);
    assert.strictEqual(result.attributes[1].variableName, "doc_num");
    assert.strictEqual(result.attributes[1].dataType, "String");
    assert.strictEqual(result.systemAttributes.length, 1);
    assert.strictEqual(result.systemAttributes[0].variableName, "_system_user_name");
    assert.strictEqual(result.systemAttributes[0].dataType, "String");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("syncCommerceAttributes fetches attributeLookups and populates lookups in result and cache", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-lookups-test-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    const mockTransport = async (opts) => {
      if (opts.path.includes("/bml/attributeLookups/transaction/lookupValues")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { name: "totalAmount_t", displayLabel: "Grand Total", dataType: { value: 2, displayValue: "Float" } },
            ],
          }),
        };
      }
      if (opts.path.includes("/bml/attributeLookups/transactionLine/lookupValues")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { name: "_part_number", displayLabel: "Part Number", dataType: { value: 5, displayValue: "String" } },
            ],
          }),
        };
      }
      if (opts.path.includes("/bml/attributeLookups/systemVariables/lookupValues")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { name: "_system_date", displayLabel: "System Date", dataType: "String (date)" },
            ],
          }),
        };
      }
      if (opts.path.endsWith("/bml/attributeLookups")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { lookupType: "transaction" },
              { lookupType: "transactionLine" },
              { lookupType: "systemVariables" },
            ],
          }),
        };
      }
      if (opts.path.includes("/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ items: [] }),
        };
      }
      if (opts.path.includes("/systemAttributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify([]),
        };
      }
      if (opts.path.includes("/arraySets")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ items: [{ variableName: "feeItems_set", name: "Fee Items", description: "Array of fee items" }] }),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchLookups: true },
      mockTransport,
    );

    assert.ok(result.lookups);
    assert.strictEqual(result.lookups.transaction.length, 1);
    assert.strictEqual(result.lookups.transaction[0].variableName, "totalAmount_t");
    assert.strictEqual(result.lookups.transactionLine.length, 1);
    assert.strictEqual(result.lookups.transactionLine[0].variableName, "_part_number");
    assert.strictEqual(result.lookups.systemVariables.length, 1);
    assert.strictEqual(result.lookups.systemVariables[0].variableName, "_system_date");

    assert.ok(result.arraySets);
    assert.strictEqual(result.arraySets.length, 1);
    assert.strictEqual(result.arraySets[0].variableName, "feeItems_set");

    // Verify files written to .cpq/
    assert.ok(fs.existsSync(path.join(tempDir, ".cpq", "commerce.attributes.min.json")));
    assert.ok(fs.existsSync(path.join(tempDir, ".cpq", "system.attributes.min.json")));

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("syncCommerceAttributes auto-paginates when hasMore is true", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-page-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    const pageCalls = [];
    const mockTransport = async (opts) => {
      if (opts.path.includes("/attributes")) {
        pageCalls.push(opts.path);
        if (opts.path.includes("offset=0")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              hasMore: true,
              items: [{ variableName: "page1_attr", name: "P1", dataType: "Text" }],
            }),
          };
        }
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            hasMore: false,
            items: [{ variableName: "page2_attr", name: "P2", dataType: "Text" }],
          }),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchMenuItems: false },
      mockTransport,
    );

    assert.strictEqual(result.attributes.length, 2);
    assert.strictEqual(pageCalls.length, 2);
    assert.ok(pageCalls[0].includes("offset=0"));
    assert.ok(pageCalls[1].includes("offset=1000"));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("syncCommerceAttributes fetches menu items concurrently", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-menu-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    let activeMenuFetches = 0;
    let maxParallelMenuFetches = 0;

    const mockTransport = async (opts) => {
      if (opts.path.includes("/menuItems")) {
        activeMenuFetches++;
        maxParallelMenuFetches = Math.max(maxParallelMenuFetches, activeMenuFetches);
        await new Promise((r) => setTimeout(r, 10));
        activeMenuFetches--;
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ items: [{ id: "1", value: "A", label: "Option A" }] }),
        };
      }
      if (opts.path.includes("/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { variableName: "menu1", name: "Menu 1", dataType: "Single Select Menu" },
              { variableName: "menu2", name: "Menu 2", dataType: "Single Select Menu" },
              { variableName: "menu3", name: "Menu 3", dataType: "Single Select Menu" },
            ],
          }),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchMenuItems: true },
      mockTransport,
    );

    assert.strictEqual(result.attributes.length, 3);
    assert.ok(maxParallelMenuFetches > 1, `Expected parallel menu fetches > 1, got ${maxParallelMenuFetches}`);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("syncCommerceAttributes discovers documents and downloads both transaction and line item attributes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-docs-test-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    const mockTransport = async (opts) => {
      if (opts.path.includes("/documents/transaction/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { variableName: "quoteTotal_t", name: "Quote Total", dataType: "Currency" },
            ],
          }),
        };
      }
      if (opts.path.includes("/documents/transactionLine/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { variableName: "unitPrice_l", name: "Unit Price", dataType: "Currency" },
              { variableName: "itemQuantity_l", name: "Quantity", dataType: "Integer" },
            ],
          }),
        };
      }
      if (opts.path.match(/\/commerceProcesses\/[^\/]+\/documents(?:\?|$)/)) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              { variableName: "transaction", name: "Transaction", documentType: "document" },
              { variableName: "transactionLine", name: "Transaction Line", documentType: "subDocument" },
            ],
          }),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchMenuItems: false, fetchLookups: false },
      mockTransport,
    );

    assert.strictEqual(result.attributes.length, 1);
    assert.strictEqual(result.attributes[0].variableName, "quoteTotal_t");
    assert.strictEqual(result.attributes[0].scope, "Transaction");

    assert.ok(Array.isArray(result.lineAttributes));
    assert.strictEqual(result.lineAttributes.length, 2);
    assert.strictEqual(result.lineAttributes[0].variableName, "unitPrice_l");
    assert.strictEqual(result.lineAttributes[0].scope, "Line Item");
    assert.strictEqual(result.lineAttributes[1].variableName, "itemQuantity_l");

    // Verify written to commerce.attributes.min.json with both header and line items preserved
    const cacheFile = path.join(tempDir, ".cpq", "commerce.attributes.min.json");
    assert.ok(fs.existsSync(cacheFile));
    const cachedJson = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    assert.strictEqual(cachedJson.count, 3);
    assert.strictEqual(cachedJson.lookups.transaction.length, 1);
    assert.strictEqual(cachedJson.lookups.transactionLine.length, 2);
    assert.strictEqual(cachedJson.lookups.transactionLine[0].variableName, "unitPrice_l");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("syncCommerceAttributes paginates attributeLookups beyond 1000 items without missing any", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-sync-lookups-page-"));
    const vscode = createFakeVscode({
      config: baseConfig(),
      workspaceFolders: [{ uri: { fsPath: tempDir } }],
    });

    const mockTransport = async (opts) => {
      if (opts.path.endsWith("/bml/attributeLookups")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ lookupType: "transactionLine" }],
          }),
        };
      }
      if (opts.path.includes("/bml/attributeLookups/transactionLine/lookupValues")) {
        if (opts.path.includes("offset=0")) {
          const items = [];
          for (let i = 0; i < 1000; i++) {
            items.push({ name: `line_attr_${i}`, displayLabel: `Line Attr ${i}`, dataType: "String" });
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ hasMore: true, items }),
          };
        }
        if (opts.path.includes("offset=1000")) {
          const items = [];
          for (let i = 1000; i < 1250; i++) {
            items.push({ name: `line_attr_${i}`, displayLabel: `Line Attr ${i}`, dataType: "String" });
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ hasMore: false, items }),
          };
        }
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncCommerceAttributes(
      fakeContext(),
      vscode,
      { process: "oraclecpqo", document: "transaction", fetchMenuItems: false, fetchLookups: true },
      mockTransport,
    );

    assert.ok(result.lookups.transactionLine);
    assert.strictEqual(result.lookups.transactionLine.length, 1250);
    assert.strictEqual(result.lookups.transactionLine[0].variableName, "line_attr_0");
    assert.strictEqual(result.lookups.transactionLine[1249].variableName, "line_attr_1249");

    // Verify commerce.attributes.min.json received all 1250 line attributes
    const cacheFile = path.join(tempDir, ".cpq", "commerce.attributes.min.json");
    const cachedJson = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    assert.strictEqual(cachedJson.lookups.transactionLine.length, 1250);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("saveWorkspaceAttributes preserves union of document attributes and BML lookups without dropping any", () => {
    const { saveWorkspaceAttributes } = require("../../app/lang/rest/commerceAttributesWriter");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-union-test-"));

    const data = {
      attributes: [
        {
          variableName: "status_t",
          name: "Status",
          dataType: "Single Select Menu",
          menuOptions: [{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }],
          description: "Status of quote",
        },
        {
          variableName: "onlyInDoc_t",
          name: "Only In Document",
          dataType: "String",
        },
      ],
      lineAttributes: [
        {
          variableName: "partNum_l",
          name: "Part Number",
          dataType: "String",
        },
      ],
      lookups: {
        transaction: [
          {
            variableName: "status_t",
            name: "Status (Lookups)",
            dataType: "String", // Lookups has basic String
          },
          {
            variableName: "onlyInLookups_t",
            name: "Only In Lookups",
            dataType: "Float",
          },
        ],
        transactionLine: [
          {
            variableName: "lineLookup_l",
            name: "Line Lookup",
            dataType: "Integer",
          },
        ],
      },
    };

    saveWorkspaceAttributes(tempDir, data);

    const cacheFile = path.join(tempDir, ".cpq", "commerce.attributes.min.json");
    assert.ok(fs.existsSync(cacheFile));
    const json = JSON.parse(fs.readFileSync(cacheFile, "utf8"));

    // Transaction union: status_t, onlyInDoc_t, onlyInLookups_t -> 3 items
    assert.strictEqual(json.attributes.length, 3);
    const statusAttr = json.attributes.find((a) => a.variableName === "status_t");
    assert.ok(statusAttr);
    // Menu options from document attributes must be preserved
    assert.ok(Array.isArray(statusAttr.menuOptions));
    assert.strictEqual(statusAttr.menuOptions.length, 2);
    assert.strictEqual(statusAttr.description, "Status of quote");

    const docOnly = json.attributes.find((a) => a.variableName === "onlyInDoc_t");
    assert.ok(docOnly, "onlyInDoc_t must NOT be discarded");

    const lookupOnly = json.attributes.find((a) => a.variableName === "onlyInLookups_t");
    assert.ok(lookupOnly, "onlyInLookups_t must NOT be discarded");

    // Line items union: partNum_l and lineLookup_l -> 2 items
    assert.strictEqual(json.lookups.transactionLine.length, 2);
    const partNum = json.lookups.transactionLine.find((a) => a.variableName === "partNum_l");
    assert.ok(partNum, "partNum_l must be preserved in transactionLine");
    const lineLookup = json.lookups.transactionLine.find((a) => a.variableName === "lineLookup_l");
    assert.ok(lineLookup, "lineLookup_l must be preserved in transactionLine");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
