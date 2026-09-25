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

  test("removeMetadata removes cached attributes, preserves user /cpq data, clears caches, and updates context", () => {
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
      const metaAttrPath = path.join(cpqDir, "commerce", "oraclecpqo", "attributes.min.json");
      assert.ok(fs.existsSync(metaAttrPath));
      assert.strictEqual(isCommerceSynced(tempDir), true);

      // Add custom user file inside /cpq
      const userScriptPath = path.join(cpqDir, "customScript.bml");
      fs.writeFileSync(userScriptPath, "// important user CPQ code");

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

      // Metadata attribute cache is removed:
      assert.strictEqual(fs.existsSync(metaAttrPath), false, "attributes.min.json should be removed");
      assert.strictEqual(isCommerceSynced(tempDir), false);
      assert.strictEqual(contextSet, true);

      // /cpq directory and user data must NOT be removed:
      assert.strictEqual(fs.existsSync(cpqDir), true, "cpq directory must not be removed");
      assert.strictEqual(fs.existsSync(userScriptPath), true, "user file in cpq must not be removed");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
