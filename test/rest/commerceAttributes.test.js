const assert = require("assert");
const commerceAttributes = require("../../app/lang/rest/commerceAttributes");

suite("commerceAttributes Unit Tests", () => {
  test("resolveAttributeName resolves standard CPQ labels to variable names", () => {
    assert.strictEqual(commerceAttributes.resolveAttributeName("Status"), "status_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("status"), "status_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Quote Status"), "status_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Grand Total"), "totalAmount_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Total Amount"), "totalAmount_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Customer Name"), "_customer_t_company_name");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Transaction ID"), "transactionID_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Created By"), "createdBy_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Date Created"), "createdDate_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Date Modified"), "dateModified_t");
  });

  test("resolveAttributeName keeps existing variable names unchanged", () => {
    assert.strictEqual(commerceAttributes.resolveAttributeName("status_t"), "status_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("totalAmount_t"), "totalAmount_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("customField_c"), "customField_c");
  });

  test("resolveQueryFilter rewrites label keys and preserves operators", () => {
    const input = {
      Status: "Approved",
      "Grand Total": { $gt: 1000 },
    };
    const resolved = commerceAttributes.resolveQueryFilter(input);
    assert.deepStrictEqual(resolved, {
      status_t: "Approved",
      totalAmount_t: { $gt: 1000 },
    });
  });

  test("resolveQueryFilter rewrites nested logical operators ($and, $or)", () => {
    const input = {
      $and: [
        { Status: "Pending" },
        { "Grand Total": { $gte: 500 } },
      ],
    };
    const resolved = commerceAttributes.resolveQueryFilter(input);
    assert.deepStrictEqual(resolved, {
      $and: [
        { status_t: "Pending" },
        { totalAmount_t: { $gte: 500 } },
      ],
    });
  });

  test("resolveQueryFilter rewrites JSON string query inputs", () => {
    const input = JSON.stringify({ Status: "Approved", "Grand Total": { $gt: 1000 } });
    const resolvedStr = commerceAttributes.resolveQueryFilter(input);
    const resolvedObj = JSON.parse(resolvedStr);
    assert.strictEqual(resolvedObj.status_t, "Approved");
    assert.strictEqual(resolvedObj.totalAmount_t.$gt, 1000);
  });

  test("isCommerceSynced correctly checks for existence of cache file", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-synced-test-"));
    assert.strictEqual(commerceAttributes.isCommerceSynced(tempDir), false);

    const cpqDir = path.join(tempDir, ".cpq");
    fs.mkdirSync(cpqDir, { recursive: true });
    fs.writeFileSync(path.join(cpqDir, "commerce.attributes.min.json"), JSON.stringify({ items: [] }), "utf8");

    assert.strictEqual(commerceAttributes.isCommerceSynced(tempDir), true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("loadWorkspaceAttributes indexes attributes and systemAttributes", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-ws-idx-test-"));
    const cacheData = {
      attributes: [{ variableName: "customAttr_t", name: "Custom Attr" }],
      systemAttributes: [{ variableName: "customer_t", name: "Customer" }],
    };

    commerceAttributes.saveWorkspaceAttributes(tempDir, cacheData);

    assert.strictEqual(commerceAttributes.resolveAttributeName("Customer", tempDir), "customer_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Custom Attr", tempDir), "customAttr_t");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("normalizeAttributeDataType handles string, object, and primitive types", () => {
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType("String"), "String");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType("Single Select Menu"), "Single Select Menu");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType({ value: 1, displayValue: "Single Select Menu" }), "Single Select Menu");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType({ displayLabel: "Currency" }), "Currency");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType({ name: "Date" }), "Date");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType({ value: 5 }), "5");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType(null), "String");
    assert.strictEqual(commerceAttributes.normalizeAttributeDataType(undefined), "String");
  });

  test("saveWorkspaceAttributes writes lookups directory and loadWorkspaceAttributes indexes lookups with scopes", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-lookups-test-"));
    const cacheData = {
      attributes: [{ variableName: "status_t", name: "Status" }],
      systemAttributes: [{ variableName: "_sys_user", name: "System User" }],
      arraySets: [{ variableName: "lineItems_set", name: "Line Items" }],
      configAttributes: [{ variableName: "_config_memory_size", name: "Memory Size", scope: "Configuration" }],
      models: [{ variableName: "serverModelA", name: "Server Model A", label: "Server Model A" }],
      lookups: {
        transaction: [{ variableName: "mainDocField_t", name: "Main Doc Field" }],
        transactionLine: [{ variableName: "lineItemPrice_l", name: "Line Price" }],
        systemVariables: [{ variableName: "_sys_date", name: "System Date" }],
      },
    };

    commerceAttributes.saveWorkspaceAttributes(tempDir, cacheData);

    // Verify README.md file created in .cpq/
    const cpqDir = path.join(tempDir, ".cpq");

    assert.ok(fs.existsSync(path.join(cpqDir, "README.md")));
    const cpqReadme = fs.readFileSync(path.join(cpqDir, "README.md"), "utf8");
    assert.ok(cpqReadme.includes("DO NOT REMOVE"));
    assert.ok(cpqReadme.includes("MCP"));
    assert.ok(cpqReadme.includes("IntelliSense (preferred)"));
    assert.ok(cpqReadme.includes("commerce.attributes.min.json"));
    assert.ok(cpqReadme.includes("config.attributes.min.json"));
    assert.ok(cpqReadme.includes("system.attributes.min.json"));

    // Verify flat minified files created directly in .cpq/
    assert.ok(fs.existsSync(path.join(cpqDir, "commerce.attributes.min.json")));
    assert.ok(fs.existsSync(path.join(cpqDir, "system.attributes.min.json")));
    assert.ok(fs.existsSync(path.join(cpqDir, "config.attributes.min.json")));

    // Verify obsolete subfolders do NOT exist
    assert.ok(!fs.existsSync(path.join(cpqDir, "commerce")), "commerce folder must NOT exist");
    assert.ok(!fs.existsSync(path.join(cpqDir, "system")), "system folder must NOT exist");
    assert.ok(!fs.existsSync(path.join(cpqDir, "config")), "config folder must NOT exist");
    assert.ok(!fs.existsSync(path.join(cpqDir, "cache")), "cache folder must NOT exist");

    const configJson = JSON.parse(fs.readFileSync(path.join(cpqDir, "config.attributes.min.json"), "utf8"));
    assert.ok(Array.isArray(configJson.models), "models should be embedded in config.attributes.min.json");
    assert.strictEqual(configJson.models[0].variableName, "serverModelA");

    // Verify STRICTLY ONLY .min.json files exist (no unminified .json)
    const files = fs.readdirSync(cpqDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        assert.ok(file.endsWith(".min.json"), `File ${file} should end with .min.json`);
      }
    }

    // Verify name resolution across lookups, array sets, models, and configuration
    assert.strictEqual(commerceAttributes.resolveAttributeName("Main Doc Field", tempDir), "mainDocField_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Line Price", tempDir), "lineItemPrice_l");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Line Items", tempDir), "lineItems_set");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Memory Size", tempDir), "_config_memory_size");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Server Model A", tempDir), "serverModelA");

    // Verify searchAttributes includes scope and source
    const searchResults = commerceAttributes.searchAttributes("Line Price", tempDir);
    assert.ok(searchResults.length > 0);
    assert.strictEqual(searchResults[0].variableName, "lineItemPrice_l");
    assert.strictEqual(searchResults[0].scope, "Line Item");
    assert.strictEqual(searchResults[0].source, "workspace-cache");

    const configResults = commerceAttributes.searchAttributes("Memory Size", tempDir);
    assert.ok(configResults.length > 0);
    assert.strictEqual(configResults[0].variableName, "_config_memory_size");
    assert.strictEqual(configResults[0].scope, "Configuration");
    assert.strictEqual(searchResults[0].source, "workspace-cache");

    const modelResults = commerceAttributes.searchAttributes("Server Model A", tempDir);
    assert.ok(modelResults.length > 0);
    assert.strictEqual(modelResults[0].variableName, "serverModelA");
    assert.strictEqual(modelResults[0].scope, "Model");
    assert.strictEqual(modelResults[0].source, "workspace-cache");

    const arrayResults = commerceAttributes.searchAttributes("Line Items", tempDir);
    assert.ok(arrayResults.length > 0);
    assert.strictEqual(arrayResults[0].variableName, "lineItems_set");
    assert.strictEqual(arrayResults[0].scope, "Array Set");
    assert.strictEqual(arrayResults[0].source, "workspace-cache");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("apiData prefers user .cpq cache attributes over bundled JSON fallback", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const { loadApiData, invalidateApiData, lookupApiInfo } = require("../../app/lang/intellisense/apiData");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-pref-test-"));
    const cacheData = {
      attributes: [
        {
          variableName: "status_t",
          label: "Instance Specific Status",
          dataType: "Single Select Menu",
          description: "Overridden from instance",
          menuOptions: [
            { displayValue: "Under Review", value: "under_review" },
          ],
        },
        {
          variableName: "customTenantField_t",
          label: "Custom Tenant Field",
          dataType: "String",
          description: "Exists only in instance",
        },
      ],
      arraySets: [
        {
          variableName: "myArraySet_set",
          label: "My Custom Array Set",
          description: "Instance array set",
        },
      ],
    };

    commerceAttributes.saveWorkspaceAttributes(tempDir, cacheData);

    const fakeVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
      },
    };

    invalidateApiData();
    try {
      const data = loadApiData({ workspaceRoot: tempDir });
      assert.ok(data["status_t"]);
      assert.strictEqual(data["status_t"].description, "Overridden from instance");
      assert.strictEqual(data["status_t"].label, "Instance Specific Status");
      assert.ok(data["myarrayset_set"]);
      assert.strictEqual(data["myarrayset_set"].scope, "Array Set");
      assert.ok(data["customtenantfield_t"]);
      assert.strictEqual(data["customtenantfield_t"].description, "Exists only in instance");

      // Verify that bundled items (like atof) still exist as fallback
      assert.ok(data["atof"]);
    } finally {
      invalidateApiData();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("config.js relies strictly on VS Code settings and keeps connection settings out of .cpq/config", async () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const configLib = require("../../app/lang/rest/config");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-config-test-"));
    const updated = {};
    const fakeVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (key, defaultVal) => (key === "connection.siteUrl" ? "https://myinstance.bigmachines.com" : defaultVal),
          update: async (key, val) => {
            updated[key] = val;
          },
        }),
      },
    };

    await configLib.saveWorkspaceConfig(fakeVscode, {
      siteUrl: "https://updated.bigmachines.com",
      username: "admin_user",
    });

    assert.strictEqual(updated["connection.siteUrl"], "https://updated.bigmachines.com");
    assert.strictEqual(updated["connection.username"], "admin_user");

    const configFilePath = path.join(tempDir, ".cpq", "config", "config.min.json");
    assert.ok(!fs.existsSync(configFilePath), "config.min.json must NOT exist in .cpq/config");

    const settings = configLib.getSettings(fakeVscode);
    assert.strictEqual(settings.siteUrl, "https://myinstance.bigmachines.com");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("removeMetadata removes .cpq folder, clears caches, and updates context", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const { removeMetadata, isCommerceSynced } = require("../../app/lang/rest/commerceAttributes");
    const { saveWorkspaceAttributes } = require("../../app/lang/rest/commerceAttributesWriter");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-remove-meta-test-"));
    const cpqDir = path.join(tempDir, ".cpq");
    try {
      saveWorkspaceAttributes(tempDir, {
        attributes: [{ variableName: "testAttr_t", label: "Test Attr", dataType: "String" }],
      });
      assert.ok(fs.existsSync(path.join(cpqDir, "commerce.attributes.min.json")));
      assert.strictEqual(isCommerceSynced(tempDir), true);

      let contextSet = false;
      const fakeVscode = {
        workspace: { workspaceFolders: [{ uri: { fsPath: tempDir } }] },
        commands: {
          executeCommand: (cmd, key, val) => {
            if (cmd === "setContext" && key === "cpqBml.commerceMetadataSynced" && val === false) {
              contextSet = true;
            }
          },
        },
      };

      removeMetadata(null, tempDir, fakeVscode);

      assert.strictEqual(fs.existsSync(cpqDir), false, ".cpq directory should be completely deleted");
      assert.strictEqual(isCommerceSynced(tempDir), false);
      assert.strictEqual(contextSet, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
