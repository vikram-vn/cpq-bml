const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createFakeVscode } = require("../testHelpers");
const { refreshBmlStatus } = require("../../../app/lang/rest/commands");
const { withTempDir } = require("./fixtures");

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
});
