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

    const cacheDir = path.join(tempDir, ".cpq", "cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "commerce-attributes.json"), JSON.stringify({ attributes: [] }), "utf8");

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
      lookups: {
        transaction: [{ variableName: "mainDocField_t", name: "Main Doc Field" }],
        transactionLine: [{ variableName: "lineItemPrice_l", name: "Line Price" }],
        systemVariables: [{ variableName: "_sys_date", name: "System Date" }],
      },
    };

    commerceAttributes.saveWorkspaceAttributes(tempDir, cacheData);

    // Verify .cpq/cache/lookups files created
    const lookupsDir = path.join(tempDir, ".cpq", "cache", "lookups");
    assert.ok(fs.existsSync(path.join(lookupsDir, "transaction.json")));
    assert.ok(fs.existsSync(path.join(lookupsDir, "transaction-line.json")));
    assert.ok(fs.existsSync(path.join(lookupsDir, "system-variables.json")));

    // Verify name resolution across lookups
    assert.strictEqual(commerceAttributes.resolveAttributeName("Main Doc Field", tempDir), "mainDocField_t");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Line Price", tempDir), "lineItemPrice_l");

    // Verify searchAttributes includes scope and source
    const searchResults = commerceAttributes.searchAttributes("Line Price", tempDir);
    assert.ok(searchResults.length > 0);
    assert.strictEqual(searchResults[0].variableName, "lineItemPrice_l");
    assert.strictEqual(searchResults[0].scope, "Line Item");
    assert.strictEqual(searchResults[0].source, "workspace-cache");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
