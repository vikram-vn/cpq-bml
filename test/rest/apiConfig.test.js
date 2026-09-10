const assert = require("assert");
const api = require("@/lang/rest/api");
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

suite("Configuration Attributes & Product Families (apiConfig)", () => {
  test("listConfigurationAttributes dispatches GET to /allProductFamilySetups/_allProductFamilies/attributes", async () => {
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
              variableName: "_config_memory_size",
              label: "Memory Size",
              dataType: { displayValue: "Integer" },
              required: false,
              defaultValue: 16,
            },
          ],
        }),
      };
    };

    const result = await api.listConfigurationAttributes(fakeContext(), vscode, {}, transport);
    assert.strictEqual(sink.captured.method, "GET");
    assert.ok(sink.captured.path.includes("/allProductFamilySetups/_allProductFamilies/attributes"));
    assert.strictEqual(result.body.items.length, 1);
    assert.strictEqual(result.body.items[0].variableName, "_config_memory_size");
  });

  test("listProductFamilies dispatches GET to /allProductFamilySetups", async () => {
    const vscode = createFakeVscode({ config: baseConfig() });
    const sink = {};
    const transport = async (opts) => {
      sink.captured = opts;
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          items: [{ variableName: "servers", label: "Servers" }],
        }),
      };
    };

    const result = await api.listProductFamilies(fakeContext(), vscode, {}, transport);
    assert.strictEqual(sink.captured.method, "GET");
    assert.ok(sink.captured.path.includes("/allProductFamilySetups"));
    assert.strictEqual(result.body.items.length, 1);
    assert.strictEqual(result.body.items[0].variableName, "servers");
  });

  test("formatConfigurationAttribute normalizes object and string dataTypes cleanly", () => {
    const formatted = api.formatConfigurationAttribute({
      variableName: "processor_speed",
      label: "Processor Speed",
      dataType: { displayValue: "Float" },
      required: true,
      category: { displayValue: "System" },
      description: "Speed in GHz",
    });
    assert.strictEqual(formatted.variableName, "processor_speed");
    assert.strictEqual(formatted.label, "Processor Speed");
    assert.strictEqual(formatted.dataType, "Float");
    assert.strictEqual(formatted.type, "Float");
    assert.strictEqual(formatted.required, true);
    assert.strictEqual(formatted.scope, "Configuration");
    assert.strictEqual(formatted.category, "System");
  });

  test("syncConfigurationAttributes fetches configuration attributes and product families", async () => {
    const vscode = createFakeVscode({ config: baseConfig() });
    const transport = async (opts) => {
      if (opts.path.includes("/productFamilies/") && opts.path.includes("/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              {
                variableName: "_storage_raid_level",
                label: "RAID Level",
                dataType: { displayValue: "Text" },
                required: false,
              },
            ],
          }),
        };
      }
      if (opts.path.includes("/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [
              {
                variableName: "_config_cpu_type",
                label: "CPU Type",
                dataType: { displayValue: "Text" },
                required: true,
              },
            ],
          }),
        };
      }
      if (opts.path.includes("/productLines") && opts.path.includes("/models")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "storageModelX", label: "Storage Model X" }],
          }),
        };
      }
      if (opts.path.includes("/productLines")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "diskLine", label: "Disk Line" }],
          }),
        };
      }
      if (opts.path.includes("/allProductFamilySetups")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "storageFamily", label: "Storage Family" }],
          }),
        };
      }
      return { statusCode: 200, headers: {}, text: "{}" };
    };

    const result = await api.syncConfigurationAttributes(fakeContext(), vscode, {}, transport);
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.attributes[0].variableName, "_config_cpu_type");
    assert.strictEqual(result.attributes[0].scope, "Configuration");
    assert.strictEqual(result.attributes[1].variableName, "_storage_raid_level");
    assert.strictEqual(result.attributes[1].productFamily, "storageFamily");
    assert.strictEqual(result.productFamilies.length, 1);
    assert.strictEqual(result.productFamilies[0].variableName, "storageFamily");
    assert.strictEqual(result.models.length, 1);
    assert.strictEqual(result.models[0].variableName, "storageModelX");
    assert.strictEqual(result.models[0].productLine, "diskLine");
    assert.strictEqual(result.models[0].productFamily, "storageFamily");
  });

  test("listProductLines, listModels, listModelAttributes dispatch to proper REST endpoints", async () => {
    const vscode = createFakeVscode({ config: baseConfig() });
    const calls = [];
    const transport = async (opts) => {
      calls.push(opts.path);
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({ items: [] }),
      };
    };

    await api.listProductLines(fakeContext(), vscode, { productFamily: "famA" }, transport);
    assert.ok(calls[0].includes("/productFamilies/famA/productLines"));

    await api.listModels(fakeContext(), vscode, { productFamily: "famA", productLine: "lineB" }, transport);
    assert.ok(calls[1].includes("/productLines/lineB/models"));

    await api.listModelAttributes(fakeContext(), vscode, { productFamily: "famA", productLine: "lineB", model: "modC" }, transport);
    assert.ok(calls[2].includes("/models/modC/attributes"));
  });

  test("listConfigurationAttributes forwards q filter and signal in query", async () => {
    const vscode = createFakeVscode({ config: baseConfig() });
    let captured;
    const transport = async (opts) => {
      captured = opts;
      return { statusCode: 200, headers: {}, text: JSON.stringify({ items: [] }) };
    };

    await api.listConfigurationAttributes(
      fakeContext(),
      vscode,
      { q: "variableName LIKE 'o_%'" },
      transport,
    );
    assert.ok(decodeURIComponent(captured.path).includes("q=variableName LIKE 'o_%'"));
  });

  test("syncConfigurationAttributes auto-paginates when hasMore is true", async () => {
    const vscode = createFakeVscode({ config: baseConfig() });
    const pageCalls = [];
    const transport = async (opts) => {
      pageCalls.push(opts.path);
      if (opts.path.includes("offset=0")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            hasMore: true,
            items: [{ variableName: "attr_p1", label: "P1" }],
          }),
        };
      }
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify({
          hasMore: false,
          items: [{ variableName: "attr_p2", label: "P2" }],
        }),
      };
    };

    const progressReports = [];
    const result = await api.syncConfigurationAttributes(
      fakeContext(),
      vscode,
      {
        limit: 1,
        fetchProductFamilies: false,
        onProgress: (p) => progressReports.push(p.message),
      },
      transport,
    );

    assert.strictEqual(result.count, 2);
    assert.strictEqual(pageCalls.length, 2);
    assert.ok(pageCalls[0].includes("offset=0"));
    assert.ok(pageCalls[1].includes("offset=1"));
    assert.ok(progressReports.length >= 2);
  });

  test("syncConfigurationAttributes paginates product families and family attributes", async () => {
    const vscode = createFakeVscode({ config: baseConfig() });
    const transport = async (opts) => {
      // Configuration attributes endpoint
      if (opts.path.includes("/allProductFamilySetups/_allProductFamilies/attributes")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ items: [] }),
        };
      }
      // Product family attributes
      if (opts.path.includes("/productFamilies/fam1/attributes")) {
        if (opts.path.includes("offset=0")) {
          const items = [];
          for (let i = 0; i < 1000; i++) {
            items.push({ variableName: `fam_attr_${i}`, label: `Attr ${i}` });
          }
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ hasMore: true, items }),
          };
        }
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            hasMore: false,
            items: [{ variableName: "fam_attr_1000", label: "Attr 1000" }],
          }),
        };
      }
      // Product families list
      if (opts.path.includes("/allProductFamilySetups")) {
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            items: [{ variableName: "fam1", label: "Family 1" }],
          }),
        };
      }
      return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
    };

    const result = await api.syncConfigurationAttributes(
      fakeContext(),
      vscode,
      { fetchProductFamilies: true, fetchModels: false },
      transport,
    );

    assert.strictEqual(result.productFamilies.length, 1);
    assert.strictEqual(result.attributes.length, 1001);
    assert.strictEqual(result.attributes[0].variableName, "fam_attr_0");
    assert.strictEqual(result.attributes[1000].variableName, "fam_attr_1000");
  });
});
