const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createFakeVscode, createFakeContext } = require("@/test/rest/testHelpers");
const { refreshBmlStatus, triggerSmartMetadataFetch, runSaveCurrentFile } = require("@/lang/rest/commands");
const metadataLib = require("@/lang/rest/metadata");
const config = require("@/lang/rest/config");
const { withTempDir, SAMPLE_FUNCTION, baseVscodeConfig, fakeResultsTerminal } = require("@/test/rest/commands/fixtures");

suite("BML REST commands - deployment context keys", () => {
  test("sets activeFileIsCommerce=true and activeFileIsUtil=false for a commerce library file", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(
        tmpDir,
        "oraclecpqo",
        "transaction",
        "libraries",
        "calcTax",
        "calcTax.bml",
      );
      const metaPath = path.join(
        tmpDir,
        "oraclecpqo",
        "transaction",
        "libraries",
        "calcTax",
        "calcTax-meta.json",
      );
      fs.mkdirSync(path.dirname(bmlPath), { recursive: true });
      fs.writeFileSync(bmlPath, "return 0.0;", "utf8");
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          variableName: "calcTax",
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
        }),
        "utf8",
      );

      const calls = [];
      const vscode = createFakeVscode({
        commands: { executeCommand: async (...args) => calls.push(args) },
      });
      const statusBarItem = { text: "", tooltip: "", show: () => {}, hide: () => {} };

      refreshBmlStatus(vscode, statusBarItem, bmlPath);

      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsCommerce" &&
            c[2] === true,
        ),
        "should set cpqBml.activeFileIsCommerce to true",
      );
      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsUtil" &&
            c[2] === false,
        ),
        "should set cpqBml.activeFileIsUtil to false",
      );
    }));

  test("sets activeFileIsCommerce=true even without sidecar when inferred from commerce path", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(
        tmpDir,
        "oraclecpqo",
        "transaction",
        "libraries",
        "calcTax",
        "calcTax.bml",
      );
      fs.mkdirSync(path.dirname(bmlPath), { recursive: true });
      fs.writeFileSync(bmlPath, "return 0.0;", "utf8");

      const calls = [];
      const vscode = createFakeVscode({
        commands: { executeCommand: async (...args) => calls.push(args) },
      });
      const statusBarItem = { text: "", tooltip: "", show: () => {}, hide: () => {} };

      refreshBmlStatus(vscode, statusBarItem, bmlPath);

      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsCommerce" &&
            c[2] === true,
        ),
      );
      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsUtil" &&
            c[2] === false,
        ),
      );
    }));

  test("sets activeFileIsUtil=true and activeFileIsCommerce=false for a util library file", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(
        tmpDir,
        "library",
        "pricing",
        "calcDiscount",
        "calcDiscount.bml",
      );
      const metaPath = path.join(
        tmpDir,
        "library",
        "pricing",
        "calcDiscount",
        "calcDiscount-meta.json",
      );
      fs.mkdirSync(path.dirname(bmlPath), { recursive: true });
      fs.writeFileSync(bmlPath, 'return "";', "utf8");
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          variableName: "calcDiscount",
          folderName: "pricing",
        }),
        "utf8",
      );

      const calls = [];
      const vscode = createFakeVscode({
        commands: { executeCommand: async (...args) => calls.push(args) },
      });
      const statusBarItem = { text: "", tooltip: "", show: () => {}, hide: () => {} };

      refreshBmlStatus(vscode, statusBarItem, bmlPath);

      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsCommerce" &&
            c[2] === false,
        ),
        "should set cpqBml.activeFileIsCommerce to false",
      );
      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsUtil" &&
            c[2] === true,
        ),
        "should set cpqBml.activeFileIsUtil to true",
      );
    }));

  test("sets both context keys to false when opening a non-BML file", () => {
    const calls = [];
    const vscode = createFakeVscode({
      commands: { executeCommand: async (...args) => calls.push(args) },
    });
    const statusBarItem = { text: "", tooltip: "", show: () => {}, hide: () => {} };

    refreshBmlStatus(vscode, statusBarItem, "/some/path/file.js");

    assert.ok(
      calls.some(
        (c) =>
          c[0] === "setContext" &&
          c[1] === "cpqBml.activeFileIsCommerce" &&
          c[2] === false,
      ),
    );
    assert.ok(
      calls.some(
        (c) =>
          c[0] === "setContext" &&
          c[1] === "cpqBml.activeFileIsUtil" &&
          c[2] === false,
      ),
    );
  });

  test("triggerSmartMetadataFetch finds -meta.json in workspace and updates context to commerce", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "work", "pricingMaintenanceNewBusiness_c.bml");
      const pulledMetaPath = path.join(tmpDir, "oraclecpqo", "transaction", "libraries", "pricingMaintenanceNewBusiness_c", "pricingMaintenanceNewBusiness_c-meta.json");
      fs.mkdirSync(path.dirname(bmlPath), { recursive: true });
      fs.mkdirSync(path.dirname(pulledMetaPath), { recursive: true });
      fs.writeFileSync(bmlPath, "return true;", "utf8");
      fs.writeFileSync(
        pulledMetaPath,
        JSON.stringify({
          variableName: "pricingMaintenanceNewBusiness_c",
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
        }),
        "utf8",
      );

      const calls = [];
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => "return true;",
        },
      };
      const vscode = createFakeVscode({
        commands: { executeCommand: async (...args) => calls.push(args) },
        window: { activeTextEditor: editor },
        workspace: {
          findFiles: async () => [{ fsPath: pulledMetaPath }],
        },
      });
      const statusBarItem = { text: "", tooltip: "", show: () => {}, hide: () => {} };

      await triggerSmartMetadataFetch(null, vscode, statusBarItem, bmlPath);

      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsCommerce" &&
            c[2] === true,
        ),
        "should set activeFileIsCommerce to true after smart metadata fetch",
      );
      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsUtil" &&
            c[2] === false,
        ),
        "should set activeFileIsUtil to false after smart metadata fetch",
      );
      // Verify sidecar was written next to bml file
      const expectedSidecar = path.join(tmpDir, "work", "pricingMaintenanceNewBusiness_c-meta.json");
      assert.ok(fs.existsSync(expectedSidecar), "sidecar should be written next to the bml file");
    }));

  test("triggerSmartMetadataFetch queries CPQ API and updates context to commerce when matched", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "work", "pricingMaintenanceNewBusiness_c.bml");
      fs.mkdirSync(path.dirname(bmlPath), { recursive: true });
      fs.writeFileSync(bmlPath, "return true;", "utf8");

      const calls = [];
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => "return true;",
        },
      };
      const vscode = createFakeVscode({
        config: {
          ...baseVscodeConfig(),
          "cpqBml.connection.siteUrl": "example",
          "cpqBml.connection.username": "testuser",
        },
        commands: { executeCommand: async (...args) => calls.push(args) },
        window: { activeTextEditor: editor },
        workspace: {
          findFiles: async () => [],
        },
      });
      const context = createFakeContext();
      await context.secrets.store(config.SECRET_PASSWORD, "pass");

      const transport = async (opts) => {
        if (opts.path.includes("/commerceProcessSetups/oraclecpqo/documents/transaction/bml/library/functions")) {
          if (opts.method === "GET" && !opts.path.endsWith("pricingMaintenanceNewBusiness_c")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                items: [{ variableName: "pricingMaintenanceNewBusiness_c", name: "Pricing Maint" }],
              }),
            };
          }
          if (opts.method === "GET" && opts.path.endsWith("pricingMaintenanceNewBusiness_c")) {
            return {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              text: JSON.stringify({
                variableName: "pricingMaintenanceNewBusiness_c",
                name: "Pricing Maint",
                scriptText: "return true;",
              }),
            };
          }
        }
        return { statusCode: 404, headers: {}, text: "{}" };
      };

      const statusBarItem = { text: "", tooltip: "", show: () => {}, hide: () => {} };

      await triggerSmartMetadataFetch(context, vscode, statusBarItem, bmlPath, { transport });

      assert.ok(
        calls.some(
          (c) =>
            c[0] === "setContext" &&
            c[1] === "cpqBml.activeFileIsCommerce" &&
            c[2] === true,
        ),
        "should set activeFileIsCommerce to true after remote API discovery",
      );
      const expectedSidecar = path.join(tmpDir, "work", "pricingMaintenanceNewBusiness_c-meta.json");
      assert.ok(fs.existsSync(expectedSidecar), "sidecar should be written from remote CPQ discovery");
    }));

  test("runSaveCurrentFile invokes cpqBml.internal.refreshStatus immediately", () =>
    withTempDir(async (tmpDir) => {
      const bmlPath = path.join(tmpDir, "concatString.bml");
      metadataLib.writeMetadata(
        metadataLib.bmlPathToMetaPath(bmlPath),
        metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
      );
      const editor = {
        document: {
          languageId: "bml",
          uri: { fsPath: bmlPath },
          getText: () => "return 1;",
        },
      };

      const calls = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        commands: { executeCommand: async (...args) => calls.push(args) },
        window: {
          showInformationMessage: () => {},
          activeTextEditor: editor,
        },
      });

      const context = createFakeContext();
      await context.secrets.store(config.SECRET_PASSWORD, "pass");
      const transport = async () => ({ statusCode: 200, headers: {}, text: "" });

      await runSaveCurrentFile(context, vscode, fakeResultsTerminal(), { transport });

      assert.ok(
        calls.some((c) => c[0] === "cpqBml.internal.refreshStatus"),
        "should trigger internal.refreshStatus on save",
      );
    }));
});

