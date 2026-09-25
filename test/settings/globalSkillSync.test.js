const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");
const zlib = require("zlib");
const {
  syncGlobalAgySkills,
  getAgyGlobalSkillsDir,
  resolveExtensionRoot,
} = require("@/ai/setup/globalSkillSync");

suite("globalSkillSync", () => {
  let tempDestDir;
  let originalHomedir;

  setup(() => {
    tempDestDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-skills-test-"));
    // Override getAgyGlobalSkillsDir by swapping homedir temporarily if needed, or by testing directly
  });

  teardown(() => {
    if (tempDestDir && fs.existsSync(tempDestDir)) {
      try {
        fs.rmSync(tempDestDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  test("resolveExtensionRoot returns valid directory", () => {
    const root = resolveExtensionRoot();
    assert.ok(typeof root === "string");
    assert.ok(fs.existsSync(root));
  });

  test("syncGlobalAgySkills syncs all 9 skills from repo root without errors", () => {
    const result = syncGlobalAgySkills(path.resolve(__dirname, "../.."));
    assert.strictEqual(result.errors.length, 0, `Unexpected errors: ${result.errors.join(", ")}`);
    assert.strictEqual(result.synced, 9, "Should sync 9 skills");

    const agyDir = getAgyGlobalSkillsDir();
    assert.ok(fs.existsSync(agyDir));
    assert.ok(fs.existsSync(path.join(agyDir, "bml-language", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(agyDir, "cpq-rest-api", "SKILL.md")));
  });

  test("syncGlobalAgySkills falls back to dist/ai.br bundle when app/ai/skills is absent", () => {
    const simDir = fs.mkdtempSync(path.join(os.tmpdir(), "packaged-ext-"));
    try {
      // Simulate packaged extension layout: only dist/ai.br exists, no app/ai/skills
      fs.mkdirSync(path.join(simDir, "dist"), { recursive: true });
      const realBundle = path.resolve(__dirname, "../../dist/ai.br");
      assert.ok(fs.existsSync(realBundle), "dist/ai.br must exist in repo");
      fs.copyFileSync(realBundle, path.join(simDir, "dist", "ai.br"));

      const result = syncGlobalAgySkills(simDir);
      assert.strictEqual(result.errors.length, 0, `Expected 0 errors from bundle sync, got: ${result.errors.join(", ")}`);
      assert.strictEqual(result.synced, 9, "Should sync all 9 skills from bundle");
    } finally {
      fs.rmSync(simDir, { recursive: true, force: true });
    }
  });

  test("syncGlobalAgySkills auto-resolves when extensionPath is undefined", () => {
    const result = syncGlobalAgySkills(undefined);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.synced, 9);
  });

  test("syncGlobalAgySkills returns graceful error when neither dir nor bundle exists", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "empty-dir-"));
    try {
      const result = syncGlobalAgySkills(emptyDir);
      assert.strictEqual(result.synced, 0);
      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].includes("BML skills source not found"));
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
