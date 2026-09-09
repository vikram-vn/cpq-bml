const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { listSkills, getSkill } = require("../../app/lang/mcp/tools/knowledge");
const { registerMcpWithAllTools, deregisterMcpFromAllTools, getAiToolsStatus, isToolRegistered } = require("../../app/ai/setup/mcpAutoRegister");
const { startMcpServer, stopMcpServer } = require("../../app/lang/mcp/server");
const http = require("http");

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

  test("registerMcpWithAllTools skips unavailable paths and registers when paths are present", () => {
    const tempWs = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-mcp-autoreg-test-"));
    try {
      // 1. In an empty workspace without .cursor or .vscode, workspace configs should be skipped
      const initial = registerMcpWithAllTools(47821, tempWs);
      assert.ok(Array.isArray(initial.registered));
      assert.ok(Array.isArray(initial.skipped));
      assert.ok(initial.skipped.includes("Cursor (Workspace)"), "Cursor (Workspace) should be skipped when .cursor does not exist");
      assert.ok(initial.skipped.includes("VS Code & Copilot (Workspace)"), "VS Code (Workspace) should be skipped when .vscode does not exist");

      // 2. Now create the workspace directories so paths become available
      fs.mkdirSync(path.join(tempWs, ".cursor"), { recursive: true });
      fs.mkdirSync(path.join(tempWs, ".vscode"), { recursive: true });

      const res = registerMcpWithAllTools(47821, tempWs);
      assert.ok(res.registered.includes("Cursor (Workspace)"), "Cursor (Workspace) should be registered now that .cursor exists");
      assert.ok(res.registered.includes("VS Code & Copilot (Workspace)"), "VS Code (Workspace) should be registered now that .vscode exists");

      // Verify workspace config files were created
      const cursorWsMcp = path.join(tempWs, ".cursor", "mcp.json");
      assert.ok(fs.existsSync(cursorWsMcp), ".cursor/mcp.json should be created in workspace");
      const cursorJson = JSON.parse(fs.readFileSync(cursorWsMcp, "utf8"));
      assert.ok(cursorJson.mcpServers["cpq-bml"]);
      assert.strictEqual(cursorJson.mcpServers["cpq-bml"].url, "http://127.0.0.1:47821/mcp");

      const vscodeWsMcp = path.join(tempWs, ".vscode", "mcp.json");
      assert.ok(fs.existsSync(vscodeWsMcp), ".vscode/mcp.json should be created in workspace");
      const vscodeJson = JSON.parse(fs.readFileSync(vscodeWsMcp, "utf8"));
      assert.ok(vscodeJson.servers["cpq-bml"]);
      assert.strictEqual(vscodeJson.servers["cpq-bml"].url, "http://127.0.0.1:47821/mcp");

      // 3. Re-running with a changed port updates the configs
      const updated = registerMcpWithAllTools(49999, tempWs);
      assert.ok(updated.registered.includes("Cursor (Workspace)"));
      const updatedCursorJson = JSON.parse(fs.readFileSync(cursorWsMcp, "utf8"));
      assert.strictEqual(updatedCursorJson.mcpServers["cpq-bml"].url, "http://127.0.0.1:49999/mcp");

      // 4. Deregister cleanly removes cpq-bml
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

  test("registerMcpWithAllTools defaults to settings port when port is omitted", () => {
    const tempWs = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-mcp-default-port-"));
    try {
      fs.mkdirSync(path.join(tempWs, ".vscode"), { recursive: true });
      const res = registerMcpWithAllTools(undefined, tempWs);
      assert.ok(res.registered.includes("VS Code & Copilot (Workspace)"));
      const vscodeWsMcp = path.join(tempWs, ".vscode", "mcp.json");
      const json = JSON.parse(fs.readFileSync(vscodeWsMcp, "utf8"));
      assert.strictEqual(json.servers["cpq-bml"].url, "http://127.0.0.1:47821/mcp");
    } finally {
      fs.rmSync(tempWs, { recursive: true, force: true });
    }
  });

  test("getAiToolsStatus returns comprehensive status list for native tools", () => {
    const tempWs = fs.mkdtempSync(path.join(os.tmpdir(), "cpq-mcp-status-test-"));
    try {
      const tools = getAiToolsStatus(tempWs);
      assert.ok(Array.isArray(tools));
      assert.ok(tools.length >= 7);

      const keys = tools.map((t) => t.key);
      assert.ok(keys.includes("antigravity"));
      assert.ok(keys.includes("claudeDesktop"));
      assert.ok(keys.includes("chatgpt"));
      assert.ok(keys.includes("cursor"));
      assert.ok(keys.includes("cursorWs"));
      assert.ok(keys.includes("vscodeWs"));

      for (const t of tools) {
        assert.ok(typeof t.key === "string");
        assert.ok(typeof t.name === "string");
        assert.ok(typeof t.installed === "boolean");
        assert.ok(typeof t.registered === "boolean");
      }
    } finally {
      fs.rmSync(tempWs, { recursive: true, force: true });
    }
  });

  test("startMcpServer responds with 200 OK on GET /health", async () => {
    // Start on a random high test port
    const testPort = 48750 + Math.floor(Math.random() * 500);
    const server = await startMcpServer(context, null, testPort);
    assert.ok(server.port);

    try {
      const resData = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${server.port}/health`, (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          });
        }).on("error", reject);
      });

      assert.strictEqual(resData.statusCode, 200);
      assert.strictEqual(resData.data.status, "healthy");
      assert.strictEqual(resData.data.service, "cpq-bml-mcp");
      assert.strictEqual(resData.data.port, server.port);
    } finally {
      stopMcpServer();
    }
  });
});
