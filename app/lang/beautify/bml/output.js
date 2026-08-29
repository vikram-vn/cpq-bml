'use strict';
/**
 * Line buffer / indentation engine for the BML beautifier.
 *
 * This only needs to support what BML formatting actually uses: per-line indentation,
 * blank-line preservation up to a max, and trimming trailing whitespace. There is no
 * column alignment for javadoc-style comments, no chained-method alignment, and no
 * "wrap already-emitted tokens onto a new line" retroactive splitting - the beautifier's
 * opt-in wrap_line_length only ever decides where to break *forward* from the point a
 * line first exceeds the limit (see current_line_length below), never re-flowing text
 * that's already been written to a line.
 */

function buildIndentUnit(options) {
  return options.indent_with_tabs ? '\t' : new Array(options.indent_size + 1).join(options.indent_char);
}

function Output(options, source_text) {
  const indent_unit = buildIndentUnit(options);
  const indent_cache = [''];

  function indent_string(level) {
    if (level <= 0) return '';
    while (indent_cache.length <= level) {
      indent_cache.push(indent_cache[indent_cache.length - 1] + indent_unit);
    }
    return indent_cache[level];
  }

  let lines = [''];
  let line_indent = [0];
  let line_indent_set = [false];

  function current() { return lines[lines.length - 1]; }

  function is_current_line_empty() { return current() === ''; }

  function last_char() {
    const line = current();
    return line ? line.charAt(line.length - 1) : null;
  }

  function trim_trailing_space() {
    lines[lines.length - 1] = current().replace(/[\t ]+$/, '');
  }

  function newline() {
    trim_trailing_space();
    lines.push('');
    line_indent.push(0);
    line_indent_set.push(false);
  }

  // Returns true if a blank line was actually added (i.e. we weren't already on one).
  function ensure_newline() {
    if (is_current_line_empty()) return false;
    newline();
    return true;
  }

  function set_indent(level) {
    if (is_current_line_empty()) {
      line_indent[line_indent.length - 1] = level;
      line_indent_set[line_indent_set.length - 1] = true;
    }
  }

  // Like set_indent, but a no-op if something already explicitly set the indent for
  // this line - used as a fallback default rather than an override.
  function set_indent_if_unset(level) {
    if (!line_indent_set[line_indent_set.length - 1]) {
      set_indent(level);
    }
  }

  function append(text) {
    if (is_current_line_empty() && text !== '') {
      lines[lines.length - 1] = indent_string(line_indent[line_indent.length - 1]);
    }
    lines[lines.length - 1] += text;
  }

  function append_raw(text) {
    const parts = text.split(/\r\n|\n|\r/);
    append(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      lines.push(parts[i]);
      line_indent.push(0);
      line_indent_set.push(true);
    }
  }

  function append_block_comment(text) {
    if (text.includes('beautify ignore:')) {
      append_raw(text);
      return;
    }
    const parts = text.split(/\r\n|\n|\r/);
    if (parts.length === 1) {
      append(parts[0]);
      return;
    }
    const isJsDoc = text.startsWith('/**');
    if (!isJsDoc) {
      append_raw(text);
      return;
    }
    const currentIndent = indent_string(line_indent[line_indent.length - 1]);
    append(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      const trimmed = parts[i].trimStart();
      if (trimmed.startsWith('*')) {
        lines.push(currentIndent + ' ' + trimmed);
      } else if (trimmed === '') {
        lines.push('');
      } else {
        lines.push(currentIndent + '  ' + trimmed);
      }
      line_indent.push(0);
      line_indent_set.push(true);
    }
  }

  return {
    is_current_line_empty,
    last_char,
    trim_trailing_space,
    newline,
    ensure_newline,
    set_indent,
    set_indent_if_unset,
    append,
    append_raw,
    append_block_comment,
    current_line_length() { return current().length; },
    get_code(eol) {
      trim_trailing_space();
      while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
      const shouldEndWithNewline = options.end_with_newline ||
        (options.raw_options && options.raw_options.end_with_newline === undefined && source_text && (source_text.endsWith('\n') || source_text.endsWith('\r')));
      if (shouldEndWithNewline) {
        lines.push('');
      }
      let code = lines.join('\n');
      if (eol && eol !== '\n') code = code.replace(/\n/g, eol);
      return code;
    }
  };
}

module.exports = { Output };
