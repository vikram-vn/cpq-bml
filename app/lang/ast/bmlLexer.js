/**
 * BML Lexer / Tokenizer
 * Tokenizes BML source code into structured tokens strictly adhering to Oracle CPQ BML specifications:
 * - NO 'while' loop (BML only supports 'for' loops)
 * - Logical operators: AND, OR, NOT (never &&, ||, !)
 * - Comparison operators: ==, <>, <=, >=, <, >
 * - Sized array & literal instantiations: String[], Integer[][], etc.
 * Strictly maintains under 500 lines of code.
 */

const TokenType = {
  KEYWORD: "KEYWORD",
  IDENTIFIER: "IDENTIFIER",
  NUMBER: "NUMBER",
  STRING: "STRING",
  OPERATOR: "OPERATOR",
  PUNCTUATION: "PUNCTUATION",
  COMMENT: "COMMENT",
  EOF: "EOF",
};

// Official Oracle CPQ BML keywords - notice NO 'while', NO 'var/let/const'
const KEYWORDS = new Set([
  "if", "elif", "else", "for", "in", "return", "break", "continue",
  "print", "true", "false", "null", "bmql",
  "and", "or", "not",
  "string", "integer", "float", "boolean", "date",
  "dict", "json", "jsonarray", "recordset"
]);

class Token {
  constructor(type, value, line, column, startOffset, endOffset) {
    this.type = type;
    this.value = value;
    this.line = line; // 1-indexed
    this.column = column; // 1-indexed
    this.startOffset = startOffset;
    this.endOffset = endOffset;
  }
}

class BmlLexer {
  constructor(source = "") {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.length = source.length;
  }

  tokenize() {
    const tokens = [];
    while (this.pos < this.length) {
      const ch = this.source[this.pos];

      // Whitespace
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }
      if (ch === "\n") {
        this.line++;
        this.column = 1;
        this.pos++;
        continue;
      }

      // Single-line and multi-line comments
      if (ch === "/" && this.peek() === "/") {
        tokens.push(this.readSingleLineComment());
        continue;
      }
      if (ch === "/" && this.peek() === "*") {
        tokens.push(this.readMultiLineComment());
        continue;
      }

      // Strings (double quotes or single quotes)
      if (ch === '"' || ch === "'") {
        tokens.push(this.readString(ch));
        continue;
      }

      // Numbers
      if (this.isDigit(ch)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers / Keywords (Case-insensitive check for AND, OR, NOT)
      if (this.isIdentStart(ch)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Multi-character operators: ==, <>, <=, >=, +=, -=, *=, /=
      const twoChar = ch + (this.peek() || "");
      if (["==", "<>", "!=", "<=", ">=", "+=", "-=", "*=", "/="].includes(twoChar)) {
        const startLine = this.line;
        const startCol = this.column;
        const startOffset = this.pos;
        this.advance();
        this.advance();
        tokens.push(new Token(TokenType.OPERATOR, twoChar, startLine, startCol, startOffset, this.pos));
        continue;
      }

      // Single character operators & punctuations
      if ("+-*/%=<>".includes(ch)) {
        tokens.push(new Token(TokenType.OPERATOR, ch, this.line, this.column, this.pos, this.pos + 1));
        this.advance();
        continue;
      }

      if ("(){}[];,.:$".includes(ch)) {
        tokens.push(new Token(TokenType.PUNCTUATION, ch, this.line, this.column, this.pos, this.pos + 1));
        this.advance();
        continue;
      }

      // Advance unrecognized character
      this.advance();
    }

    tokens.push(new Token(TokenType.EOF, "", this.line, this.column, this.pos, this.pos));
    return tokens;
  }

  peek(offset = 1) {
    const idx = this.pos + offset;
    return idx < this.length ? this.source[idx] : null;
  }

  advance() {
    this.pos++;
    this.column++;
  }

  isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  isIdentStart(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  isIdentPart(ch) {
    return this.isIdentStart(ch) || this.isDigit(ch);
  }

  readSingleLineComment() {
    const startLine = this.line;
    const startCol = this.column;
    const startOffset = this.pos;
    let text = "";
    while (this.pos < this.length && this.source[this.pos] !== "\n") {
      text += this.source[this.pos];
      this.advance();
    }
    return new Token(TokenType.COMMENT, text, startLine, startCol, startOffset, this.pos);
  }

  readMultiLineComment() {
    const startLine = this.line;
    const startCol = this.column;
    const startOffset = this.pos;
    let text = "/*";
    this.advance(); // /
    this.advance(); // *
    while (this.pos < this.length) {
      if (this.source[this.pos] === "*" && this.peek() === "/") {
        text += "*/";
        this.advance();
        this.advance();
        break;
      }
      if (this.source[this.pos] === "\n") {
        this.line++;
        this.column = 0;
      }
      text += this.source[this.pos];
      this.advance();
    }
    return new Token(TokenType.COMMENT, text, startLine, startCol, startOffset, this.pos);
  }

  readString(quote) {
    const startLine = this.line;
    const startCol = this.column;
    const startOffset = this.pos;
    let text = quote;
    this.advance();
    while (this.pos < this.length) {
      const ch = this.source[this.pos];
      if (ch === "\\") {
        text += ch;
        this.advance();
        if (this.pos < this.length) {
          text += this.source[this.pos];
          this.advance();
        }
        continue;
      }
      if (ch === quote) {
        text += quote;
        this.advance();
        break;
      }
      if (ch === "\n") {
        this.line++;
        this.column = 0;
      }
      text += ch;
      this.advance();
    }
    return new Token(TokenType.STRING, text, startLine, startCol, startOffset, this.pos);
  }

  readNumber() {
    const startLine = this.line;
    const startCol = this.column;
    const startOffset = this.pos;
    let text = "";
    while (this.pos < this.length && this.isDigit(this.source[this.pos])) {
      text += this.source[this.pos];
      this.advance();
    }
    if (this.source[this.pos] === "." && this.isDigit(this.peek() || "")) {
      text += ".";
      this.advance();
      while (this.pos < this.length && this.isDigit(this.source[this.pos])) {
        text += this.source[this.pos];
        this.advance();
      }
    }
    return new Token(TokenType.NUMBER, text, startLine, startCol, startOffset, this.pos);
  }

  readIdentifier() {
    const startLine = this.line;
    const startCol = this.column;
    const startOffset = this.pos;
    let text = "";
    while (this.pos < this.length && this.isIdentPart(this.source[this.pos])) {
      text += this.source[this.pos];
      this.advance();
    }
    const lower = text.toLowerCase();
    let type = TokenType.IDENTIFIER;

    if (lower === "and" || lower === "or" || lower === "not") {
      type = TokenType.OPERATOR;
    } else if (KEYWORDS.has(lower)) {
      type = TokenType.KEYWORD;
    }

    return new Token(type, text, startLine, startCol, startOffset, this.pos);
  }
}

module.exports = {
  TokenType,
  Token,
  BmlLexer,
};
