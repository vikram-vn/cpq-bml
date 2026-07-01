const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { runDownloadLogFile } = require("../../../app/lang/rest/commands/logs");
const { createFakeVscode } = require("../testHelpers");
const { baseVscodeConfig, makeContext, withTempDir } = require("./fixtures");

suite("BML REST commands - download logs", () => {
  test("successfully downloads bm.log and saves/opens it", () =>
    withTempDir(async (tmpDir) => {
      const tempFilePath = path.join(tmpDir, "downloaded_bm.log");
      const prompts = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showQuickPick: async (items) => items[0], // selects "bm.log"
          showSaveDialog: async () => ({ fsPath: tempFilePath }),
          showTextDocument: async () => {},
          showInformationMessage: (msg) => prompts.push(msg),
          withProgress: async (options, task) => task(),
        },
      });
      vscode.ProgressLocation = { Notification: 15 };

      vscode.workspace.fs = {
        writeFile: async (uri, data) => {
          fs.writeFileSync(uri.fsPath, data);
        },
      };
      vscode.workspace.openTextDocument = async (uri) => {
        assert.strictEqual(uri.fsPath, tempFilePath);
        return {};
      };
      vscode.Uri = {
        file: (p) => ({ fsPath: p, scheme: "file" }),
      };

      let transportCalled = false;
      const transport = async (opts) => {
        transportCalled = true;
        assert.strictEqual(opts.path, "/log/logFileTransfer?file_path=bm.log&log_categ=GENERAL");
        assert.strictEqual(opts.method, "GET");
        return {
          statusCode: 200,
          headers: { "content-type": "text/plain" },
          text: "mock log file content\nline 2",
        };
      };

      await runDownloadLogFile(makeContext(), vscode, transport);

      assert.ok(transportCalled);
      assert.ok(fs.existsSync(tempFilePath));
      assert.strictEqual(fs.readFileSync(tempFilePath, "utf8"), "mock log file content\nline 2");
      assert.ok(prompts.some((p) => p.includes("Successfully downloaded")));
    }));

  test("supports custom log file path", () =>
    withTempDir(async (tmpDir) => {
      const tempFilePath = path.join(tmpDir, "custom.log");
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showQuickPick: async (items) => items.find((i) => i.label === "Custom..."),
          showInputBox: async () => "custom/path/to/server.log",
          showSaveDialog: async () => ({ fsPath: tempFilePath }),
          showTextDocument: async () => {},
          showInformationMessage: () => {},
          withProgress: async (options, task) => task(),
        },
      });
      vscode.ProgressLocation = { Notification: 15 };

      vscode.workspace.fs = {
        writeFile: async (uri, data) => {
          fs.writeFileSync(uri.fsPath, data);
        },
      };
      vscode.workspace.openTextDocument = async () => ({});
      vscode.Uri = {
        file: (p) => ({ fsPath: p, scheme: "file" }),
      };

      let transportCalled = false;
      const transport = async (opts) => {
        transportCalled = true;
        assert.strictEqual(opts.path, "/log/logFileTransfer?file_path=custom%2Fpath%2Fto%2Fserver.log&log_categ=GENERAL");
        return {
          statusCode: 200,
          headers: { "content-type": "text/plain" },
          text: "custom log content",
        };
      };

      await runDownloadLogFile(makeContext(), vscode, transport);

      assert.ok(transportCalled);
      assert.strictEqual(fs.readFileSync(tempFilePath, "utf8"), "custom log content");
    }));
});
