"use strict";
/**
 * Shared constants, patterns, and stateless utilities for the BML tokenizer.
 * NOTE: readString / unescapeString are NOT here because they close over the
 * per-call `input` and `options` objects created inside Tokenizer().
 */

// Patterns
const NEWLINE = /\r\n|\n|\r/;
const ALL_NEWLINES = /\r\n|\n|\r/g;

const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/;
const NUMBER = /0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;

const DIRECTIVE_PATTERN = /beautify\s+(\w+):(\w+)/;

// Token types
const TOKEN = {
  START_EXPR: "TK_START_EXPR",
  END_EXPR: "TK_END_EXPR",
  START_BLOCK: "TK_START_BLOCK",
  END_BLOCK: "TK_END_BLOCK",
  ARRAY_START: "TK_ARRAY_START",
  ARRAY_END: "TK_ARRAY_END",
  WORD: "TK_WORD",
  RESERVED: "TK_RESERVED",
  SEMICOLON: "TK_SEMICOLON",
  STRING: "TK_STRING",
  EQUALS: "TK_EQUALS",
  OPERATOR: "TK_OPERATOR",
  COMMA: "TK_COMMA",
  DOT: "TK_DOT",
  COMMENT: "TK_COMMENT",
  BLOCK_COMMENT: "TK_BLOCK_COMMENT",
  UNKNOWN: "TK_UNKNOWN",
  EOF: "TK_EOF",
};

// Keyword sets
const line_starters = [
  "if",
  "elif",
  "else",
  "for",
  "return",
  "break",
  "continue",
];
const logical_words = ["and", "or", "not"];
const reserved_words = line_starters.concat(logical_words, [
  "true",
  "false",
  "null",
  "in",
]);
const reserved_word_pattern = new RegExp(
  "^(?:" + reserved_words.join("|") + ")$",
  "i",
);

// Operator sets
const positionable_operators = [
  "==",
  "!=",
  "<>",
  "<=",
  ">=",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
];
const OPERATOR_CHARS = ["=", "<", ">", "!", "+", "-", "*", "/", "%"];

const global_regex_cache = new Map();

function asGlobal(re) {
  if (re.global || re.sticky) return re;
  let cloned = global_regex_cache.get(re);
  if (!cloned) {
    cloned = new RegExp(re.source, re.flags + "g");
    global_regex_cache.set(re, cloned);
  }
  return cloned;
}

// Token factory
function Token(type, text, newlines, whitespace_before) {
  return {
    type,
    text,
    newlines: newlines || 0,
    whitespace_before: whitespace_before || "",
    comments_before: null,
    directives: null,
  };
}

// Input scanner
function InputScanner(source) {
  let pos = 0;
  const length = source.length;
  return {
    hasNext() {
      return pos < length;
    },
    peek(offset) {
      const i = pos + (offset || 0);
      return i >= 0 && i < length ? source.charAt(i) : null;
    },
    next() {
      if (pos >= length) return null;
      return source.charAt(pos++);
    },
    back() {
      if (pos > 0) pos -= 1;
    },
    match(re) {
      re = asGlobal(re);
      re.lastIndex = pos;
      const m = re.exec(source);
      if (m && m.index === pos) {
        pos += m[0].length;
        return m[0];
      }
      return null;
    },
    readUntil(re, include) {
      re = asGlobal(re);
      re.lastIndex = pos;
      const m = re.exec(source);
      const end = m ? (include ? m.index + m[0].length : m.index) : length;
      const result = source.substring(pos, end);
      pos = end;
      return result;
    },
  };
}

// Character helpers
function isIdentifierStart(c) {
  return c !== null && IDENTIFIER_START.test(c);
}
function isDigit(c) {
  return c !== null && c >= "0" && c <= "9";
}

// Directive parsing
function get_directives(comment_text) {
  const match = comment_text.match(DIRECTIVE_PATTERN);
  if (!match) return null;
  const directives = {};
  directives[match[1]] = match[2];
  return directives;
}

// Exports
module.exports = {
  NEWLINE,
  ALL_NEWLINES,
  IDENTIFIER_START,
  IDENTIFIER,
  NUMBER,
  DIRECTIVE_PATTERN,
  TOKEN,
  Token,
  line_starters,
  logical_words,
  reserved_words,
  reserved_word_pattern,
  positionable_operators,
  OPERATOR_CHARS,
  global_regex_cache,
  asGlobal,
  InputScanner,
  isIdentifierStart,
  isDigit,
  get_directives,
};
