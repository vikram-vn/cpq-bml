/**
 * BML Test Runner
 * Executes BML unit tests with assertion checking and mock interception.
 * Supports assertions: assert.equals(a, b), assert.isTrue(cond), assert.notNull(val)
 * Strictly maintains under 500 lines of code.
 */

const vm = require("vm");

function createBmlSandbox(stdout = []) {
  const sandbox = {
    print: (...args) => {
      const formatted = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      stdout.push(formatted);
    },
    len: (val) => (val && val.length !== undefined ? val.length : 0),
    substring: (str, start, end) => {
      if (typeof str !== "string") return "";
      return end !== undefined ? str.substring(start, end) : str.substring(start);
    },
    startswith: (str, prefix) => (typeof str === "string" && typeof prefix === "string" ? str.startsWith(prefix) : false),
    endswith: (str, suffix) => (typeof str === "string" && typeof suffix === "string" ? str.endsWith(suffix) : false),
    lower: (str) => (typeof str === "string" ? str.toLowerCase() : ""),
    upper: (str) => (typeof str === "string" ? str.toUpperCase() : ""),
    replace: (str, target, replacement) => (typeof str === "string" ? str.split(target).join(replacement) : ""),
    split: (str, delim) => (typeof str === "string" ? str.split(delim) : []),
    find: (str, sub, start) => (typeof str === "string" ? str.indexOf(sub, start || 0) : -1),
    atoi: (str) => parseInt(str, 10) || 0,
    atof: (str) => parseFloat(str) || 0.0,
    string: (val) => (val !== undefined && val !== null ? String(val) : ""),
    sizeofarray: (arr) => (Array.isArray(arr) ? arr.length : 0),
    findinarray: (arr, val) => (Array.isArray(arr) ? arr.indexOf(val) : -1),
    range: (count) => (typeof count === "number" ? Array.from({ length: count }, (_, i) => i) : []),
    abs: (n) => Math.abs(n),
    round: (n, decimals = 0) => {
      const factor = Math.pow(10, decimals);
      return Math.round(n * factor) / factor;
    },
    min: (a, b) => Math.min(a, b),
    max: (a, b) => Math.max(a, b),
    sqrt: (n) => Math.sqrt(n),
    pow: (a, b) => Math.pow(a, b),
    getdate: () => new Date(),
    datetostr: (d) => (d instanceof Date ? d.toISOString().split("T")[0] : String(d)),
    minusdays: (d, days) => new Date(d.getTime() - days * 86400000),
    adddays: (d, days) => new Date(d.getTime() + days * 86400000),
    dict: () => new Map(),
    put: (d, key, val) => {
      if (d instanceof Map) d.set(key, val);
      else if (typeof d === "object" && d !== null) d[key] = val;
      return d;
    },
    get: (d, key) => {
      if (d instanceof Map) return d.get(key);
      if (typeof d === "object" && d !== null) return d[key];
      return undefined;
    },
    containskey: (d, key) => {
      if (d instanceof Map) return d.has(key);
      if (typeof d === "object" && d !== null) return Object.prototype.hasOwnProperty.call(d, key);
      return false;
    },
    remove: (d, key) => {
      if (d instanceof Map) d.delete(key);
      else if (typeof d === "object" && d !== null) delete d[key];
      return d;
    },
    json: (str) => {
      try { return str ? JSON.parse(str) : {}; } catch { return {}; }
    },
    jsonarray: (str) => {
      try { return str ? JSON.parse(str) : []; } catch { return []; }
    },
    jsonget: (obj, key) => (obj && typeof obj === "object" ? obj[key] : undefined),
    jsonput: (obj, key, val) => {
      if (obj && typeof obj === "object") obj[key] = val;
      return obj;
    },
    jsonarrayappend: (arr, val) => {
      if (Array.isArray(arr)) arr.push(val);
      return arr;
    },
    stringbuilder: () => ({
      _buf: [],
      append: function (str) { this._buf.push(String(str)); return this; },
      toString: function () { return this._buf.join(""); }
    }),
    sbappend: (sb, str) => {
      if (sb && typeof sb.append === "function") sb.append(str);
      return sb;
    }
  };
  return vm.createContext(sandbox);
}

function preprocessBmlForJs(code) {
  let js = code;
  js = js.replace(/\belif\b/g, "else if");
  js = js.replace(/\bfor\s+([a-zA-Z_]\w*)\s+in\s+([a-zA-Z_]\w*)\s*\{/g, "for (const $1 of $2) {");
  js = js.replace(/\b(?:String|Integer|Float|Boolean|Date|Dict|JsonArray|JsonObject|StringBuilder|recordset)\s+([a-zA-Z_]\w*)\s*=/g, "let $1 =");
  if (/\breturn\b/.test(js)) {
    js = `(function() {\n${js}\n})()`;
  }
  return js;
}

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
