"use strict";
// BML tokenizer. Constants, patterns, and stateless helpers live in tokenizerHelpers.js.

const fs = require("fs");
const path = require("path");

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

// Two candidate paths since __dirname differs between unbundled source and the esbuild bundle (dist/).
const _builtinJsonCandidates = [
  path.join(__dirname, "../../intellisense/bml_functions_api_usage.json"),
  path.join(__dirname, "../app/lang/intellisense/bml_functions_api_usage.json"),
];
let builtinFunctions = {};
for (const _p of _builtinJsonCandidates) {
  try {
    builtinFunctions = JSON.parse(fs.readFileSync(_p, "utf8"));
    break;
  } catch (_) {}
}
const builtinFunctionsSet = new Set(Object.keys(builtinFunctions));

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

  // Detects `Type[]{` / `Type[n]{` so the `{...}` body is formatted as a value list, not a code block.
  function is_array_literal_start() {
    return !!(
      last_real_token &&
      last_real_token.type === TOKEN.END_EXPR &&
      last_real_token.text === "]" &&
      last_real_token.opened &&
      last_real_token.opened.preceded_by_word
    );
  }

  function finish(token, track) {
    if (track !== false) {
      if (
        token.type === TOKEN.START_EXPR &&
        token.text === "[" &&
        last_real_token &&
        (last_real_token.type === TOKEN.WORD ||
          last_real_token.type === TOKEN.END_EXPR)
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
        const text =
          lower === "not" || options.uppercase_reserved_words === true
            ? lower.toUpperCase()
            : word;
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
        builtinFunctionsSet.has(lower) &&
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
