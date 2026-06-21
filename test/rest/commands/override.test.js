const assert = require("assert");
const path = require("path");
const commands = require("../../../app/lang/rest/commands");
const metadataLib = require("../../../app/lang/rest/metadata");
const { createFakeVscode } = require("../test-helpers");
const { SAMPLE_FUNCTION, baseVscodeConfig, makeContext, withTempDir, fakeResultsTerminal } = require("./fixtures");

// A standard commerce function fixture
const STANDARD_FUNCTION = {
  ...SAMPLE_FUNCTION,
  commerceProcess: "oraclecpqo",
  commerceDocument: "transaction",
  isStandardFunction: true,
  isOverridden: false,
};

function makeStandardEditor(tmpDir, bmlOverrides = {}) {
  const base = { ...STANDARD_FUNCTION, ...bmlOverrides };
  const bmlPath = path.join(tmpDir, "concatString.bml");
  metadataLib.writeMetadata(
    metadataLib.bmlPathToMetaPath(bmlPath),
    metadataLib.splitFunctionResponse(base).metadata,
  );
  return {
    editor: {
      document: {
        languageId: "bml",
        uri: { fsPath: bmlPath },
        getText: () => base.scriptText,
      },
    },
    bmlPath,
  };
}

suite("BML REST commands - override", () => {
  suite("runCreateOverride", () => {
    test("PATCHes { isOverridden: true } and updates the local sidecar on success", () =>
      withTempDir(async (tmpDir) => {
        const { editor, bmlPath } = makeStandardEditor(tmpDir);
        const errors = [];
        const infos = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showErrorMessage: (m) => errors.push(m),
            showInformationMessage: (m) => infos.push(m),
          },
        });

        const calls = [];
        const transport = async (opts) => {
          calls.push({ method: opts.method, path: opts.path, body: JSON.parse(opts.body) });
          // Response: same function with isOverridden: true
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ ...STANDARD_FUNCTION, isOverridden: true }),
          };
        };

        await commands.runCreateOverride(makeContext(), vscode, fakeResultsTerminal(), { transport });

        assert.strictEqual(errors.length, 0, "no errors");
        assert.ok(infos[0].includes("override created"), "success message");

        // Exactly one PATCH with { isOverridden: true }
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, "PATCH");
        assert.ok(calls[0].path.includes("currentStep") || calls[0].path.includes("concatString"));
        assert.strictEqual(calls[0].body.isOverridden, true);
        assert.strictEqual("commerceProcess" in calls[0].body, false, "commerce routing fields stripped from body");

        // Sidecar updated
        const updatedMeta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(bmlPath));
        assert.strictEqual(updatedMeta.isOverridden, true);
      }));

    test("shows error and makes no API call when function is not a standard function", () =>
      withTempDir(async (tmpDir) => {
        const customFunction = { ...SAMPLE_FUNCTION, commerceDocument: "transaction", commerceProcess: "oraclecpqo" };
        const bmlPath = path.join(tmpDir, "concatString.bml");
        metadataLib.writeMetadata(
          metadataLib.bmlPathToMetaPath(bmlPath),
          metadataLib.splitFunctionResponse(customFunction).metadata,
        );
        const editor = { document: { languageId: "bml", uri: { fsPath: bmlPath }, getText: () => "" } };
        const errors = [];
        let called = false;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: { activeTextEditor: editor, showErrorMessage: (m) => errors.push(m) },
        });

        await commands.runCreateOverride(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => { called = true; },
        });

        assert.strictEqual(called, false);
        assert.ok(errors[0].includes("not a standard function"));
      }));

    test("shows error and makes no API call when function is already overridden", () =>
      withTempDir(async (tmpDir) => {
        const { editor } = makeStandardEditor(tmpDir, { isOverridden: true });
        const errors = [];
        let called = false;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: { activeTextEditor: editor, showErrorMessage: (m) => errors.push(m) },
        });

        await commands.runCreateOverride(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => { called = true; },
        });

        assert.strictEqual(called, false);
        assert.ok(errors[0].includes("already overridden"));
      }));

    test("shows error when API returns a failure status", () =>
      withTempDir(async (tmpDir) => {
        const { editor } = makeStandardEditor(tmpDir);
        const errors = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: { activeTextEditor: editor, showErrorMessage: (m) => errors.push(m) },
        });

        await commands.runCreateOverride(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => ({ statusCode: 403, headers: {}, text: '{"title":"Forbidden"}' }),
        });

        assert.ok(errors[0].includes("create override failed"));
        assert.ok(errors[0].includes("403"));
      }));

    test("POSTs to actions/override for util libraries and updates sidecar on success", () =>
      withTempDir(async (tmpDir) => {
        const { editor, bmlPath } = makeStandardEditor(tmpDir, { commerceProcess: undefined, commerceDocument: undefined });
        const errors = [];
        const infos = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showErrorMessage: (m) => errors.push(m),
            showInformationMessage: (m) => infos.push(m),
          },
        });

        const calls = [];
        const transport = async (opts) => {
          calls.push({ method: opts.method, path: opts.path });
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ ...SAMPLE_FUNCTION, isStandardFunction: true, isOverridden: true }),
          };
        };

        await commands.runCreateOverride(makeContext(), vscode, fakeResultsTerminal(), { transport });

        assert.strictEqual(errors.length, 0, "no errors");
        assert.ok(infos[0].includes("override created"), "success message");

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, "POST");
        assert.ok(calls[0].path.includes("/actions/override"));

        // Sidecar updated
        const updatedMeta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(bmlPath));
        assert.strictEqual(updatedMeta.isOverridden, true);
      }));
  });

  suite("runRemoveOverride", () => {
    test("PATCHes { isOverridden: false }, updates sidecar and reverts local .bml to system script", () =>
      withTempDir(async (tmpDir) => {
        const { editor, bmlPath } = makeStandardEditor(tmpDir, { isOverridden: true });
        const systemScript = "// system version";
        const infos = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInformationMessage: (m) => infos.push(m),
            showWarningMessage: async (_msg, _opts, ...buttons) => buttons[0], // confirm
          },
        });

        const calls = [];
        const transport = async (opts) => {
          calls.push({ method: opts.method, body: JSON.parse(opts.body) });
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ ...STANDARD_FUNCTION, isOverridden: false, scriptText: systemScript }),
          };
        };

        await commands.runRemoveOverride(makeContext(), vscode, fakeResultsTerminal(), { transport });

        assert.ok(infos[0].includes("override removed"));
        assert.strictEqual(calls[0].body.isOverridden, false);

        const updatedMeta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(bmlPath));
        assert.strictEqual(updatedMeta.isOverridden, false);

        // Local .bml reverted to system script
        const fs = require("fs");
        const localScript = fs.readFileSync(bmlPath, "utf8");
        assert.strictEqual(localScript, systemScript);
      }));

    test("makes no API call when user cancels the confirmation dialog", () =>
      withTempDir(async (tmpDir) => {
        const { editor } = makeStandardEditor(tmpDir, { isOverridden: true });
        let called = false;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showWarningMessage: async () => undefined, // user dismissed
          },
        });

        await commands.runRemoveOverride(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => { called = true; },
        });

        assert.strictEqual(called, false);
      }));

    test("shows error and makes no API call when function is not overridden", () =>
      withTempDir(async (tmpDir) => {
        const { editor } = makeStandardEditor(tmpDir); // isOverridden: false
        const errors = [];
        let called = false;
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: { activeTextEditor: editor, showErrorMessage: (m) => errors.push(m) },
        });

        await commands.runRemoveOverride(makeContext(), vscode, fakeResultsTerminal(), {
          transport: async () => { called = true; },
        });

        assert.strictEqual(called, false);
        assert.ok(errors[0].includes("not overridden"));
      }));

    test("POSTs to actions/removeOverride for util libraries and updates sidecar on success", () =>
      withTempDir(async (tmpDir) => {
        const { editor, bmlPath } = makeStandardEditor(tmpDir, { commerceProcess: undefined, commerceDocument: undefined, isOverridden: true });
        const systemScript = "// system version";
        const infos = [];
        const vscode = createFakeVscode({
          config: baseVscodeConfig(),
          window: {
            activeTextEditor: editor,
            showInformationMessage: (m) => infos.push(m),
            showWarningMessage: async (_msg, _opts, ...buttons) => buttons[0], // confirm
          },
        });

        const calls = [];
        const transport = async (opts) => {
          calls.push({ method: opts.method, path: opts.path });
          return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            text: JSON.stringify({ ...SAMPLE_FUNCTION, isStandardFunction: true, isOverridden: false, scriptText: systemScript }),
          };
        };

        await commands.runRemoveOverride(makeContext(), vscode, fakeResultsTerminal(), { transport });

        assert.ok(infos[0].includes("override removed"));
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].method, "POST");
        assert.ok(calls[0].path.includes("/actions/removeOverride"));

        const updatedMeta = metadataLib.readMetadata(metadataLib.bmlPathToMetaPath(bmlPath));
        assert.strictEqual(updatedMeta.isOverridden, false);

        // Local .bml reverted to system script
        const fs = require("fs");
        const localScript = fs.readFileSync(bmlPath, "utf8");
        assert.strictEqual(localScript, systemScript);
      }));
  });
});
