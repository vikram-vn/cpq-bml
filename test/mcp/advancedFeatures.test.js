const assert = require("assert");
const http = require("http");
const { recordMcpRequest, getMcpTraffic, clearMcpTraffic } = require("../../app/lang/mcp/traffic");
const { auditBmlCode } = require("../../app/lang/mcp/tools/audit");
const { listDataTables, getDataTableSchema } = require("../../app/lang/mcp/tools/lookup");
const { startMcpServer, stopMcpServer } = require("../../app/lang/mcp/server");

suite("MCP Advanced Features Suite", () => {
  const mockVscode = {
    workspace: {
      getConfiguration: () => ({
        get: (_key, def) => def,
      }),
    },
    window: {
      createOutputChannel: () => ({
        appendLine: () => {},
        show: () => {},
        dispose: () => {},
      }),
    },
  };

  setup(() => {
    clearMcpTraffic();
  });

  teardown(() => {
    clearMcpTraffic();
  });

  suite("Traffic Inspector", () => {
    test("records MCP requests and returns history in reverse chronological order", () => {
      recordMcpRequest({
        tool: "query_bmql",
        durationMs: 42,
        success: true,
        argsSummary: "SELECT _part_number FROM _parts",
      });

      recordMcpRequest({
        tool: "audit_bml_code",
        durationMs: 15,
        success: false,
        error: "Code snippet cannot be empty",
      });

      const traffic = getMcpTraffic();
      assert.strictEqual(traffic.length, 2);
      assert.strictEqual(traffic[0].tool, "audit_bml_code");
      assert.strictEqual(traffic[0].success, false);
      assert.strictEqual(traffic[0].error, "Code snippet cannot be empty");
      assert.strictEqual(traffic[1].tool, "query_bmql");
      assert.strictEqual(traffic[1].success, true);
    });

    test("clearMcpTraffic empties the traffic buffer", () => {
      recordMcpRequest({ tool: "get_skill", durationMs: 5, success: true });
      assert.strictEqual(getMcpTraffic().length, 1);

      clearMcpTraffic();
      assert.strictEqual(getMcpTraffic().length, 0);
    });

    test("caps traffic buffer at 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        recordMcpRequest({
          tool: `test_tool_${i}`,
          durationMs: i,
          success: true,
        });
      }

      const traffic = getMcpTraffic();
      assert.strictEqual(traffic.length, 50);
      assert.strictEqual(traffic[0].tool, "test_tool_59");
      assert.strictEqual(traffic[49].tool, "test_tool_10");
    });
  });

  suite("BML Code Auditor", () => {
    test("scores clean BML code 100 with zero issues", () => {
      const cleanCode = `
        price = 100.0;
        discount = 0.15;
        finalPrice = price * (1.0 - discount);
        return finalPrice;
      `;
      const result = auditBmlCode({ code: cleanCode });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.score, 100);
      assert.strictEqual(result.passed, true);
      assert.strictEqual(result.issueCount, 0);
      assert.strictEqual(result.issues.length, 0);
    });

    test("detects dynamic string concatenation into BMQL (SQL Injection risk)", () => {
      const vulnerableCode = `
        partNum = "XYZ";
        records = bmql("SELECT price FROM _parts WHERE _part_number = '" + partNum + "'");
      `;
      const result = auditBmlCode({ code: vulnerableCode });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.passed, false);
      assert.ok(result.score < 100);

      const inj = result.issues.find((i) => i.id === "BMQL_INJECTION_RISK");
      assert.ok(inj, "Should flag BMQL_INJECTION_RISK");
      assert.strictEqual(inj.severity, "critical");
    });

    test("detects BMQL queries inside loops (N+1 query anti-pattern)", () => {
      const loopCode = `
        for item in lineItems {
          records = bmql("SELECT cost FROM prices WHERE sku = $sku");
        }
      `;
      const result = auditBmlCode({ code: loopCode });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.passed, false);

      const loopQuery = result.issues.find((i) => i.id === "BMQL_IN_LOOP");
      assert.ok(loopQuery, "Should flag BMQL_IN_LOOP");
      assert.strictEqual(loopQuery.severity, "high");
    });

    test("detects unbounded while loops (while true)", () => {
      const infiniteLoopCode = `
        while (true) {
          x = x + 1;
        }
      `;
      const result = auditBmlCode({ code: infiniteLoopCode });
      assert.strictEqual(result.success, true);

      const unbounded = result.issues.find((i) => i.id === "UNBOUNDED_LOOP");
      assert.ok(unbounded, "Should flag UNBOUNDED_LOOP");
      assert.strictEqual(unbounded.severity, "high");
    });

    test("rejects empty code input", () => {
      const result = auditBmlCode({ code: "" });
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  suite("Data Tables Lookup Tools", () => {
    test("listDataTables handles disconnected site gracefully", async () => {
      const context = {};
      const allRes = await listDataTables(context, mockVscode, {});
      // In offline / unconfigured mode, returns false with descriptive error message
      assert.strictEqual(allRes.success, false);
      assert.ok(allRes.error);
    });

    test("getDataTableSchema fails gracefully for missing tableName", async () => {
      const res = await getDataTableSchema({}, mockVscode, {});
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes("tableName"));
    });
  });

  suite("HTTP Server Health Endpoint", () => {
    const TEST_PORT = 47844;

    teardown(async () => {
      await stopMcpServer();
    });

    test("GET /health responds with 200 OK and server info", async () => {
      const context = {};
      const server = await startMcpServer(context, null, TEST_PORT);
      assert.ok(server.port);

      const res = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${server.port}/health`, (resp) => {
          let raw = "";
          resp.on("data", (chunk) => (raw += chunk));
          resp.on("end", () => {
            resolve({ statusCode: resp.statusCode, body: JSON.parse(raw) });
          });
        }).on("error", reject);
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, "healthy");
      assert.strictEqual(res.body.service, "cpq-bml-mcp");
      assert.strictEqual(res.body.port, server.port);
    });
  });
});
