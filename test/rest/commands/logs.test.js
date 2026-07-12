const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { runDownloadLogFile } = require("../../../app/lang/rest/commands/logs");
const { createFakeVscode } = require("../testHelpers");
const { baseVscodeConfig, makeContext, withTempDir } = require("./fixtures");

suite("BML REST commands - download logs", () => {
  test("successfully downloads bm.log and saves/opens it", () =>
    withTempDir(async (tmpDir) => {
      const tempFilePath = path.join(tmpDir, "logs", "system-logs", "bm.log");
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
        workspaceFolders: [{ uri: { fsPath: tmpDir, scheme: "file" } }],
      });
      vscode.ProgressLocation = { Notification: 15 };

      vscode.workspace.fs = {
        createDirectory: async () => {},
        writeFile: async (uri, data) => {
          fs.mkdirSync(path.dirname(uri.fsPath), { recursive: true });
          fs.writeFileSync(uri.fsPath, data);
        },
      };
      vscode.workspace.openTextDocument = async (uri) => {
        assert.strictEqual(uri.fsPath, tempFilePath);
        return {};
      };
      vscode.Uri = {
        file: (p) => ({ fsPath: p, scheme: "file" }),
        joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments), scheme: "file" }),
      };

      let transportCalled = false;
      const transport = async (opts) => {
        if (opts.path.includes("/currentUser")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json", "set-cookie": ["JSESSIONID=mocksession123; Path=/; Secure"] },
            text: "{}",
          };
        }
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
      const tempFilePath = path.join(tmpDir, "logs", "system-logs", "server.log");
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
        workspaceFolders: [{ uri: { fsPath: tmpDir, scheme: "file" } }],
      });
      vscode.ProgressLocation = { Notification: 15 };

      vscode.workspace.fs = {
        createDirectory: async () => {},
        writeFile: async (uri, data) => {
          fs.mkdirSync(path.dirname(uri.fsPath), { recursive: true });
          fs.writeFileSync(uri.fsPath, data);
        },
      };
      vscode.workspace.openTextDocument = async () => ({});
      vscode.Uri = {
        file: (p) => ({ fsPath: p, scheme: "file" }),
        joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments), scheme: "file" }),
      };

      let transportCalled = false;
      const transport = async (opts) => {
        if (opts.path.includes("/currentUser")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json", "set-cookie": ["JSESSIONID=mocksession123; Path=/; Secure"] },
            text: "{}",
          };
        }
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

  test("sends a browser-style request to the log servlet: Accept */*, session cookie, no JSON Content-Type", () =>
    withTempDir(async (tmpDir) => {
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showQuickPick: async (items) => items[0],
          showTextDocument: async () => {},
          showInformationMessage: () => {},
          withProgress: async (options, task) => task(),
        },
        workspaceFolders: [{ uri: { fsPath: tmpDir, scheme: "file" } }],
      });
      vscode.ProgressLocation = { Notification: 15 };
      vscode.workspace.fs = { createDirectory: async () => {}, writeFile: async () => {} };
      vscode.workspace.openTextDocument = async () => ({});
      vscode.Uri = {
        file: (p) => ({ fsPath: p, scheme: "file" }),
        joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments), scheme: "file" }),
      };

      let servletHeaders = null;
      const transport = async (opts) => {
        if (opts.path.includes("/currentUser")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json", "set-cookie": ["JSESSIONID=mocksession123; Path=/; Secure"] },
            text: "{}",
          };
        }
        servletHeaders = opts.headers;
        return { statusCode: 200, headers: { "content-type": "text/plain" }, text: "log" };
      };

      await runDownloadLogFile(makeContext(), vscode, transport);

      assert.ok(servletHeaders, "servlet request should have been made");
      assert.strictEqual(servletHeaders.Accept, "*/*", "the servlet is not a REST endpoint - no JSON content negotiation");
      assert.strictEqual(servletHeaders["Content-Type"], undefined, "a GET with no body must not carry Content-Type: application/json");
      assert.strictEqual(servletHeaders.Cookie, "JSESSIONID=mocksession123", "the UI session cookie from the REST login must be forwarded");
    }));

  test("reports a clear error when the servlet redirects to the login page instead of serving the log", () =>
    withTempDir(async (tmpDir) => {
      const errors = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showQuickPick: async (items) => items[0],
          showTextDocument: async () => {},
          showInformationMessage: () => {},
          showErrorMessage: (msg) => errors.push(msg),
          withProgress: async (options, task) => task(),
        },
        workspaceFolders: [{ uri: { fsPath: tmpDir, scheme: "file" } }],
      });
      vscode.ProgressLocation = { Notification: 15 };
      vscode.workspace.fs = { createDirectory: async () => {}, writeFile: async () => {} };
      vscode.workspace.openTextDocument = async () => ({});
      vscode.Uri = {
        file: (p) => ({ fsPath: p, scheme: "file" }),
        joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments), scheme: "file" }),
      };

      const transport = async (opts) => {
        if (opts.path.includes("/currentUser")) {
          return { statusCode: 200, headers: { "content-type": "application/json" }, text: "{}" };
        }
        return { statusCode: 302, headers: { location: "/login" }, text: "" };
      };

      await runDownloadLogFile(makeContext(), vscode, transport);

      assert.ok(
        errors.some((e) => e.includes("authenticated UI session")),
        `expected a login-redirect explanation, got: ${JSON.stringify(errors)}`
      );
    }));
});
