/**
 * BML Native Test Controller
 * Integrates BML test discovery and execution directly into the native VS Code Test Explorer.
 * Strictly maintains under 500 lines of code.
 */

const vscode = require("vscode");
const fs = require("fs");
const { BmlTestRunner } = require("./bmlTestRunner");

class BmlTestController {
  constructor(context) {
    this.context = context;
    if (!vscode.tests || !vscode.tests.createTestController) {
      return; // Fallback if API not present
    }

    this.controller = vscode.tests.createTestController("cpqBmlTests", "CPQ BML Tests");
    context.subscriptions.push(this.controller);

    this.runProfile = this.controller.createRunProfile(
      "Run BML Tests",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(request, token),
      true
    );

    this.discoverTests();
    this.registerWatchers();
  }

  async discoverTests() {
    if (!this.controller) return;

    const files = await vscode.workspace.findFiles("**/*.test.bml");
    for (const file of files) {
      this.indexTestFile(file);
    }
  }

  indexTestFile(uri) {
    try {
      const content = fs.readFileSync(uri.fsPath, "utf8");
      const testCases = BmlTestRunner.extractTestCases(content);

      const fileItem = this.controller.createTestItem(
        uri.fsPath,
        uri.path.split("/").pop(),
        uri
      );

      for (const tc of testCases) {
        const testId = `${uri.fsPath}::${tc.name}`;
        const item = this.controller.createTestItem(testId, tc.name, uri);
        item.range = new vscode.Range(tc.line - 1, 0, tc.line - 1, 0);
        fileItem.children.add(item);
      }

      this.controller.items.add(fileItem);
    } catch {
      // Ignored
    }
  }

  registerWatchers() {
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.test.bml");
    watcher.onDidCreate((uri) => this.indexTestFile(uri));
    watcher.onDidChange((uri) => this.indexTestFile(uri));
    watcher.onDidDelete((uri) => this.controller.items.delete(uri.fsPath));
    this.context.subscriptions.push(watcher);
  }

  async runHandler(request, token) {
    const run = this.controller.createTestRun(request);
    const queue = [];

    if (request.include) {
      request.include.forEach((test) => queue.push(test));
    } else {
      this.controller.items.forEach((test) => queue.push(test));
    }

    while (queue.length > 0 && !token.isCancellationRequested) {
      const current = queue.shift();

      if (current.children && current.children.size > 0) {
        current.children.forEach((child) => queue.push(child));
        continue;
      }

      run.started(current);

      try {
        if (!current.uri || !fs.existsSync(current.uri.fsPath)) {
          run.skipped(current);
          continue;
        }

        const fileContent = fs.readFileSync(current.uri.fsPath, "utf8");
        const testCases = BmlTestRunner.extractTestCases(fileContent);
        const match = testCases.find((tc) => tc.name === current.label);

        const codeToRun = match ? match.codeLines.join("\n") : fileContent;
        const result = BmlTestRunner.runTestCase(codeToRun);

        if (result.passed) {
          run.passed(current, result.durationMs);
        } else {
          const msg = new vscode.TestMessage(result.error || "Test execution failed");
          if (current.range) msg.location = new vscode.Location(current.uri, current.range);
          run.failed(current, msg, result.durationMs);
        }
      } catch (err) {
        run.failed(current, new vscode.TestMessage(err.message));
      }
    }

    run.end();
  }
}

function registerTestController(context) {
  return new BmlTestController(context);
}

module.exports = {
  BmlTestController,
  registerTestController,
};
