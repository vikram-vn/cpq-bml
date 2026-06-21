const assert = require("assert");
const commands = require("../../../app/lang/rest/commands");
const { writePassword, writeAuthToken } = require("../../../app/lang/rest/commands/secrets");
const config = require("../../../app/lang/rest/config");
const { createFakeVscode, createFakeContext } = require("../test-helpers");

suite("BML REST commands - secrets", () => {
  suite("writePassword / writeAuthToken (no-prompt dual-write, used by the settings webview)", () => {
    test("writePassword dual-writes to the site+username-specific key and the legacy global key", async () => {
      const context = createFakeContext();
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com", "connection.username": "alice" },
      });

      await writePassword(context, vscode, "my-pw");

      assert.strictEqual(await context.secrets.get(config.SECRET_PASSWORD), "my-pw");
      assert.strictEqual(
        await context.secrets.get(config.getPasswordSecretKey("https://sitename.oracle.com", "alice")),
        "my-pw",
      );
    });

    test("writeAuthToken dual-writes to the site-specific key and the legacy global key", async () => {
      const context = createFakeContext();
      const vscode = createFakeVscode({
        config: { "connection.siteUrl": "https://sitename.oracle.com" },
      });

      await writeAuthToken(context, vscode, "my-token");

      assert.strictEqual(await context.secrets.get(config.SECRET_TOKEN), "my-token");
      assert.strictEqual(
        await context.secrets.get(config.getTokenSecretKey("https://sitename.oracle.com")),
        "my-token",
      );
    });
  });

  suite("runSetPassword / runSetAuthToken", () => {
    test("runSetPassword stores the entered value as a secret", async () => {
      const context = createFakeContext();
      const vscode = createFakeVscode({
        window: { showInputBox: async () => "my-pw" },
      });

      await commands.runSetPassword(context, vscode);

      assert.strictEqual(
        await context.secrets.get(config.SECRET_PASSWORD),
        "my-pw",
      );
    });

    test("runSetPassword does nothing when the prompt is cancelled", async () => {
      const context = createFakeContext();
      const vscode = createFakeVscode({
        window: { showInputBox: async () => undefined },
      });

      await commands.runSetPassword(context, vscode);

      assert.strictEqual(
        await context.secrets.get(config.SECRET_PASSWORD),
        undefined,
      );
    });

    test("runSetAuthToken stores the entered value as a secret", async () => {
      const context = createFakeContext();
      const vscode = createFakeVscode({
        window: { showInputBox: async () => "my-token" },
      });

      await commands.runSetAuthToken(context, vscode);

      assert.strictEqual(
        await context.secrets.get(config.SECRET_TOKEN),
        "my-token",
      );
    });
  });
});
