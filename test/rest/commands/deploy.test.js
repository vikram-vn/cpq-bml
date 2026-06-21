const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const config = require("../../../app/lang/rest/config");
const { createFakeVscode } = require("../test-helpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

const COMMERCE_FUNCTION = {
  ...SAMPLE_FUNCTION,
  commerceProcess: "oraclecpqo",
  commerceDocument: "transaction",
};

function makeCommerceEditor(tmpDir) {
  const bmlPath = path.join(tmpDir, "concatString.bml");
  metadataLib.writeMetadata(
    metadataLib.bmlPathToMetaPath(bmlPath),
    metadataLib.splitFunctionResponse(COMMERCE_FUNCTION).metadata,
  );
  return {
    editor: {
      document: {
        languageId: "bml",
        uri: { fsPath: bmlPath },
        getText: () => COMMERCE_FUNCTION.scriptText,
      },
    },
    bmlPath,
  };
}

function makeUtilEditor(tmpDir) {
  const bmlPath = path.join(tmpDir, "concatString.bml");
  metadataLib.writeMetadata(
    metadataLib.bmlPathToMetaPath(bmlPath),
    metadataLib.splitFunctionResponse(SAMPLE_FUNCTION).metadata,
  );
  return {
    editor: {
      document: {
        languageId: "bml",
        uri: { fsPath: bmlPath },
        getText: () => SAMPLE_FUNCTION.scriptText,
      },
    },
    bmlPath,
  };
}

function makeDeployVscode(editor, overrides = {}) {
  return createFakeVscode({
    config: {
      ...baseVscodeConfig(),
      "cpqBml.connection.siteUrl": "example",
      "cpqBml.connection.username": "testuser",
    },
    window: {
      activeTextEditor: editor,
      ...overrides,
    },
  });
}

async function makeAuthedContext() {
  const context = makeContext();
  await context.secrets.store(config.SECRET_PASSWORD, "pass");
  return context;
}

suite("BML REST commands - deploy", () => {
  test("deploys commerce process setup, polls the queued task, and prints success once it completes", () =>
    withTempDir(async (tmpDir) => {
      const { editor } = makeCommerceEditor(tmpDir);
      const errors = [];
      const infos = [];
      const vscode = makeDeployVscode(editor, {
        showErrorMessage: (m) => errors.push(m),
        showInformationMessage: (m) => infos.push(m),
      });

      const context = await makeAuthedContext();

      const calls = [];
      const transport = async (opts) => {
        calls.push({ method: opts.method, path: opts.path });
        if (opts.path.includes("/deploymentCenter/actions")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ taskId: 555 }),
          };
        }
        // GET /tasks/555 - completed on the very first poll, so no real delay occurs.
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ id: 555, status: "Completed" }),
        };
      };

      await commands.runDeployCommerceProcess(context, vscode, fakeResultsTerminal(), { transport });

      assert.strictEqual(errors.length, 0, "no errors");
      assert.ok(infos[0].includes("deployed"), "success message");

      assert.strictEqual(calls.length, 2);
      assert.strictEqual(calls[0].method, "POST");
      assert.ok(calls[0].path.includes("/commerceProcessSetups/oraclecpqo/deploymentCenter/actions"));
      assert.strictEqual(calls[1].method, "GET");
      assert.ok(calls[1].path.endsWith("/tasks/555"));
    }));

  test("handles deployment error on API failure", () =>
    withTempDir(async (tmpDir) => {
      const { editor } = makeCommerceEditor(tmpDir);
      const errors = [];
      const vscode = makeDeployVscode(editor, { showErrorMessage: (m) => errors.push(m) });

      const context = await makeAuthedContext();

      const transport = async () => ({
        statusCode: 500,
        headers: {},
        text: '{"title":"Internal Error"}',
      });

      await commands.runDeployCommerceProcess(context, vscode, fakeResultsTerminal(), { transport });

      assert.ok(errors[0].includes("deployment failed"));
      assert.ok(errors[0].includes("500"));
    }));

  test("reports failure when the queued task itself ends in an error status", () =>
    withTempDir(async (tmpDir) => {
      const { editor } = makeCommerceEditor(tmpDir);
      const errors = [];
      const vscode = makeDeployVscode(editor, { showErrorMessage: (m) => errors.push(m) });

      const context = await makeAuthedContext();

      const transport = async (opts) => {
        if (opts.path.includes("/deploymentCenter/actions")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ taskId: 556 }),
          };
        }
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({
            id: 556,
            status: "Error",
            detailStatus: { message: "Process has unsaved validation errors" },
          }),
        };
      };

      await commands.runDeployCommerceProcess(context, vscode, fakeResultsTerminal(), { transport });

      assert.ok(errors[0].includes("deployment failed"));
      assert.ok(errors[0].includes("Process has unsaved validation errors"));
    }));

  test("reports still running (not failure) when the task has not reached a terminal status by the poll timeout", () =>
    withTempDir(async (tmpDir) => {
      const { editor } = makeCommerceEditor(tmpDir);
      const errors = [];
      const warnings = [];
      const vscode = makeDeployVscode(editor, {
        showErrorMessage: (m) => errors.push(m),
        showWarningMessage: (m) => warnings.push(m),
      });

      const context = await makeAuthedContext();

      const transport = async (opts) => {
        if (opts.path.includes("/deploymentCenter/actions")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ taskId: 557 }),
          };
        }
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          text: JSON.stringify({ id: 557, status: "Running" }),
        };
      };

      await commands.runDeployCommerceProcess(context, vscode, fakeResultsTerminal(), {
        transport,
        pollIntervalMs: 1,
        pollTimeoutMs: 5,
      });

      assert.strictEqual(errors.length, 0, "not reported as a failure");
      assert.ok(warnings[0].includes("still running"));
      assert.ok(warnings[0].includes("557"));
    }));

  suite("runDeployUtilFunctions (mass deploy)", () => {
    function listTransport(extraHandlers = {}) {
      return async (opts) => {
        if (opts.path.startsWith("/rest/v18/bml/library/functions?")) {
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({
              items: [
                { variableName: "test23", folderName: "util" },
                { variableName: "test234", folderName: "util" },
              ],
              hasMore: false,
            }),
          };
        }
        if (opts.path.endsWith("/actions/deploy")) {
          return extraHandlers.deploy
            ? extraHandlers.deploy(opts)
            : { statusCode: 204, headers: {}, text: "" };
        }
        throw new Error(`unexpected call: ${opts.path}`);
      };
    }

    test("lists util functions, lets the user multi-select, and deploys all selected in one call", async () => {
      const infos = [];
      let quickPickItems;
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showInformationMessage: (m) => infos.push(m),
          showQuickPick: async (items) => {
            quickPickItems = items;
            return items; // select both
          },
        },
      });

      const context = await makeAuthedContext();
      const calls = [];
      const transport = async (opts) => {
        calls.push({ path: opts.path, body: opts.body && JSON.parse(opts.body) });
        return listTransport()(opts);
      };

      await commands.runDeployUtilFunctions(context, vscode, fakeResultsTerminal(), { transport });

      assert.strictEqual(quickPickItems.length, 2);
      assert.ok(infos[0].includes("deployed 2 util function(s)"));

      const deployCall = calls.find((c) => c.path.endsWith("/actions/deploy"));
      assert.deepStrictEqual(deployCall.body, {
        items: [
          { namespace: "", type: "util", variableName: "test23" },
          { namespace: "", type: "util", variableName: "test234" },
        ],
      });
    });

    test("makes no deploy call when the user cancels the quick pick", async () => {
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: { showQuickPick: async () => undefined },
      });

      const context = await makeAuthedContext();
      let deployCalled = false;
      const transport = async (opts) => {
        if (opts.path.endsWith("/actions/deploy")) deployCalled = true;
        return listTransport()(opts);
      };

      await commands.runDeployUtilFunctions(context, vscode, fakeResultsTerminal(), { transport });

      assert.strictEqual(deployCalled, false);
    });

    test("shows an error and stops when the deploy call fails", async () => {
      const errors = [];
      const vscode = createFakeVscode({
        config: baseVscodeConfig(),
        window: {
          showErrorMessage: (m) => errors.push(m),
          showQuickPick: async (items) => items,
        },
      });

      const context = await makeAuthedContext();
      const transport = listTransport({
        deploy: () => ({
          statusCode: 400,
          headers: { "content-type": "application/json" },
          text: '{"title":"Invalid payload."}',
        }),
      });

      await commands.runDeployUtilFunctions(context, vscode, fakeResultsTerminal(), { transport });

      assert.ok(errors[0].includes("deploy failed"));
      assert.ok(errors[0].includes("Invalid payload."));
    });
  });

  suite("runDeployCurrentFile (icon-driven individual deploy)", () => {
    test("deploys just the open util function", () =>
      withTempDir(async (tmpDir) => {
        const { editor } = makeUtilEditor(tmpDir);
        const infos = [];
        const vscode = makeDeployVscode(editor, { showInformationMessage: (m) => infos.push(m) });

        const context = await makeAuthedContext();
        const calls = [];
        const transport = async (opts) => {
          calls.push({ path: opts.path, body: opts.body && JSON.parse(opts.body) });
          return { statusCode: 204, headers: {}, text: "" };
        };

        await commands.runDeployCurrentFile(context, vscode, fakeResultsTerminal(), { transport });

        assert.ok(infos[0].includes("concatString deployed"));
        assert.strictEqual(calls.length, 1);
        assert.ok(calls[0].path.endsWith("/actions/deploy"));
        assert.deepStrictEqual(calls[0].body, {
          items: [{ namespace: "", type: "util", variableName: "concatString" }],
        });
      }));

    test("shows an error and makes no API call for a commerce function - directs to the commerce deploy command instead", () =>
      withTempDir(async (tmpDir) => {
        const { editor } = makeCommerceEditor(tmpDir);
        const errors = [];
        const vscode = makeDeployVscode(editor, { showErrorMessage: (m) => errors.push(m) });

        const context = await makeAuthedContext();
        let called = false;
        const transport = async () => {
          called = true;
          return { statusCode: 204, headers: {}, text: "" };
        };

        await commands.runDeployCurrentFile(context, vscode, fakeResultsTerminal(), { transport });

        assert.strictEqual(called, false);
        assert.ok(errors[0].includes("Deploy Commerce Process Setup"));
      }));

    test("shows an error when there is no local metadata or matching server function", () =>
      withTempDir(async (tmpDir) => {
        const bmlPath = path.join(tmpDir, "missingFn.bml");
        const editor = {
          document: {
            languageId: "bml",
            uri: { fsPath: bmlPath },
            getText: () => "return 1;",
          },
        };
        const errors = [];
        const vscode = makeDeployVscode(editor, { showErrorMessage: (m) => errors.push(m) });

        const context = await makeAuthedContext();
        const transport = async () => ({ statusCode: 404, headers: {}, text: "{}" });

        await commands.runDeployCurrentFile(context, vscode, fakeResultsTerminal(), { transport });

        assert.ok(errors[0].includes("missingFn"));
      }));
  });
});
