const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const metadata = require("../../app/lang/rest/metadata");

// A realistic "Get a Util Library Function" response, per Oracle's docs.
const SAMPLE_RESPONSE = {
  name: "ConcatString",
  variableName: "concatString",
  description: "Concatenates two strings.",
  folderName: "util",
  scriptText: 'return stringOne + " " + stringTwo;',
  testScript: "",
  useTestScript: false,
  returnType: { value: 1, displayValue: "String" },
  parameters: [
    { name: "stringOne", dataType: { value: 2, displayValue: "String" } },
    { name: "stringTwo", dataType: { value: 2, displayValue: "String" } },
  ],
  libraryFunctions: [],
  attributes: [],
  links: [
    {
      rel: "self",
      href: "https://sitename.bigmachines.com/cpq/rest/v18/bml/library/functions/concatString",
    },
  ],
  referencesUrl: "/admin/bmllib/list_rules.jsp?id=1",
  isReferred: false,
  isLocked: false,
  isOverridden: false,
};

suite("BML REST metadata", () => {
  test("bmlPathToMetaPath swaps the .bml extension for -meta.json", () => {
    assert.strictEqual(
      metadata.bmlPathToMetaPath("/ws/library/util/concatString.bml"),
      "/ws/library/util/concatString-meta.json",
    );
  });

  test("variableNameFromBmlPath takes the basename regardless of folder", () => {
    assert.strictEqual(
      metadata.variableNameFromBmlPath("/ws/someFolder/allUpdate.bml"),
      "allUpdate",
    );
    assert.strictEqual(metadata.variableNameFromBmlPath("allUpdate.BML"), "allUpdate");
  });

  test("namespaceOf returns namespace if present, otherwise empty string", () => {
    assert.strictEqual(metadata.namespaceOf({ folderName: "util" }), "");
    assert.strictEqual(
      metadata.namespaceOf({ namespace: "custom", folderName: "util" }),
      "custom",
    );
  });

  test("namespaceVariableNameFor composes namespace.variableName, or just variableName with no namespace", () => {
    assert.strictEqual(
      metadata.namespaceVariableNameFor({
        folderName: "util",
        variableName: "concatString",
      }),
      "concatString",
    );
    assert.strictEqual(
      metadata.namespaceVariableNameFor({
        namespace: "custom",
        folderName: "util",
        variableName: "concatString",
      }),
      "custom.concatString",
    );
    assert.strictEqual(
      metadata.namespaceVariableNameFor({ variableName: "concatString" }),
      "concatString",
    );
  });

  test("splitFunctionResponse separates scriptText from metadata and drops server-only fields", () => {
    const { scriptText, metadata: meta } =
      metadata.splitFunctionResponse(SAMPLE_RESPONSE);
    assert.strictEqual(scriptText, SAMPLE_RESPONSE.scriptText);
    assert.strictEqual(meta.variableName, "concatString");
    assert.strictEqual(meta.links, undefined);
    assert.strictEqual(meta.referencesUrl, undefined);
    assert.strictEqual(meta.scriptText, undefined);
  });

  test("buildFunctionPayload reconstructs the full object shape needed by validate/update/debug, using a NEW scriptText", () => {
    const { metadata: meta } = metadata.splitFunctionResponse(SAMPLE_RESPONSE);
    const payload = metadata.buildFunctionPayload(meta, 'return "edited";');

    assert.deepStrictEqual(payload, {
      variableName: "concatString",
      name: "ConcatString",
      description: "Concatenates two strings.",
      returnType: { value: 1, displayValue: "String" },
      parameters: SAMPLE_RESPONSE.parameters,
      scriptText: 'return "edited";',
      testScript: "",
      useTestScript: false,
      libraryFunctions: [],
      attributes: [],
    });
  });

  test("buildFunctionPayload normalizes attributes array", () => {
    const meta = {
      variableName: "func",
      attributes: ["_company_name", { name: "other" }]
    };
    const payload = metadata.buildFunctionPayload(meta, 'return "";');
    assert.deepStrictEqual(payload.attributes, [
      { name: "_company_name" },
      { name: "other" }
    ]);
  });

  test("buildDebugPayload merges parameter values into the parameters array", () => {
    const { metadata: meta } = metadata.splitFunctionResponse(SAMPLE_RESPONSE);
    const payload = metadata.buildDebugPayload(
      meta,
      SAMPLE_RESPONSE.scriptText,
      {
        stringOne: "hello",
        stringTwo: "world",
      },
    );

    assert.deepStrictEqual(payload.parameters, [
      {
        name: "stringOne",
        dataType: { value: 2, displayValue: "String" },
        value: "hello",
      },
      {
        name: "stringTwo",
        dataType: { value: 2, displayValue: "String" },
        value: "world",
      },
    ]);
  });

  test("buildDebugPayload removes commas from scalar numeric inputs but not others", () => {
    const meta = {
      variableName: "testFunc",
      parameters: [
        { name: "num1", dataType: { value: 6, displayValue: "Integer" } },
        { name: "num2", dataType: { value: 4, displayValue: "Float" } },
        { name: "arr", dataType: { value: 7, displayValue: "Integer[]" } },
        { name: "str", dataType: { value: 2, displayValue: "String" } }
      ]
    };
    const payload = metadata.buildDebugPayload(
      meta,
      "",
      {
        num1: "1,234",
        num2: "78,3243.093",
        arr: "1,234,567",
        str: "1,234"
      }
    );

    assert.deepStrictEqual(payload.parameters, [
      {
        name: "num1",
        dataType: { value: 6, displayValue: "Integer" },
        value: "1234",
      },
      {
        name: "num2",
        dataType: { value: 4, displayValue: "Float" },
        value: "783243.093",
      },
      {
        name: "arr",
        dataType: { value: 7, displayValue: "Integer[]" },
        value: "1,234,567",
      },
      {
        name: "str",
        dataType: { value: 2, displayValue: "String" },
        value: "1,234",
      },
    ]);
  });

  test("buildDeployItem identifies the function by namespace + type + variableName", () => {
    const { metadata: meta } = metadata.splitFunctionResponse(SAMPLE_RESPONSE);
    assert.deepStrictEqual(metadata.buildDeployItem(meta), {
      namespace: "",
      type: "util",
      variableName: "concatString",
    });
  });

  test("writeBmlFile + writeMetadata + readMetadata round-trip through real files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rest-test-"));
    try {
      const bmlPath = path.join(tmpDir, "util", "concatString.bml");
      const metaPath = metadata.bmlPathToMetaPath(bmlPath);
      const { scriptText, metadata: meta } =
        metadata.splitFunctionResponse(SAMPLE_RESPONSE);

      metadata.writeBmlFile(bmlPath, scriptText);
      metadata.writeMetadata(metaPath, meta);

      assert.strictEqual(fs.readFileSync(bmlPath, "utf8"), scriptText);
      assert.deepStrictEqual(metadata.readMetadata(metaPath), meta);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("readMetadata returns null when no sidecar file exists yet", () => {
    assert.strictEqual(
      metadata.readMetadata("/does/not/exist.meta.json"),
      null,
    );
  });

  test("buildFunctionPayload normalizes string returnType and parameter dataType, and includes commerce fields", () => {
    const rawMetadata = {
      variableName: "allUpdate",
      name: "All Update",
      description: "Desc",
      returnType: "String",
      parameters: [
        { name: "param1", dataType: "String" }
      ],
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
      systemAttributes: [{ name: "sysAttr" }],
      mainDocAttributes: [],
      subDocAttributes: []
    };

    const payload = metadata.buildFunctionPayload(rawMetadata, "return \"\";");

    assert.deepStrictEqual(payload.returnType, { value: 1, displayValue: "String" });
    assert.deepStrictEqual(payload.parameters, [
      { name: "param1", dataType: { value: 2, displayValue: "String" } }
    ]);
    assert.strictEqual(payload.commerceProcess, "oraclecpqo");
    assert.strictEqual(payload.commerceDocument, "transaction");
    assert.deepStrictEqual(payload.systemAttributes, [{ name: "sysAttr" }]);
  });

  test("buildFunctionPayload omits mainDocAttributes/subDocAttributes/attributes/testScript/libraryFunctions for a commerce function whose own Get-one response never had them", () => {
    // Confirmed live against a real CPQ instance: a standard commerce function
    // like "currentStep" that has no sub-document scope returns a Get-one
    // response with only systemAttributes set (no mainDocAttributes,
    // subDocAttributes, attributes, testScript, or libraryFunctions keys at
    // all). Sending any of those back as a default [] / '' on PATCH gets
    // rejected - either with a generic "Invalid payload." (attributes,
    // testScript) or a field-specific "Field subDocAttributes is not
    // editable." So commerce payloads must mirror exactly what was pulled,
    // field for field, rather than defaulting any of them in.
    const rawMetadata = {
      variableName: "currentStep",
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
      useTestScript: false,
      systemAttributes: [{ name: "_system_current_step_var" }]
    };

    const payload = metadata.buildFunctionPayload(rawMetadata, "return \"\";");

    assert.deepStrictEqual(payload.systemAttributes, [{ name: "_system_current_step_var" }]);
    assert.strictEqual("mainDocAttributes" in payload, false);
    assert.strictEqual("subDocAttributes" in payload, false);
    assert.strictEqual("attributes" in payload, false);
    assert.strictEqual("testScript" in payload, false);
    assert.strictEqual("libraryFunctions" in payload, false);
  });

  test("buildFunctionPayload includes a commerce function's attribute/library fields when they were present locally", () => {
    const rawMetadata = {
      variableName: "test",
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction",
      useTestScript: false,
      libraryFunctions: [{ variableName: "currentStep", type: "COMMERCE" }],
      systemAttributes: [],
      mainDocAttributes: [],
      subDocAttributes: []
    };

    const payload = metadata.buildFunctionPayload(rawMetadata, "return \"\";");

    assert.deepStrictEqual(payload.libraryFunctions, [{ variableName: "currentStep", type: "COMMERCE" }]);
    assert.deepStrictEqual(payload.systemAttributes, []);
    assert.deepStrictEqual(payload.mainDocAttributes, []);
    assert.deepStrictEqual(payload.subDocAttributes, []);
    assert.strictEqual("attributes" in payload, false);
    assert.strictEqual("testScript" in payload, false);
  });

  test("buildFunctionPayload omits systemAttributes/mainDocAttributes/subDocAttributes entirely for util functions", () => {
    const rawMetadata = { variableName: "concatString" };

    const payload = metadata.buildFunctionPayload(rawMetadata, "return \"\";");

    assert.strictEqual("systemAttributes" in payload, false);
    assert.strictEqual("mainDocAttributes" in payload, false);
    assert.strictEqual("subDocAttributes" in payload, false);
  });

  test("buildFunctionPayload normalizes parameter with type fallback instead of dataType", () => {
    const rawMetadata = {
      variableName: "allUpdate",
      name: "All Update",
      description: "Desc",
      returnType: "String",
      parameters: [
        { name: "direction", type: "String" }
      ]
    };

    const payload = metadata.buildFunctionPayload(rawMetadata, "return \"\";");

    assert.deepStrictEqual(payload.parameters, [
      { name: "direction", dataType: { value: 2, displayValue: "String" } }
    ]);
  });

  test("inferCommerceFromPath extracts commerceProcess and commerceDocument from standard path", () => {
    const filePath = "/workspace/bml/oraclecpqo/transaction/libraries/currentStep/currentStep.bml";
    const result = metadata.inferCommerceFromPath(filePath);
    assert.deepStrictEqual(result, {
      commerceProcess: "oraclecpqo",
      commerceDocument: "transaction"
    });
  });

  test("inferCommerceFromPath returns null for utility functions", () => {
    const filePath = "/workspace/bml/bmlLibrary/abo_initializeContext/abo_initializeContext.bml";
    const result = metadata.inferCommerceFromPath(filePath);
    assert.strictEqual(result, null);
  });

  test("normalizeLibraryFunctions parses raw dependency strings into CPQ-compliant objects", () => {
    const rawDeps = [
      "commerce._s_generateRateCardHTML",
      "commerce.calculateContractPeriods",
      "util.ORCL_ABO.abo_dateTimeConverter",
      { variableName: "alreadyAnObject", type: "COMMERCE" }
    ];

    const normalized = metadata.normalizeLibraryFunctions(rawDeps);

    assert.deepStrictEqual(normalized, [
      { variableName: "_s_generateRateCardHTML", type: "COMMERCE" },
      { variableName: "calculateContractPeriods", type: "COMMERCE" },
      { variableName: "abo_dateTimeConverter", type: "UTIL_LIBRARY", folderName: "ORCL_ABO" },
      { variableName: "alreadyAnObject", type: "COMMERCE" }
    ]);
  });

  test("readMetadata returns null and does not throw when the sidecar file contains corrupted JSON", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rest-test-corrupt-"));
    try {
      const corruptMetaPath = path.join(tmpDir, "corrupted-meta.json");
      fs.writeFileSync(corruptMetaPath, "{ invalid json: }", "utf8");

      const result = metadata.readMetadata(corruptMetaPath);
      assert.strictEqual(result, null, "Should return null on corrupted JSON rather than throwing");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
