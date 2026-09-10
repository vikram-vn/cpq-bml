
const { BmlTestRunner } = require("../../test-controller/bmlTestRunner");

const generateBmlUnitTestTool = {
  name: "generate_bml_unit_test",
  description: "Scaffolds a complete .test.bml unit test file with mock inputs and assertions for an Oracle CPQ BML function.",
  inputSchema: {
    type: "object",
    properties: {
      functionName: {
        type: "string",
        description: "Name of the function to test (e.g. 'calculateDiscount').",
      },
      returnType: {
        type: "string",
        description: "Expected return type (e.g. 'Float', 'String', 'Boolean').",
      },
      description: {
        type: "string",
        description: "Brief description of the test objective.",
      },
    },
    required: ["functionName"],
  },
  handler: async (args) => {
    const fn = args.functionName;
    const retType = args.returnType || "Float";
    const desc = args.description || `Test suite for ${fn}`;

    const template = `// ============================================================================
// Unit Test: ${fn}
// Description: ${desc}
// ============================================================================

// @test "Should successfully execute ${fn} under normal conditions"
${retType.toLowerCase()} expectedResult = 100.0;
${retType.toLowerCase()} actualResult = util.${fn}();
assert.notNull(actualResult, "Result must not be null");
assert.equals(actualResult, expectedResult, "Result should match expected value");

// @test "Should handle edge cases and null parameters gracefully"
${retType.toLowerCase()} fallbackResult = util.${fn}();
assert.notNull(fallbackResult, "Fallback result must not be null");
`;

    return {
      content: [{ type: "text", text: template }],
    };
  },
};

const executeBmlTestSuiteTool = {
  name: "execute_bml_test_suite",
  description: "Runs BML unit test code containing @test annotations and assert statements, returning pass/fail metrics.",
  inputSchema: {
    type: "object",
    properties: {
      testCode: {
        type: "string",
        description: "BML test code content to execute.",
      },
    },
    required: ["testCode"],
  },
  handler: async (args) => {
    const code = args.testCode || "";
    const testCases = BmlTestRunner.extractTestCases(code);
    const results = [];

    for (const tc of testCases) {
      const codeToRun = tc.codeLines.join("\n");
      const res = BmlTestRunner.runTestCase(codeToRun);
      results.push({
        name: tc.name,
        line: tc.line,
        passed: res.passed,
        durationMs: res.durationMs,
        error: res.error || null,
        output: res.output,
      });
    }

    const allPassed = results.every((r) => r.passed);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: allPassed,
              totalTests: results.length,
              passed: results.filter((r) => r.passed).length,
              failed: results.filter((r) => !r.passed).length,
              results,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

module.exports = {
  generateBmlUnitTestTool,
  executeBmlTestSuiteTool,
};
