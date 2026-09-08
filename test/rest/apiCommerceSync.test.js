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
    const cacheFile = path.join(tempDir, ".cpq", "commerce", "transaction.min.json");
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

    // Verify files written to .cpq/commerce/ and .cpq/system/
    const commerceDir = path.join(tempDir, ".cpq", "commerce");
    const systemDir = path.join(tempDir, ".cpq", "system");
    assert.ok(fs.existsSync(path.join(commerceDir, "transaction.min.json")));
    assert.ok(fs.existsSync(path.join(commerceDir, "transaction-line.min.json")));
    assert.ok(fs.existsSync(path.join(systemDir, "variables.min.json")));
    assert.ok(fs.existsSync(path.join(commerceDir, "array-sets.min.json")));

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
