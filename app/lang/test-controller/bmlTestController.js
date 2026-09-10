
let vscode;
try {
  vscode = require("vscode");
} catch {
  vscode = {};
}

const fs = require("fs");
const { BmlTestRunner } = require("@/lang/test-controller/bmlTestRunner");

const TEST_GLOB_PATTERNS = ["**/*.bmlt", "**/*.test.bml"];

function isTestFile(filePath = "") {
  return filePath.endsWith(".bmlt") || filePath.endsWith(".test.bml");
}

function indexTestFile(controller, uri, vscodeInstance = vscode) {
  if (!controller || !uri || !uri.fsPath) return;

  try {
    const content = fs.readFileSync(uri.fsPath, "utf8");
    const testCases = BmlTestRunner.extractTestCases(content);

    const fileName = uri.path ? uri.path.split("/").pop() : uri.fsPath.split(/[\\/]/).pop();
    const fileItem = controller.createTestItem(uri.fsPath, fileName, uri);

    for (const tc of testCases) {
      const testId = `${uri.fsPath}::${tc.name}`;
      const item = controller.createTestItem(testId, tc.name, uri);
      if (vscodeInstance.Range && tc.line) {
        item.range = new vscodeInstance.Range(tc.line - 1, 0, tc.line - 1, 0);
      }
      fileItem.children.add(item);
    }

    controller.items.add(fileItem);
    return fileItem;
  } catch {
    // Ignored
  }
}

/**
 * Scans workspace folders for *.bmlt and *.test.bml test suites.
 */
async function discoverTests(controller, vscodeInstance = vscode) {
  if (!controller || !vscodeInstance.workspace || !vscodeInstance.workspace.findFiles) return;

  for (const pattern of TEST_GLOB_PATTERNS) {
    try {
      const files = await vscodeInstance.workspace.findFiles(pattern);
      for (const file of files) {
        indexTestFile(controller, file, vscodeInstance);
      }
    } catch {
      // Ignore discovery errors
    }
  }
}

/**
 * Handles test run requests from VS Code UI.
 */
async function handleTestRun(controller, request, token, vscodeInstance = vscode) {
  const run = controller.createTestRun(request);
  const queue = [];

  if (request.include) {
    request.include.forEach((test) => queue.push(test));
  } else {
    controller.items.forEach((test) => queue.push(test));
  }

  while (queue.length > 0 && (!token || !token.isCancellationRequested)) {
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
        const errorMsg = result.error || "Test execution failed";
        const msg = vscodeInstance.TestMessage ? new vscodeInstance.TestMessage(errorMsg) : { message: errorMsg };
        if (current.range && vscodeInstance.Location) {
          msg.location = new vscodeInstance.Location(current.uri, current.range);
        }
        run.failed(current, msg, result.durationMs);
      }
    } catch (err) {
      const msg = vscodeInstance.TestMessage ? new vscodeInstance.TestMessage(err.message) : { message: err.message };
      run.failed(current, msg);
    }
  }

  run.end();
}

function createBmlTestController(context, vscodeInstance = vscode) {
  if (!vscodeInstance.tests || !vscodeInstance.tests.createTestController) {
    return null;
  }

  const controller = vscodeInstance.tests.createTestController("cpqBmlTests", "CPQ BML Tests");
  context.subscriptions.push(controller);

  const runProfile = controller.createRunProfile(
    "Run BML Tests",
    vscodeInstance.TestRunProfileKind.Run,
    (request, token) => handleTestRun(controller, request, token, vscodeInstance),
    true
  );

  discoverTests(controller, vscodeInstance);

  // Register file watchers for *.bmlt and *.test.bml
  for (const pattern of TEST_GLOB_PATTERNS) {
    const watcher = vscodeInstance.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate((uri) => indexTestFile(controller, uri, vscodeInstance));
    watcher.onDidChange((uri) => indexTestFile(controller, uri, vscodeInstance));
    watcher.onDidDelete((uri) => controller.items.delete(uri.fsPath));
    context.subscriptions.push(watcher);
  }

  return {
    controller,
    runProfile,
    discoverTests: () => discoverTests(controller, vscodeInstance),
    indexTestFile: (uri) => indexTestFile(controller, uri, vscodeInstance),
    runHandler: (req, tok) => handleTestRun(controller, req, tok, vscodeInstance)
  };
}

function registerTestController(context, vscodeInstance = vscode) {
  return createBmlTestController(context, vscodeInstance);
}

const BmlTestController = function (context, vscodeInstance = vscode) {
  return createBmlTestController(context, vscodeInstance);
};

module.exports = {
  isTestFile,
  indexTestFile,
  discoverTests,
  handleTestRun,
  createBmlTestController,
  registerTestController,
  BmlTestController
};
