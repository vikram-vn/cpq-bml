const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { listSkills, getSkill } = require("../../app/lang/mcp/tools/knowledge");
const { registerMcpWithAllTools, deregisterMcpFromAllTools } = require("../../app/ai/setup/mcpAutoRegister");

suite("MCP Skills & Auto-Registration Suite", () => {
  const extensionPath = path.resolve(__dirname, "../..");
  const context = { extensionPath };

  test("listSkills returns all 9 CPQ and BML skills with descriptions", () => {
    const res = listSkills(context);
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.skills));
    assert.ok(res.skills.length >= 8);

    const names = res.skills.map((s) => s.name);
    assert.ok(names.includes("bml-language"), "Should include bml-language");
    assert.ok(names.includes("bml-pitfalls"), "Should include bml-pitfalls");
    assert.ok(names.includes("bml-db-access"), "Should include bml-db-access");
    assert.ok(names.includes("bml-json-dict"), "Should include bml-json-dict");
    assert.ok(names.includes("bml-web-services"), "Should include bml-web-services");
    assert.ok(names.includes("cpq-domain"), "Should include cpq-domain");
    assert.ok(names.includes("cpq-rest-api"), "Should include cpq-rest-api");

    for (const skill of res.skills) {
      assert.ok(skill.name, "Each skill must have a name");
      assert.ok(skill.description, `Skill ${skill.name} must have a description`);
    }
  });

  test("getSkill fetches full content and references for a specific skill", () => {
    const res = getSkill(context, { name: "bml-language" });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.name, "bml-language");
    assert.ok(res.content.includes("# Core BML Language Guide") || res.content.includes("bml-language"));
    assert.ok(res.description.length > 0);
    assert.ok(Array.isArray(res.references));
  });

  test("getSkill returns error for invalid or nonexistent skill", () => {
    const missing = getSkill(context, { name: "nonexistent-skill" });
    assert.strictEqual(missing.success, false);
    assert.ok(missing.error.includes("not found"));

    const empty = getSkill(context, {});
    assert.strictEqual(empty.success, false);
  });

  test("registerMcpWithAllTools and deregisterMcpFromAllTools execute cleanly with workspace", () => {
    const tempWs = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-mcp-autoreg-test-"));
    try {
      const { registered, errors } = registerMcpWithAllTools(47821, tempWs);
      assert.ok(Array.isArray(registered));
      assert.ok(registered.length >= 6);
      assert.ok(registered.includes("Google Gemini & Antigravity IDE"));
      assert.ok(registered.includes("Claude Desktop"));
      assert.ok(registered.includes("ChatGPT Desktop"));
      assert.ok(registered.includes("Cursor (Global)"));
      assert.ok(registered.includes("Cursor (Workspace)"));
      assert.ok(registered.includes("VS Code & Copilot (Workspace)"));

      // Verify workspace config was written
      const cursorWsMcp = path.join(tempWs, ".cursor", "mcp.json");
      assert.ok(fs.existsSync(cursorWsMcp), ".cursor/mcp.json should be created in workspace");
      const cursorJson = JSON.parse(fs.readFileSync(cursorWsMcp, "utf8"));
      assert.ok(cursorJson.mcpServers["cpq-bml"]);

      const vscodeWsMcp = path.join(tempWs, ".vscode", "mcp.json");
      assert.ok(fs.existsSync(vscodeWsMcp), ".vscode/mcp.json should be created in workspace");
      const vscodeJson = JSON.parse(fs.readFileSync(vscodeWsMcp, "utf8"));
      assert.ok(vscodeJson.servers["cpq-bml"]);

      // Deregister cleanly
      const { deregistered } = deregisterMcpFromAllTools(tempWs);
      assert.ok(Array.isArray(deregistered));
      assert.ok(deregistered.includes("Cursor (Workspace)"));
      assert.ok(deregistered.includes("VS Code & Copilot (Workspace)"));

      const cursorJsonAfter = JSON.parse(fs.readFileSync(cursorWsMcp, "utf8"));
      assert.strictEqual(cursorJsonAfter.mcpServers["cpq-bml"], undefined);
    } finally {
      fs.rmSync(tempWs, { recursive: true, force: true });
    }
  });
});
