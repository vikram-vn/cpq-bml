/**
 * BML Test Runner
 * Executes BML unit tests with assertion checking and mock interception.
 * Supports assertions: assert.equals(a, b), assert.isTrue(cond), assert.notNull(val)
 * Strictly maintains under 500 lines of code.
 */

const { createBmlSandbox, preprocessBmlForJs } = require("../evaluator/bmlEvaluator");
const vm = require("vm");

/**
 * Parses test cases from a test file text.
 * Looks for `@test "description"` blocks or standalone test functions.
 */
function extractTestCases(content = "") {
  const lines = content.split(/\r?\n/);
  const tests = [];
  let currentTest = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const testMatch = line.match(/\/\/\s*@test\s+["']([^"']+)["']/i);
    if (testMatch) {
      if (currentTest) tests.push(currentTest);
      currentTest = {
        name: testMatch[1],
        line: i + 1,
        codeLines: [],
      };
    } else if (currentTest) {
      currentTest.codeLines.push(line);
    }
  }

  if (currentTest) tests.push(currentTest);

  // If no @test annotations, treat the entire file as a single test case
  if (tests.length === 0 && content.trim().length > 0) {
    tests.push({
      name: "Default Test Suite",
      line: 1,
      codeLines: lines,
    });
  }

  return tests;
}

/**
 * Executes a single test case code string.
 */
function runTestCase(code, timeoutMs = 3000) {
  const stdout = [];
  const sandbox = createBmlSandbox(stdout);

  // Add BML assertions
  sandbox.assert = {
    equals: (actual, expected, message) => {
      const aStr = typeof actual === "object" ? JSON.stringify(actual) : String(actual);
      const eStr = typeof expected === "object" ? JSON.stringify(expected) : String(expected);
      if (aStr !== eStr) {
        throw new Error(message || `Assertion failed: expected ${eStr} but got ${aStr}`);
      }
    },
    isTrue: (condition, message) => {
      if (!condition) {
        throw new Error(message || "Assertion failed: condition is not true");
      }
    },
    notNull: (value, message) => {
      if (value === null || value === undefined) {
        throw new Error(message || "Assertion failed: value is null or undefined");
      }
    },
  };

  const startTime = Date.now();
  try {
    const transformed = preprocessBmlForJs(code);
    const script = new vm.Script(transformed, { filename: "test.bml" });
    const result = script.runInContext(sandbox, { timeout: timeoutMs });
    const durationMs = Date.now() - startTime;

    return {
      passed: true,
      durationMs,
      returnValue: result,
      output: stdout,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      passed: false,
      durationMs,
      error: err.message,
      output: stdout,
    };
  }
}

/**
 * Identifies executable statement line numbers in a BML source file.
 */
function getExecutableLines(code = "") {
  const lines = code.split(/\r?\n/);
  const executable = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("/*")) {
      inBlockComment = true;
    }
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("//")) continue;

    // Filter out pure structural closing braces
    if (line === "}" || line === "};" || line === "else {" || line === "else") {
      continue;
    }

    executable.push(i + 1);
  }
  return executable;
}

/**
 * Computes statement line coverage from executed line numbers.
 */
function computeCoverage(totalExecutableLines, executedLines) {
  const coveredSet = new Set(executedLines);
  const covered = totalExecutableLines.filter((l) => coveredSet.has(l));
  const uncovered = totalExecutableLines.filter((l) => !coveredSet.has(l));
  const percentage =
    totalExecutableLines.length > 0
      ? Math.round((covered.length / totalExecutableLines.length) * 100)
      : 100;

  return {
    covered,
    uncovered,
    totalLines: totalExecutableLines.length,
    percentage,
  };
}

const BmlTestRunner = {
  extractTestCases,
  runTestCase,
  getExecutableLines,
  computeCoverage,
};

module.exports = {
  extractTestCases,
  runTestCase,
  getExecutableLines,
  computeCoverage,
  BmlTestRunner,
};
