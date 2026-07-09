const assert = require("assert");
const fs = require("fs");
const path = require("path");
const tools = require("../../app/lang/mcp/tools");
const metadataLib = require("../../app/lang/rest/metadata");
const { createFakeVscode } = require("../rest/testHelpers");
const { baseVscodeConfig, makeContext, withTempDir } = require("../rest/commands/fixtures");

function vscodeRootedAt(tmpDir, overrides) {
  return createFakeVscode({
    config: baseVscodeConfig(overrides),
    workspaceFolders: [{ uri: { fsPath: tmpDir } }],
  });
}

// Writes a canonical pulled function file at <tmpDir>/library/<variableName>/<variableName>.bml,
// matching the layout findOrCreateAiCopy() expects (mirrors pullFunction's own output).
function writeCanonicalBml(tmpDir, variableName, scriptText) {
  const dir = path.join(tmpDir, "library", variableName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${variableName}.bml`), scriptText, "utf8");
}

suite("MCP tools - knowledge (lint_function / get_function_metrics)", () => {
  suite("lintFunction", () => {
    test("requires a variableName", async () => {
      const result = await tools.lintFunction(makeContext(), createFakeVscode({}), {});
      assert.strictEqual(result.success, false);
    });

    test("reports an error when the function was never pulled locally", () =>
      withTempDir(async (tmpDir) => {
        const result = await tools.lintFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "neverPulled" });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("neverPulled"));
      }));

    test("lints the function's AI working copy and returns real diagnostics", () =>
      withTempDir(async (tmpDir) => {
        writeCanonicalBml(tmpDir, "badTypes", 'x = true + "1";\nreturn "";');

        const result = await tools.lintFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "badTypes" });

        assert.strictEqual(result.success, true);
        assert.strictEqual(path.basename(result.filePath), "badTypes_ai.bml");
        assert.ok(result.diagnosticCount > 0);
        const mismatch = result.diagnostics.find((d) => d.code === "bml-binary-type-mismatch");
        assert.ok(mismatch, "Should flag Boolean + String as a type mismatch");
        assert.strictEqual(mismatch.severity, "Error");
        assert.strictEqual(typeof mismatch.line, "number");
      }));

    test("returns zero diagnostics for clean code", () =>
      withTempDir(async (tmpDir) => {
        writeCanonicalBml(tmpDir, "cleanFn", 'return "ok";');

        const result = await tools.lintFunction(makeContext(), vscodeRootedAt(tmpDir), { variableName: "cleanFn" });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.diagnosticCount, 0);
        assert.deepStrictEqual(result.diagnostics, []);
      }));
  });

  suite("getFunctionMetrics", () => {
    test("requires a variableName", async () => {
      const result = await tools.getFunctionMetrics(makeContext(), createFakeVscode({}), {});
      assert.strictEqual(result.success, false);
    });

    test("reports an error when the function was never pulled locally", () =>
      withTempDir(async (tmpDir) => {
        const result = await tools.getFunctionMetrics(makeContext(), vscodeRootedAt(tmpDir), { variableName: "neverPulled" });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes("neverPulled"));
      }));

    test("returns complexity metrics plus a diagnostic-count summary matching lint_function", () =>
      withTempDir(async (tmpDir) => {
        writeCanonicalBml(tmpDir, "badTypes", 'x = true + "1";\nreturn "";');

        const vscode = vscodeRootedAt(tmpDir);
        const lintResult = await tools.lintFunction(makeContext(), vscode, { variableName: "badTypes" });
        const metricsResult = await tools.getFunctionMetrics(makeContext(), vscode, { variableName: "badTypes" });

        assert.strictEqual(metricsResult.success, true);
        assert.ok(metricsResult.metrics, "Should include complexity metrics");
        assert.strictEqual(typeof metricsResult.metrics.cyclomaticComplexity, "number");
        assert.strictEqual(typeof metricsResult.metrics.lineCount, "number");

        const errorDiagCount = lintResult.diagnostics.filter((d) => d.severity === "Error").length;
        assert.strictEqual(metricsResult.errorCount, errorDiagCount);
        assert.ok(metricsResult.errorCount >= 1, "Boolean + String mismatch should count as an error");
        assert.strictEqual(metricsResult.byCode["bml-binary-type-mismatch"] >= 1, true);
      }));
  });

  suite("listLocalFunctions", () => {
    test("errors when no workspace folder is open", async () => {
      const result = await tools.listLocalFunctions(makeContext(), createFakeVscode({}));
      assert.strictEqual(result.success, false);
    });

    test("returns an empty list when nothing has been pulled yet", () =>
      withTempDir(async (tmpDir) => {
        const result = await tools.listLocalFunctions(makeContext(), vscodeRootedAt(tmpDir));
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.count, 0);
        assert.deepStrictEqual(result.functions, []);
      }));

    test("finds canonical files only, skipping both AI-copy naming schemes, and classifies util vs commerce from meta", () =>
      withTempDir(async (tmpDir) => {
        writeCanonicalBml(tmpDir, "cleanFn", 'return "ok";');
        // A same-folder AI copy that should NOT be picked up as its own entry.
        fs.writeFileSync(path.join(tmpDir, "library", "cleanFn", "cleanFn_ai.bml"), 'return "ok";');

        const commerceDir = path.join(tmpDir, "library", "oraclecpqo", "transaction", "libraries", "commerceFn");
        fs.mkdirSync(commerceDir, { recursive: true });
        fs.writeFileSync(path.join(commerceDir, "commerceFn.bml"), 'return "";');
        metadataLib.writeMetadata(path.join(commerceDir, "commerceFn-meta.json"), {
          name: "Commerce Fn",
          variableName: "commerceFn",
          commerceProcess: "oraclecpqo",
          commerceDocument: "transaction",
        });

        const result = await tools.listLocalFunctions(makeContext(), vscodeRootedAt(tmpDir));

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.count, 2);
        const names = result.functions.map((f) => f.variableName).sort();
        assert.deepStrictEqual(names, ["cleanFn", "commerceFn"]);

        const commerceEntry = result.functions.find((f) => f.variableName === "commerceFn");
        assert.strictEqual(commerceEntry.type, "commerce");
        assert.strictEqual(commerceEntry.name, "Commerce Fn");
        assert.strictEqual(commerceEntry.commerceProcess, "oraclecpqo");

        const utilEntry = result.functions.find((f) => f.variableName === "cleanFn");
        assert.strictEqual(utilEntry.type, "util");
      }));
  });

  suite("lintAllFunctions", () => {
    test("aggregates diagnostics across every locally pulled function", () =>
      withTempDir(async (tmpDir) => {
        writeCanonicalBml(tmpDir, "badTypes", 'x = true + "1";\nreturn "";');
        writeCanonicalBml(tmpDir, "cleanFn", 'return "ok";');

        const result = await tools.lintAllFunctions(makeContext(), vscodeRootedAt(tmpDir));

        assert.strictEqual(result.success, false); // badTypes has an error
        assert.strictEqual(result.functionCount, 2);
        assert.ok(result.totalErrors >= 1);
        assert.strictEqual(result.worstOffenders[0].variableName, "badTypes");

        const badTypesResult = result.results.find((r) => r.variableName === "badTypes");
        assert.ok(badTypesResult.errorCount >= 1);
        const cleanResult = result.results.find((r) => r.variableName === "cleanFn");
        assert.strictEqual(cleanResult.errorCount, 0);
        assert.strictEqual(cleanResult.warningCount, 0);
      }));

    test("reports success when every function is clean", () =>
      withTempDir(async (tmpDir) => {
        writeCanonicalBml(tmpDir, "cleanFn", 'return "ok";');

        const result = await tools.lintAllFunctions(makeContext(), vscodeRootedAt(tmpDir));

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.totalErrors, 0);
        assert.deepStrictEqual(result.worstOffenders, []);
      }));
  });
});
