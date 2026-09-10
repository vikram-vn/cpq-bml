const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");

const {
  getWorkspaceIndex,
  invalidateIndex,
  updateFileInIndex,
  removeFileFromIndex,
} = require("@/lang/intellisense/workspaceIndex");
const { createSessionKeepAlive } = require("@/lang/rest/sessionKeepAlive");
const { createInstanceMonitor } = require("@/lang/rest/instanceMonitor");
const { getHtml } = require("@/lang/settings-panel/html");

suite("Architectural & Performance Fixes Verification", () => {
  suite("workspaceIndex incremental indexing", () => {
    let tmpDir;
    setup(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-ws-index-test-"));
    });

    teardown(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      invalidateIndex();
    });

    test("updateFileInIndex incrementally updates existing index", () => {
      const utilDir = path.join(tmpDir, "util");
      fs.mkdirSync(utilDir, { recursive: true });
      const bmlFile = path.join(utilDir, "sampleCalc.bml");
      fs.writeFileSync(bmlFile, "/*\n * Function Name: sampleCalc\n * Description: Test func\n */\nreturn 42;");

      // Initialize index
      invalidateIndex();
      const index = getWorkspaceIndex();
      assert.ok(index instanceof Map);

      // Now incrementally add file to index
      updateFileInIndex(bmlFile);
      const entry = index.get("util.samplecalc");
      assert.ok(entry, "Expected util.samplecalc in index");
      assert.strictEqual(entry.qualifiedName, "util.sampleCalc");

      // Now remove file from index
      removeFileFromIndex(bmlFile);
      assert.strictEqual(index.get("util.samplecalc"), undefined);
    });

    test("updateFileInIndex handles meta.json updates", () => {
      const utilDir = path.join(tmpDir, "util");
      fs.mkdirSync(utilDir, { recursive: true });
      const bmlFile = path.join(utilDir, "formatNumber.bml");
      const metaFile = path.join(utilDir, "formatNumber-meta.json");

      fs.writeFileSync(bmlFile, "return String;");
      fs.writeFileSync(
        metaFile,
        JSON.stringify({
          params: [{ name: "num", dataType: "Integer" }],
          returnType: "String",
        })
      );

      invalidateIndex();
      const index = getWorkspaceIndex();
      updateFileInIndex(metaFile);

      const entry = index.get("util.formatnumber");
      assert.ok(entry);
      assert.strictEqual(entry.returnType, "String");
      assert.strictEqual(entry.parameters[0].name, "num");
    });
  });

  suite("sessionKeepAlive unconfigured guard", () => {
    test("start() does not activate timer when credentials are missing", () => {
      const keepAlive = createSessionKeepAlive();
      const mockVscode = {
        workspace: {
          getConfiguration: () => ({
            get: (key, fallback) => fallback,
          }),
        },
      };

      keepAlive.start(mockVscode);
      assert.strictEqual(keepAlive.isActive, false);
      keepAlive.stop();
    });
  });

  suite("instanceMonitor deferred check & dispose", () => {
    test("startPeriodicChecks respects initialDelayMs and dispose clears timers", () => {
      const mockStatusBar = {
        command: "",
        text: "",
        show: () => {},
        dispose: () => {},
      };
      const mockVscode = {
        StatusBarAlignment: { Right: 1 },
        window: {
          createStatusBarItem: () => mockStatusBar,
        },
      };

      const monitor = createInstanceMonitor(mockVscode);
      // Calling startPeriodicChecks with positive delay will not check synchronously
      monitor.startPeriodicChecks(60000, 5000);
      assert.strictEqual(monitor.lastHealth, null);

      // Clean dispose
      monitor.dispose();
    });
  });

  suite("settings panel html caching", () => {
    test("getHtml returns valid HTML with CSP and nonce", () => {
      const mockContext = {
        extensionUri: { fsPath: __dirname },
        extensionPath: path.resolve(__dirname, "..", ".."),
      };
      const mockWebview = {
        cspSource: "vscode-webview:",
        asWebviewUri: (uri) => uri,
      };
      const mockVscode = {
        Uri: {
          joinPath: (base, ...segments) => path.join(base.fsPath || base, ...segments),
        },
      };

      const html1 = getHtml(mockContext, mockVscode, mockWebview);
      assert.ok(html1.includes("<!DOCTYPE html>"));
      assert.ok(html1.includes("script-src 'nonce-"));

      const html2 = getHtml(mockContext, mockVscode, mockWebview);
      assert.ok(html2.includes("<!DOCTYPE html>"));
    });
  });
});
