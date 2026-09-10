const assert = require("assert");
const api = require("@/lang/rest/api");
const { createFakeVscode, createFakeContext } = require("@/test/rest/testHelpers");

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

function capturingTransport(sink) {
  return async (opts) => {
    sink.captured = opts;
    return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
  };
}

suite("Commerce Endpoints & Attributes (apiCommerce)", () => {
  suite("commerceDocumentsPath", () => {
    test("constructs path with default process and document capitalized", () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      assert.strictEqual(
        api.commerceDocumentsPath(vscode),
        "/rest/v19/commerceDocumentsOraclecpqoTransaction",
      );
    });

    test("constructs path with custom process and document capitalized", () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      assert.strictEqual(
        api.commerceDocumentsPath(vscode, "myProcess", "myDoc"),
        "/rest/v19/commerceDocumentsMyProcessMyDoc",
      );
    });
  });

  suite("getTransactions", () => {
    test("uses default offset=25, limit=25, fields=_id,transactionID_t, excludeFieldTypes=yes", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      const transport = async (opts) => {
        sink.captured = opts;
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              {
                _id: 12345,
                transactionID_t: "48420727",
                links: [{ rel: "self", href: "https://example.com" }],
              },
            ],
          }),
        };
      };

      const result = await api.getTransactions(
        fakeContext(),
        vscode,
        { offset: 25, limit: 25 },
        transport,
      );

      assert.strictEqual(sink.captured.method, "GET");
      assert.strictEqual(
        sink.captured.path,
        "/rest/v19/commerceDocumentsOraclecpqoTransaction?offset=25&limit=25&fields=_id%2CtransactionID_t&excludeFieldTypes=yes&totalResults=true",
      );
      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.items.length, 1);
      assert.strictEqual(result.body.items[0]._id, "12345");
      assert.strictEqual(result.body.items[0].transactionID_t, "48420727");
      assert.strictEqual(result.body.items[0].links, undefined);
    });

    test("passes custom q filter and honors custom pagination", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.getTransactions(
        fakeContext(),
        vscode,
        {
          q: { status_t: { $eq: "Open" } },
          offset: 50,
          limit: 10,
          fields: "status_t,totalAmount_t",
        },
        capturingTransport(sink),
      );

      assert.strictEqual(sink.captured.method, "GET");
      assert.ok(sink.captured.path.includes("offset=50&limit=10"));
      assert.ok(sink.captured.path.includes("q=%7B%22status_t%22%3A%7B%22%24eq%22%3A%22Open%22%7D%7D"));
      assert.ok(sink.captured.path.includes("fields=status_t%2CtotalAmount_t"));
    });

    test("automatically resolves human labels in fields, orderby, and q filter", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.getTransactions(
        fakeContext(),
        vscode,
        {
          fields: "Status, Total Amount",
          orderby: "Total Amount:desc, Status:asc",
          q: "{ status: 'Open' }",
        },
        capturingTransport(sink),
      );

      assert.ok(sink.captured.path.includes("fields=status_t%2CtotalAmount_t"));
      assert.ok(sink.captured.path.includes("orderby=totalAmount_t%3Adesc%2Cstatus_t%3Aasc"));
      assert.ok(sink.captured.path.includes("q=%7B%22status_t%22%3A%22Open%22%7D"));
    });

    test("alias listTransactions points to getTransactions", () => {
      assert.strictEqual(api.listTransactions, api.getTransactions);
    });

    test("getTransactions defaults offset to 0", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.getTransactions(
        fakeContext(),
        vscode,
        {},
        capturingTransport(sink),
      );
      assert.ok(sink.captured.path.includes("offset=0"));
    });
  });

  suite("Commerce Attributes & Menu Items", () => {
    test("listCommerceAttributes dispatches GET to /commerceProcesses/<proc>/documents/<doc>/attributes", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.listCommerceAttributes(
        fakeContext(),
        vscode,
        { process: "oraclecpqo", document: "transaction", offset: 10, limit: 100 },
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "GET");
      assert.strictEqual(
        sink.captured.path,
        "/rest/v19/commerceProcesses/oraclecpqo/documents/transaction/attributes?offset=10&limit=100&totalResults=true",
      );
    });

    test("listCommerceAttributeMenuItems dispatches GET to /attributes/<varName>/menuItems", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.listCommerceAttributeMenuItems(
        fakeContext(),
        vscode,
        { process: "oraclecpqo", document: "transaction", attributeVarName: "status_t" },
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "GET");
      assert.ok(
        sink.captured.path.startsWith(
          "/rest/v19/commerceProcesses/oraclecpqo/documents/transaction/attributes/status_t/menuItems",
        ),
      );
    });

    test("listCommerceArraySets dispatches GET to /commerceProcesses/<proc>/documents/<doc>/arraySets", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.listCommerceArraySets(
        fakeContext(),
        vscode,
        { process: "oraclecpqo", document: "transaction" },
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "GET");
      assert.ok(
        sink.captured.path.startsWith(
          "/rest/v19/commerceProcesses/oraclecpqo/documents/transaction/arraySets",
        ),
      );
    });

    test("listCommerceSystemAttributes dispatches GET to /commerceProcessSetups/systemAttributes", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.listCommerceSystemAttributes(
        fakeContext(),
        vscode,
        {},
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "GET");
      assert.ok(
        sink.captured.path.startsWith(
          "/rest/v19/commerceProcessSetups/systemAttributes",
        ),
      );
    });

    test("listCommerceAttributeLookups dispatches GET to /commerceProcessSetups/<process>/bml/attributeLookups", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.listCommerceAttributeLookups(
        fakeContext(),
        vscode,
        { process: "oraclecpqo" },
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "GET");
      assert.ok(
        sink.captured.path.startsWith(
          "/rest/v18/commerceProcessSetups/oraclecpqo/bml/attributeLookups",
        ),
      );
    });

    test("getCommerceAttribute fetches specific attribute, extracts type:displayValue, and fetches menu items if menu type", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const transport = async (opts) => {
        if (opts.path.includes("/menuItems")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              items: [
                { id: "approved", value: "approved", label: "Approved" },
                { id: "rejected", value: "rejected", label: "Rejected" },
              ],
            }),
          };
        }
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            variableName: "status_t",
            label: "Status",
            type: { displayValue: "Single Select Menu" },
            required: true,
            userDefault: "Draft",
            description: "Transaction status",
          }),
        };
      };

      const result = await api.getCommerceAttribute(
        fakeContext(),
        vscode,
        { process: "oraclecpqo", document: "transaction", attributeVarName: "status_t" },
        transport,
      );

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.variableName, "status_t");
      assert.strictEqual(result.body.label, "Status");
      assert.strictEqual(result.body.type, "Single Select Menu");
      assert.strictEqual(result.body.required, true);
      assert.strictEqual(result.body.menuOptions.length, 2);
      assert.strictEqual(result.body.menuOptions[0].value, "approved");
      assert.strictEqual(result.body.menuOptions[0].displayValue, "Approved");
      assert.strictEqual(result.body.menuItems.length, 2);
      assert.strictEqual(result.body.menuItems[0].name, "Approved");
    });

    test("listCommerceAttributeLookupValues dispatches GET to /attributeLookups/<lookupType>/lookupValues", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.listCommerceAttributeLookupValues(
        fakeContext(),
        vscode,
        { process: "oraclecpqo", lookupType: "transaction" },
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "GET");
      assert.ok(
        sink.captured.path.startsWith(
          "/rest/v18/commerceProcessSetups/oraclecpqo/bml/attributeLookups/transaction/lookupValues",
        ),
      );
    });

    test("runPipelineViewer dispatches POST to /commerceDocuments<Process><Document>/<id>/actions/_pipelineViewer", async () => {
      const vscode = createFakeVscode({ config: baseConfig() });
      const sink = {};
      await api.runPipelineViewer(
        fakeContext(),
        vscode,
        { id: "48420727", process: "oraclecpqo", document: "transaction" },
        capturingTransport(sink),
      );
      assert.strictEqual(sink.captured.method, "POST");
      assert.ok(
        sink.captured.path.startsWith(
          "/rest/v19/commerceDocumentsOraclecpqoTransaction/48420727/actions/_pipelineViewer",
        ),
      );
    });
  });
});
