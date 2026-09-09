/**
 * BML Parser
 * Parses token streams from BmlLexer into an Abstract Syntax Tree (AST).
 * Strictly adheres to Oracle CPQ BML specifications:
 * - NO 'while' loop (BML only supports 'for' loops)
 * - Logical operators: AND, OR, NOT
 * - Comparison operators: ==, <>, <=, >=, <, >
 * Strictly maintains under 500 lines of code.
 */

const { BmlLexer, TokenType } = require("./bmlLexer");

class BmlParser {
  constructor(tokens = []) {
    this.tokens = tokens;
    this.pos = 0;
  }

  static parse(source) {
    const lexer = new BmlLexer(source);
    const tokens = lexer.tokenize();
    const parser = new BmlParser(tokens);
    return parser.parseProgram();
  }

  current() {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: "" };
  }

  peek(offset = 1) {
    return this.tokens[this.pos + offset] || { type: TokenType.EOF, value: "" };
  }

  advance() {
    const t = this.current();
    this.pos++;
    return t;
  }

  match(type, value) {
    const cur = this.current();
    if (cur.type === type && (value === undefined || cur.value === value)) {
      return this.advance();
    }
    return null;
  }

  parseProgram() {
    const body = [];
    while (this.current().type !== TokenType.EOF) {
      if (this.current().type === TokenType.COMMENT) {
        this.advance();
        continue;
      }
      const stmt = this.parseStatement();
      if (stmt) {
        body.push(stmt);
      } else {
        this.advance(); // Skip on unexpected token to recover
      }
    }
    return {
      type: "Program",
      body,
      tokens: this.tokens,
    };
  }

  parseStatement() {
    const cur = this.current();

    // Conditionals: if / elif / else
    if (cur.type === TokenType.KEYWORD && cur.value === "if") {
      return this.parseIfStatement();
    }

    // Loops: BML only supports 'for' loops (for item in array)
    if (cur.type === TokenType.KEYWORD && cur.value === "for") {
      return this.parseForLoop();
    }

    // Return
    if (cur.type === TokenType.KEYWORD && cur.value === "return") {
      return this.parseReturnStatement();
    }

    // Print
    if (cur.type === TokenType.KEYWORD && cur.value === "print") {
      return this.parsePrintStatement();
    }

    // BMQL statement: bmql select ... ;
    if (cur.type === TokenType.KEYWORD && cur.value === "bmql") {
      return this.parseBmqlStatement();
    }

    // Block statement { ... }
    if (cur.type === TokenType.PUNCTUATION && cur.value === "{") {
      return this.parseBlock();
    }

    // Assignment or Expression statement
    return this.parseExpressionOrAssignment();
  }

  parseIfStatement() {
    const ifToken = this.advance(); // "if"
    this.match(TokenType.PUNCTUATION, "(");
    const test = this.parseExpression();
    this.match(TokenType.PUNCTUATION, ")");

    const consequent = this.parseStatement();
    let alternate = null;

    if (this.current().type === TokenType.KEYWORD && (this.current().value === "elif" || this.current().value === "else")) {
      const branch = this.advance();
      if (branch.value === "elif") {
        alternate = this.parseIfStatement();
      } else {
        alternate = this.parseStatement();
      }
    }

    return {
      type: "IfStatement",
      test,
      consequent,
      alternate,
      line: ifToken.line,
      column: ifToken.column,
    };
  }

  parseForLoop() {
    const forToken = this.advance(); // "for"
    this.match(TokenType.PUNCTUATION, "(");
    let iterator = null;
    if (this.current().type === TokenType.IDENTIFIER) {
      iterator = this.advance().value;
    }
    // "in" keyword
    if (this.current().value.toLowerCase() === "in" || this.current().value === ":") {
      this.advance();
    }
    const collection = this.parseExpression();
    this.match(TokenType.PUNCTUATION, ")");

    const body = this.parseStatement();

    return {
      type: "ForLoop",
      iterator,
      collection,
      body,
      line: forToken.line,
      column: forToken.column,
    };
  }

  parseReturnStatement() {
    const retToken = this.advance(); // "return"
    let argument = null;
    if (this.current().value !== ";") {
      argument = this.parseExpression();
    }
    this.match(TokenType.PUNCTUATION, ";");
    return {
      type: "ReturnStatement",
      argument,
      line: retToken.line,
      column: retToken.column,
    };
  }

  parsePrintStatement() {
    const printToken = this.advance(); // "print"
    let expr = null;
    if (this.current().value !== ";") {
      expr = this.parseExpression();
    }
    this.match(TokenType.PUNCTUATION, ";");
    return {
      type: "PrintStatement",
      expression: expr,
      line: printToken.line,
      column: printToken.column,
    };
  }

  parseBmqlStatement() {
    const bmqlToken = this.advance(); // "bmql"
    let query = "";
    while (this.current().type !== TokenType.EOF && this.current().value !== ";") {
      query += this.current().value + " ";
      this.advance();
    }
    this.match(TokenType.PUNCTUATION, ";");
    return {
      type: "BMQLStatement",
      query: query.trim(),
      line: bmqlToken.line,
      column: bmqlToken.column,
    };
  }

  parseBlock() {
    const openToken = this.advance(); // {
    const statements = [];
    while (this.current().type !== TokenType.EOF && this.current().value !== "}") {
      if (this.current().type === TokenType.COMMENT) {
        this.advance();
        continue;
      }
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
      else this.advance();
    }
    this.match(TokenType.PUNCTUATION, "}");
    return {
      type: "BlockStatement",
      body: statements,
      line: openToken.line,
      column: openToken.column,
    };
  }

  parseExpressionOrAssignment() {
    const expr = this.parseExpression();
    if (!expr) return null;

    if (this.current().type === TokenType.OPERATOR && ["=", "+=", "-=", "*=", "/="].includes(this.current().value)) {
      const op = this.advance().value;
      const val = this.parseExpression();
      this.match(TokenType.PUNCTUATION, ";");
      return {
        type: "AssignmentExpression",
        left: expr,
        operator: op,
        right: val,
        line: expr.line,
        column: expr.column,
      };
    }

    this.match(TokenType.PUNCTUATION, ";");
    return {
      type: "ExpressionStatement",
      expression: expr,
      line: expr.line,
      column: expr.column,
    };
  }

  parseExpression() {
    return this.parseBinaryExpression(0);
  }

  parseBinaryExpression(precedence) {
    let left = this.parsePrimary();
    while (this.current().type === TokenType.OPERATOR) {
      const op = this.current().value;
      const curPrec = this.getOperatorPrecedence(op);
      if (curPrec < precedence) break;
      this.advance();
      const right = this.parseBinaryExpression(curPrec + 1);
      left = {
        type: "BinaryExpression",
        operator: op,
        left,
        right,
        line: left ? left.line : 1,
      };
    }
    return left;
  }

  getOperatorPrecedence(op) {
    const lower = op.toLowerCase();
    if (lower === "or") return 1;
    if (lower === "and") return 2;
    if (["==", "<>", "!=", "<", ">", "<=", ">="].includes(op)) return 3;
    if (["+", "-"].includes(op)) return 4;
    if (["*", "/", "%"].includes(op)) return 5;
    return 0;
  }

  parsePrimary() {
    const cur = this.current();

    // NOT(condition) unary or function
    if (cur.type === TokenType.OPERATOR && cur.value.toLowerCase() === "not") {
      const notToken = this.advance();
      const arg = this.parsePrimary();
      return {
        type: "UnaryExpression",
        operator: "NOT",
        argument: arg,
        line: notToken.line,
        column: notToken.column,
      };
    }

    if (cur.type === TokenType.NUMBER) {
      this.advance();
      return { type: "Literal", value: Number(cur.value), raw: cur.value, line: cur.line, column: cur.column };
    }
    if (cur.type === TokenType.STRING) {
      this.advance();
      return { type: "Literal", value: cur.value.slice(1, -1), raw: cur.value, line: cur.line, column: cur.column };
    }
    if (cur.type === TokenType.KEYWORD && ["true", "false", "null"].includes(cur.value)) {
      this.advance();
      return { type: "Literal", value: cur.value === "true" ? true : cur.value === "false" ? false : null, line: cur.line, column: cur.column };
    }

    // Grouping: (expr)
    if (cur.type === TokenType.PUNCTUATION && cur.value === "(") {
      this.advance();
      const expr = this.parseExpression();
      this.match(TokenType.PUNCTUATION, ")");
      return expr;
    }

    // Identifiers, Array Instantiations (String[]{...}), and Function Calls
    if (cur.type === TokenType.IDENTIFIER || cur.type === TokenType.KEYWORD) {
      const ident = this.advance();
      let node = { type: "Identifier", name: ident.value, line: ident.line, column: ident.column };

      // Check for array literal/size: String[]{ "a", "b" } or String[10]
      if (this.current().value === "[") {
        this.advance();
        let sizeExpr = null;
        if (this.current().value !== "]") {
          sizeExpr = this.parseExpression();
        }
        this.match(TokenType.PUNCTUATION, "]");
        // Literal elements: { ... }
        let elements = null;
        if (this.current().value === "{") {
          this.advance();
          elements = [];
          while (this.current().type !== TokenType.EOF && this.current().value !== "}") {
            const el = this.parseExpression();
            if (el) elements.push(el);
            if (this.current().value === ",") this.advance();
          }
          this.match(TokenType.PUNCTUATION, "}");
        }
        return {
          type: "ArrayInstantiation",
          elementType: ident.value,
          size: sizeExpr,
          elements,
          line: ident.line,
          column: ident.column,
        };
      }

      // Member access or function call
      while (true) {
        if (this.current().value === ".") {
          this.advance();
          const prop = this.match(TokenType.IDENTIFIER);
          if (prop) {
            node = { type: "MemberExpression", object: node, property: prop.value, line: prop.line, column: prop.column };
          }
        } else if (this.current().value === "(") {
          this.advance();
          const args = [];
          while (this.current().type !== TokenType.EOF && this.current().value !== ")") {
            const arg = this.parseExpression();
            if (arg) args.push(arg);
            if (this.current().value === ",") this.advance();
          }
          this.match(TokenType.PUNCTUATION, ")");
          node = { type: "CallExpression", callee: node, arguments: args, line: node.line, column: node.column };
        } else if (this.current().value === "[") {
          this.advance();
          const index = this.parseExpression();
          this.match(TokenType.PUNCTUATION, "]");
          node = { type: "IndexExpression", object: node, index, line: node.line, column: node.column };
        } else {
          break;
        }
      }
      return node;
    }

    return null;
  }
}

module.exports = {
  BmlParser,
};
