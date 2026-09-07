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

  test("loadWorkspaceAttributes indexes arraySets, actionDefs, and systemAttributes", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-ws-idx-test-"));
    const cacheData = {
      attributes: [{ variableName: "customAttr_t", name: "Custom Attr" }],
      arraySets: [{ variableName: "lineItems", name: "Line Items" }],
      actionDefs: [{ variableName: "submitQuote", name: "Submit Quote" }],
      systemAttributes: [{ variableName: "_transaction_id", name: "Transaction ID" }],
    };

    commerceAttributes.saveWorkspaceAttributes(tempDir, cacheData);

    assert.strictEqual(commerceAttributes.resolveAttributeName("Line Items", tempDir), "lineItems");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Submit Quote", tempDir), "submitQuote");
    assert.strictEqual(commerceAttributes.resolveAttributeName("Custom Attr", tempDir), "customAttr_t");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
