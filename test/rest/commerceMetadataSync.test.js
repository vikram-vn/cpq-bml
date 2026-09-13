const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const configLib = require("@/lang/rest/config");
const {
  removeMetadata,
  isCommerceSynced,
} = require("@/lang/rest/commerceAttributes");
const {
  saveWorkspaceAttributes,
} = require("@/lang/rest/commerceAttributesWriter");

suite("Commerce Metadata & Config Sync Unit Tests", () => {
  test("config.js relies strictly on VS Code settings and keeps connection settings out of cpq/config", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-config-test-"));
    const updated = {};
    const fakeVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (key, defaultVal) =>
            key === "connection.siteUrl"
              ? "https://myinstance.bigmachines.com"
              : defaultVal,
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

    assert.strictEqual(
      updated["connection.siteUrl"],
      "https://updated.bigmachines.com",
    );
    assert.strictEqual(updated["connection.username"], "admin_user");

    const configFilePath = path.join(
      tempDir,
      "cpq",
      "config",
      "config.min.json",
    );
    assert.ok(
      !fs.existsSync(configFilePath),
      "config.min.json must NOT exist in cpq/config",
    );

    const settings = configLib.getSettings(fakeVscode);
    assert.strictEqual(settings.siteUrl, "https://myinstance.bigmachines.com");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("removeMetadata removes cpq folder, clears caches, and updates context", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "cpq-remove-meta-test-"),
    );
    const cpqDir = path.join(tempDir, "cpq");
    try {
      saveWorkspaceAttributes(tempDir, {
        attributes: [
          {
            variableName: "testAttr_t",
            label: "Test Attr",
            dataType: "String",
          },
        ],
      });
      assert.ok(
        fs.existsSync(path.join(cpqDir, "commerce", "oraclecpqo", "attributes.min.json")),
      );
      assert.strictEqual(isCommerceSynced(tempDir), true);

      let contextSet = false;
      const fakeVscode = {
        workspace: { workspaceFolders: [{ uri: { fsPath: tempDir } }] },
        commands: {
          executeCommand: (cmd, key, val) => {
            if (
              cmd === "setContext" &&
              key === "cpqBml.commerceMetadataSynced" &&
              val === false
            ) {
              contextSet = true;
            }
          },
        },
      };

      removeMetadata(null, tempDir, fakeVscode);

      assert.strictEqual(
        fs.existsSync(cpqDir),
        false,
        "cpq directory should be completely deleted",
      );
      assert.strictEqual(isCommerceSynced(tempDir), false);
      assert.strictEqual(contextSet, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
