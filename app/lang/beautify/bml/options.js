"use strict";
// Beautifier options for BML formatting configuration.

function normalizeKeys(options) {
  const result = {};
  for (const key in options) {
    result[key.replace(/-/g, "_")] = options[key];
  }
  return result;
}

function getBoolean(raw, name, default_value) {
  const value = raw[name];
  return value === undefined ? !!default_value : !!value;
}

function getNumber(raw, name, default_value) {
  const value = parseInt(raw[name], 10);
  return isNaN(value) ? default_value : value;
}

function getString(raw, name, default_value) {
  const value = raw[name];
  return typeof value === "string" ? value : default_value;
}

function parseBraceStyle(raw) {
  const value = getString(raw, "brace_style", "collapse");
  const parts = value.split(",").map((s) => s.trim());
  let style = "collapse";
  let preserve_inline = false;
  for (const part of parts) {
    if (part === "preserve-inline") {
      preserve_inline = true;
    } else if (
      ["collapse", "expand", "end-expand", "none"].indexOf(part) !== -1
    ) {
      style = part;
    }
  }
  return { style, preserve_inline };
}

function Options(options) {
  const raw = normalizeKeys(options || {});

  let indent_char = getString(raw, "indent_char", " ");
  let indent_size = getNumber(raw, "indent_size", 4);
  const indent_with_tabs = getBoolean(
    raw,
    "indent_with_tabs",
    indent_char === "\t",
  );
  if (indent_with_tabs) {
    indent_char = "\t";
    if (indent_size === 1) indent_size = 1;
  }

  const preserve_newlines = getBoolean(raw, "preserve_newlines", true);
  let max_preserve_newlines = getNumber(raw, "max_preserve_newlines", 2);
  if (!preserve_newlines) max_preserve_newlines = 0;

  const brace = parseBraceStyle(raw);

  return {
    raw_options: raw,
    disabled: getBoolean(raw, "disabled", false),
    eol: getString(raw, "eol", "auto"),
    end_with_newline: getBoolean(raw, "end_with_newline", false),
    indent_char,
    indent_size,
    indent_with_tabs,
    preserve_newlines,
    max_preserve_newlines,
    wrap_line_length: getNumber(raw, "wrap_line_length", 0),
    brace_style: brace.style,
    brace_preserve_inline: brace.preserve_inline,
    space_in_paren: getBoolean(raw, "space_in_paren", false),
    space_in_empty_paren: getBoolean(raw, "space_in_empty_paren", false),
    space_before_conditional: getBoolean(raw, "space_before_conditional", true),
    keep_array_indentation: getBoolean(raw, "keep_array_indentation", false),
    unescape_strings: getBoolean(raw, "unescape_strings", false),
    uppercase_reserved_words: getBoolean(raw, "uppercase_reserved_words", true),
    logical_operator_casing: getString(raw, "logical_operator_casing", "uppercase"),
    correct_builtin_casing: getBoolean(raw, "correct_builtin_casing", true),
    format_bmql_strings: getBoolean(raw, "format_bmql_strings", false),
    // Inject a semicolon after statement-level expressions that are missing one.
    // Off by default because it is a content-changing transformation.
    enforce_semicolons: getBoolean(raw, "enforce_semicolons", false),
    // Emit a blank line after a leading /* block comment */ before the first statement.
    blank_line_after_block_comment: getBoolean(
      raw,
      "blank_line_after_block_comment",
      true,
    ),
  };
}

module.exports = { Options };
