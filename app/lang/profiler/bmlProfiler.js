/**
 * BML Performance & Timeout Profiler
 * Static analyzer detecting critical performance bottlenecks and antipatterns in Oracle CPQ BML:
 * 1. BMQL inside loops (N+1 database query antipattern)
 * 2. Unsupported 'while' loops (BML only supports 'for' loops)
 * 3. String concatenation inside loops (causes memory thrashing / timeouts vs StringBuilder)
 * 4. Excessive loop nesting (> 3 levels)
 * 5. Excessive condition nesting (> 5 levels)
 * Strictly maintains under 500 lines of code.
 */

const { BmlLexer, TokenType } = require("../ast/bmlLexer");

class BmlProfiler {
  /**
   * Profiles BML source code and returns diagnostics list.
   * @param {string} source
   * @returns {Array<{line: number, column: number, severity: "warning"|"error"|"info", message: string, ruleId: string, fix?: any}>}
   */
  static profile(source = "") {
    const issues = [];
    const lines = source.split("\n");

    // 1. Check for unsupported 'while' keyword
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const match = lineText.match(/\bwhile\s*\(/);
      if (match) {
        issues.push({
          line: i + 1,
          column: match.index + 1,
          endLine: i + 1,
          endColumn: match.index + match[0].length + 1,
          severity: "error",
          ruleId: "bml-no-while-loop",
          message: "Unsupported 'while' loop detected. Oracle CPQ BML does not support 'while' loops; strictly use 'for item in array' or 'for i in range(n)'.",
        });
      }
    }

    // 2. Track loop depth, condition depth, and BMQL inside loops
    let loopDepth = 0;
    let blockDepth = 0;
    const loopStack = [];

    const lexer = new BmlLexer(source);
    const tokens = lexer.tokenize();

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Track 'for' loops
      if (token.type === TokenType.KEYWORD && token.value === "for") {
        loopDepth++;
        loopStack.push(token.line);

        if (loopDepth > 3) {
          issues.push({
            line: token.line,
            column: token.column,
            endLine: token.line,
            endColumn: token.column + 3,
            severity: "warning",
            ruleId: "bml-loop-nesting-limit",
            message: `Deep loop nesting (depth ${loopDepth}). BML guidelines mandate a maximum loop nesting depth of 3 to avoid script execution timeouts. Consider flattening or using helper functions.`,
          });
        }
      }

      // Track BMQL inside loops (Critical N+1 Antipattern)
      if (token.type === TokenType.KEYWORD && token.value === "bmql" && loopDepth > 0) {
        issues.push({
          line: token.line,
          column: token.column,
          endLine: token.line,
          endColumn: token.column + 4,
          severity: "error",
          ruleId: "bml-bmql-in-loop",
          message: "Critical Performance Bottleneck: BMQL database query detected inside a loop. Repeated database queries cause transaction timeouts (5-second limit). Fetch bulk data outside the loop into a RecordSet or Dictionary.",
        });
      }

      // Track string concatenation in loop (e.g. str = str + ... or str += ...)
      if (loopDepth > 0 && token.type === TokenType.OPERATOR && (token.value === "+=" || token.value === "+")) {
        const prev = tokens[i - 1];
        if (prev && prev.type === TokenType.IDENTIFIER && !["i", "idx", "count", "num", "total"].includes(prev.value.toLowerCase())) {
          issues.push({
            line: token.line,
            column: token.column,
            endLine: token.line,
            endColumn: token.column + token.value.length,
            severity: "info",
            ruleId: "bml-string-concat-in-loop",
            message: "Performance Hint: String concatenation inside a loop detected. Repeated string allocations in BML can degrade performance. Consider using 'stringbuilder' or array collections with join().",
          });
        }
      }

      // Track block entry / exit for depth tracking
      if (token.value === "{") {
        blockDepth++;
        if (blockDepth > 5) {
          issues.push({
            line: token.line,
            column: token.column,
            endLine: token.line,
            endColumn: token.column + 1,
            severity: "warning",
            ruleId: "bml-block-nesting-limit",
            message: `Excessive block nesting depth (${blockDepth}). BML style standards recommend keeping nesting depth at 5 or lower.`,
          });
        }
      } else if (token.value === "}") {
        if (blockDepth > 0) blockDepth--;
        if (loopDepth > 0) {
          loopDepth--;
          loopStack.pop();
        }
      }
    }

    return issues;
  }
}

module.exports = {
  BmlProfiler,
};
