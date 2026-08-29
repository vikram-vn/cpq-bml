"use strict";
// BML tokenizer. Constants, patterns, and stateless helpers live in tokenizerHelpers.js.

const { loadBuiltInFunctionsJson } = require("../../intellisense/apiDataLoader");

const {
  NEWLINE,
  ALL_NEWLINES,
  IDENTIFIER,
  NUMBER,
  TOKEN,
  Token,
  line_starters, // re-exported in module.exports below
  logical_words,
  reserved_word_pattern,
  positionable_operators,
  OPERATOR_CHARS,
  get_directives,
  InputScanner,
  isIdentifierStart,
  isDigit,
} = require("./tokenizerHelpers");

// Loaded lazily (on first tokenize call, not at module require time) and
// shared with lint/functions.js via apiDataLoader, instead of parsing the
// ~200KB builtin-functions JSON eagerly during activation.
let _builtinFunctionsSet = null;
function getBuiltinFunctionsSet() {
  if (!_builtinFunctionsSet) {
    _builtinFunctionsSet = new Set(Object.keys(loadBuiltInFunctionsJson()));
  }
  return _builtinFunctionsSet;
}

const BMQL_START_PATTERN = /^(?:select\s|modify\s|update\s|insert\s+into\s|delete\s+from\s)/i;

function formatBmqlQuery(content) {
  if (!BMQL_START_PATTERN.test(content.trim())) {
    return content;
  }
  return content.replace(
    /(\$[_A-Za-z0-9]+|'[^']*'|"[^"]*"|\b(?:select|from|where|order\s+by|group\s+by|having|limit|inner\s+join|left\s+join|join|on|and|or|not|in|like|is\s+null|is\s+not\s+null|modify|update|set|insert\s+into|values|delete\s+from|asc|desc|distinct|as)\b)/gi,
    (match, group) => {
      if (group.startsWith("$") || group.startsWith("'") || group.startsWith('"')) {
        return group;
      }
      return group.toUpperCase();
    }
  );
}

function makeStringReaders(input, options) {
  function unescapeString(s) {
    let out = "";
    const scan = InputScanner(s);
    while (scan.hasNext()) {
      let m = scan.match(/\\x([0-9A-Fa-f]{2})/);
      if (m) {
        out += String.fromCharCode(parseInt(m.slice(2), 16));
        continue;
      }
      m = scan.match(/\\u([0-9A-Fa-f]{4})/);
      if (m) {
        out += String.fromCharCode(parseInt(m.slice(2), 16));
        continue;
      }
      m = scan.match(/\\(.)/);
      if (m) {
        out += m.slice(1);
        continue;
      }
      out += scan.next();
    }
    return out;
  }

  function readString(quote) {
    let text = quote;
    input.next();
    let has_escapes = false;
    while (input.hasNext()) {
      const c = input.next();
      text += c;
      if (c === quote) {
        break;
      } else if (c === "\\" && input.hasNext()) {
        const escaped = input.next();
        if (escaped === "x" || escaped === "u") has_escapes = true;
        text += escaped;
      } else if (NEWLINE.test(c)) {
        break;
      }
    }
    if (has_escapes && options.unescape_strings) {
      text = unescapeString(text);
    }
    if (options.format_bmql_strings !== false && text.length > 2) {
      const inner = text.slice(1, -1);
      const formatted = formatBmqlQuery(inner);
      if (formatted !== inner) {
        text = text.charAt(0) + formatted + text.charAt(text.length - 1);
      }
    }
    return text;
  }

  return { readString };
}

function Tokenizer(source_text, options) {
  const input = InputScanner(source_text || "");
  options = options || {};

  const { readString } = makeStringReaders(input, options);

  // Tracks only the last real token, used to recognise `Type[]{` / `Type[n]{` array literals.
  let last_real_token = null;
  const bracket_stack = [];
  const brace_stack = [];

  function consumeWhitespace() {
    let newlines = 0;
    let whitespace_before = "";
    for (;;) {
      const c = input.peek();
      if (c === " " || c === "\t") {
        whitespace_before += input.next();
      } else if (input.match(NEWLINE)) {
        newlines += 1;
        whitespace_before = "";
      } else {
        break;
      }
    }
    return { newlines, whitespace_before };
  }

  // Detects `Type[]{` / `Type[n]{` and nested 2D `{ {1,2}, {3,4} }` so the `{...}` body is formatted as a value list, not a code block.
  function is_array_literal_start() {
    if (
      last_real_token &&
      last_real_token.type === TOKEN.END_EXPR &&
      last_real_token.text === "]" &&
      last_real_token.opened &&
      last_real_token.opened.preceded_by_word
    ) {
      return true;
    }
    // Inner rows of a 2D array literal: { {1, 2}, {3, 4} }
    if (
      brace_stack.length > 0 &&
      brace_stack[brace_stack.length - 1] === true &&
      last_real_token &&
      (last_real_token.type === TOKEN.ARRAY_START ||
        last_real_token.type === TOKEN.COMMA)
    ) {
      return true;
    }
    return false;
  }

  function finish(token, track) {
    if (track !== false) {
      if (
        token.type === TOKEN.START_EXPR &&
        token.text === "[" &&
        last_real_token &&
        (last_real_token.type === TOKEN.WORD ||
          (last_real_token.type === TOKEN.END_EXPR &&
            last_real_token.text === "]"))
      ) {
        token.preceded_by_word = true;
      }
    }
    last_real_token = token;
    return token;
  }

  function get_next_token() {
    const ws = consumeWhitespace();
    const c = input.peek();

    if (c === null)
      return finish(Token(TOKEN.EOF, "", ws.newlines, ws.whitespace_before));

    if (c === '"' || c === "'") {
      return finish(
        Token(TOKEN.STRING, readString(c), ws.newlines, ws.whitespace_before),
      );
    }

    if (c === "/" && input.peek(1) === "/") {
      return finish(
        Token(
          TOKEN.COMMENT,
          input.readUntil(NEWLINE, false),
          ws.newlines,
          ws.whitespace_before,
        ),
      );
    }

    if (c === "/" && input.peek(1) === "*") {
      input.next();
      input.next();
      let text = "/*" + input.readUntil(/\*\//, true);
      const directives = get_directives(text);
      if (directives && directives.ignore === "start") {
        text += input.readUntil(/\/\*\s*beautify\s+ignore:end\s*\*\//, true);
      }
      text = text.replace(ALL_NEWLINES, "\n");
      const token = Token(
        TOKEN.BLOCK_COMMENT,
        text,
        ws.newlines,
        ws.whitespace_before,
      );
      token.directives = directives;
      return finish(token);
    }

    if (c === "(" || c === "[") {
      const token = Token(
        TOKEN.START_EXPR,
        c,
        ws.newlines,
        ws.whitespace_before,
      );
      bracket_stack.push(token);
      input.next();
      return finish(token);
    }
    if (c === ")" || c === "]") {
      const opener = bracket_stack.pop();
      const token = Token(TOKEN.END_EXPR, c, ws.newlines, ws.whitespace_before);
      token.opened = opener;
      input.next();
      return finish(token);
    }

    if (c === "{") {
      const is_array = is_array_literal_start();
      const token = Token(
        is_array ? TOKEN.ARRAY_START : TOKEN.START_BLOCK,
        c,
        ws.newlines,
        ws.whitespace_before,
      );
      brace_stack.push(is_array);
      input.next();
      return finish(token, false);
    }
    if (c === "}") {
      const is_array = brace_stack.pop();
      const token = Token(
        is_array ? TOKEN.ARRAY_END : TOKEN.END_BLOCK,
        c,
        ws.newlines,
        ws.whitespace_before,
      );
      input.next();
      return finish(token, false);
    }

    if (c === ";") {
      input.next();
      return finish(
        Token(TOKEN.SEMICOLON, ";", ws.newlines, ws.whitespace_before),
      );
    }
    if (c === ",") {
      input.next();
      return finish(Token(TOKEN.COMMA, ",", ws.newlines, ws.whitespace_before));
    }
    if (c === "." && !isDigit(input.peek(1))) {
      input.next();
      return finish(Token(TOKEN.DOT, ".", ws.newlines, ws.whitespace_before));
    }

    if (isIdentifierStart(c)) {
      const word = input.match(IDENTIFIER);
      const lower = word.toLowerCase();

      if (logical_words.indexOf(lower) !== -1) {
        let text = word;
        if (options.logical_operator_casing === "lowercase") {
          text = lower;
        } else if (options.logical_operator_casing === "preserve") {
          text = word;
        } else if (
          options.logical_operator_casing === "uppercase" ||
          options.uppercase_reserved_words === true ||
          lower === "not"
        ) {
          text = lower.toUpperCase();
        }
        return finish(
          Token(TOKEN.RESERVED, text, ws.newlines, ws.whitespace_before),
        );
      }
      if (reserved_word_pattern.test(word)) {
        return finish(
          Token(TOKEN.RESERVED, lower, ws.newlines, ws.whitespace_before),
        );
      }
      // Only rewrite ALLCAPS/alllowercase identifiers; camelCase (e.g. containsKey) is left as written.
      if (
        options.correct_builtin_casing &&
        getBuiltinFunctionsSet().has(lower) &&
        input.peek() === "("
      ) {
        const isMixedCase = word !== lower && word !== word.toUpperCase();
        const text = isMixedCase ? word : lower;
        return finish(
          Token(TOKEN.WORD, text, ws.newlines, ws.whitespace_before),
        );
      }
      return finish(Token(TOKEN.WORD, word, ws.newlines, ws.whitespace_before));
    }

    if (isDigit(c) || (c === "." && isDigit(input.peek(1)))) {
      return finish(
        Token(
          TOKEN.WORD,
          input.match(NUMBER),
          ws.newlines,
          ws.whitespace_before,
        ),
      );
    }

    if (c === "=") {
      if (input.peek(1) === "=") {
        input.next();
        input.next();
        return finish(
          Token(TOKEN.OPERATOR, "==", ws.newlines, ws.whitespace_before),
        );
      }
      input.next();
      return finish(
        Token(TOKEN.EQUALS, "=", ws.newlines, ws.whitespace_before),
      );
    }

    if (OPERATOR_CHARS.indexOf(c) !== -1 || c === "<") {
      const two = c + (input.peek(1) || "");
      if (two === "<>" || two === "<=" || two === ">=" || two === "!=") {
        input.next();
        input.next();
        return finish(
          Token(TOKEN.OPERATOR, two, ws.newlines, ws.whitespace_before),
        );
      }
      input.next();
      return finish(
        Token(TOKEN.OPERATOR, c, ws.newlines, ws.whitespace_before),
      );
    }

    input.next();
    return finish(Token(TOKEN.UNKNOWN, c, ws.newlines, ws.whitespace_before));
  }

  function isComment(token) {
    return token.type === TOKEN.COMMENT || token.type === TOKEN.BLOCK_COMMENT;
  }

  function tokenize() {
    const tokens = [];
    let comments = [];
    let current = get_next_token();
    while (true) {
      while (isComment(current)) {
        comments.push(current);
        current = get_next_token();
      }
      if (comments.length) {
        current.comments_before = comments;
        comments = [];
      }
      tokens.push(current);
      if (current.type === TOKEN.EOF) break;
      current = get_next_token();
    }
    let pos = 0;
    return {
      next() {
        return pos < tokens.length ? tokens[pos++] : null;
      },
      peek(offset) {
        const i = pos + (offset || 0);
        return i < tokens.length ? tokens[i] : tokens[tokens.length - 1];
      },
    };
  }

  return { tokenize };
}

module.exports = {
  Tokenizer,
  TOKEN,
  line_starters: line_starters.slice(),
  positionable_operators: positionable_operators.slice(),
};
