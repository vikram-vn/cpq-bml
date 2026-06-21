'use strict';
/**
 * BML beautifier.
 *
 * Formats a token stream produced by ./tokenizer into indented, consistently-spaced
 * BML source. Unlike a JS formatter, there is no var/object-literal/ternary/chained-method/
 * switch/do-while/while handling to worry about - statements are: assignments, function
 * calls, if/elif/else, for-in, return/break/continue, and typed array literals.
 *
 * Newlines are only ever introduced where BML's statement/block structure requires one
 * (after `;`, after `{`, before `}`, before a new control statement) or where the
 * *source* already had a line break that preserve_newlines should keep - a newline is
 * never invented in the middle of a single-line expression just because an operator or
 * a string literal happens to precede the next token, with one opt-in exception:
 * wrap_line_length (default 0/off) wraps before the next operand of a '+' chain once a
 * line exceeds the configured length - this only ever splits *forward* from where it
 * triggers, never retroactively re-splits text already printed.
 */

const { Tokenizer, TOKEN, line_starters } = require('./tokenizer');
const { Options } = require('./options');
const { Output } = require('./output');
const { get_directives } = require('./tokenizerHelpers');

const CONTROL_WITH_CONDITION = ['if', 'elif', 'for'];
const HUGS_PREVIOUS_BLOCK = ['else', 'elif'];

// True for a token type that can be the last thing in a statement (so seeing
// one of these as `last`, immediately followed by something that starts a
// new statement, means the statement is missing its `;`) - used only by the
// opt-in enforce_semicolons transformation.
function endsExpressionAtStatementLevel(token) {
  if (token.type === TOKEN.WORD || token.type === TOKEN.STRING ||
    token.type === TOKEN.END_EXPR || token.type === TOKEN.ARRAY_END) {
    return true;
  }
  if (token.type === TOKEN.RESERVED) {
    const lower = token.text.toLowerCase();
    // true/false/null as a bare expression value, or a bare return/break/continue
    // with no trailing expression (e.g. just `return` on its own line).
    return lower === 'true' || lower === 'false' || lower === 'null' ||
      lower === 'return' || lower === 'break' || lower === 'continue';
  }
  return false;
}

// True for a token that begins a new statement: an assignment/call (WORD) or
// a control keyword (if/elif/else/for/return/break/continue) - logical words
// (and/or/not) are RESERVED too but never start a statement, so they're
// deliberately excluded here.
function isStatementStarter(token) {
  if (token.type === TOKEN.WORD) return true;
  if (token.type === TOKEN.RESERVED) {
    return line_starters.indexOf(token.text.toLowerCase()) !== -1;
  }
  return false;
}

function Beautifier(source_text, options) {
  const opts = Options(options);

  function beautify() {
    if (opts.disabled) return source_text || '';

    const tokens = Tokenizer(source_text || '', opts).tokenize();
    const output = Output(opts);

    let indent_level = 0;
    // Stack of 'block' | 'array' for matching START_BLOCK/ARRAY_START to their close,
    // and 'paren' for ()/[] nesting (tracked only for spacing/condition context).
    const context_stack = [];
    let last = null; // last real (non-comment) token printed

    function top() { return context_stack[context_stack.length - 1]; }

    function isUnaryContext() {
      if (!last) return true;
      if (last.type === TOKEN.START_EXPR || last.type === TOKEN.START_BLOCK ||
        last.type === TOKEN.ARRAY_START || last.type === TOKEN.EQUALS ||
        last.type === TOKEN.OPERATOR || last.type === TOKEN.COMMA) {
        return true;
      }
      return last.type === TOKEN.RESERVED && last.text !== 'true' && last.text !== 'false' && last.text !== 'null';
    }

    function needsSpaceBefore(token) {
      if (!last) return false;
      if (token.type === TOKEN.COMMA || token.type === TOKEN.SEMICOLON || token.type === TOKEN.DOT) {
        return false;
      }
      if (token.type === TOKEN.END_EXPR || token.type === TOKEN.END_BLOCK || token.type === TOKEN.ARRAY_END) {
        return opts.space_in_paren && last.type !== TOKEN.START_EXPR;
      }
      if (last.type === TOKEN.DOT) return false;
      if (last.type === TOKEN.START_EXPR) return opts.space_in_paren;

      if (token.type === TOKEN.START_EXPR) {
        if (token.text === '(') {
          if (last.type === TOKEN.WORD || last.type === TOKEN.END_EXPR || last.type === TOKEN.END_BLOCK) return false;
          if (last.type === TOKEN.RESERVED && last.text.toLowerCase() === 'not') return false;
          if (last.type === TOKEN.RESERVED && CONTROL_WITH_CONDITION.indexOf(last.text) !== -1) {
            return opts.space_before_conditional;
          }
          return true;
        }
        // '[' - array indexing / size declarator always hugs the preceding word.
        if (last.type === TOKEN.WORD || last.type === TOKEN.END_EXPR) return false;
        return true;
      }

      if (token.type === TOKEN.START_BLOCK || token.type === TOKEN.ARRAY_START) return true;
      if (last.type === TOKEN.ARRAY_START) return false;

      // A unary +/- always gets a space before it (like any other token), just not
      // after it - the operand that follows it is handled by this same check.
      if (last.type === TOKEN.OPERATOR && isUnaryAfterPrint) return false;

      // Default: most adjacent tokens (words, reserved words, strings, equals, operators,
      // commas-after) read better with a single space between them.
      return true;
    }

    // Set by handleOperator right after printing a unary +/- so the operand that follows
    // it doesn't get a leading space.
    let isUnaryAfterPrint = false;

    // `token` is the token about to start the new line - its `.newlines` count (how
    // many line breaks separated it from whatever came before in the source) is used
    // to decide how many blank lines to preserve, up to max_preserve_newlines.
    function startNewLine(token) {
      output.ensure_newline();
      if (token) {
        const blanks = blankLinesBefore(token);
        for (let i = 0; i < blanks; i++) output.newline();
      }
      output.set_indent(indent_level);
    }

    // Set by handleOperator right after a '+' pushes the current line past
    // wrap_line_length, so the *next* token (the next operand in the chain)
    // starts a fresh continuation line instead of extending this one further.
    let forceWrapBeforeNext = false;

    function printText(text) {
      if (forceWrapBeforeNext) {
        forceWrapBeforeNext = false;
        output.ensure_newline();
        output.set_indent(indent_level + 1);
        output.append(text);
        return;
      }
      // Indentation for a fresh line is set explicitly by whatever decided to start
      // that line (startNewLine, or the mid-expression continuation-line branch in
      // beginStatementLine) - falling back to set_indent here would clobber a
      // deliberately deeper continuation indent back down to indent_level.
      if (output.is_current_line_empty()) {
        output.set_indent_if_unset(indent_level);
      } else if (needsSpaceBeforeCurrent) {
        output.append(' ');
      }
      output.append(text);
    }

    let needsSpaceBeforeCurrent = false;

    function emit(token, text) {
      needsSpaceBeforeCurrent = needsSpaceBefore(token);
      printText(text !== undefined ? text : token.text);
      isUnaryAfterPrint = false;
    }

    function blankLinesBefore(token) {
      if (!opts.preserve_newlines) return 0;
      return Math.max(0, Math.min(token.newlines - 1, opts.max_preserve_newlines));
    }

    function flushComment(comment) {
      // A comment with no newline before it followed code on the same source line
      // (e.g. `x = 1; // why`) - keep it trailing that line instead of bumping it
      // down, as long as something has actually been printed already.
      const isTrailing = comment.newlines === 0 && !output.is_current_line_empty();
      if (isTrailing) {
        output.append(' ');
      } else {
        startNewLine(comment);
      }
      output.append_raw(comment.text);
      output.ensure_newline();
    }

    function flushCommentsBefore(token) {
      if (!token.comments_before) return;
      for (const comment of token.comments_before) {
        flushComment(comment);
      }
    }

    function isStatementLevel() {
      const t = top();
      return t === undefined || t === 'block';
    }

    function beginStatementLine(token) {
      // Decide if `token` needs to start on a fresh line because the previous
      // statement/block ended, vs. continuing the current line/expression.
      if (!last) return;

      // Opt-in: the previous statement ended (last printed token can end an
      // expression) with no ';' in between, and what follows starts a new
      // statement on a new source line - inject the missing ';' before
      // starting the new line. Takes priority over every other branch below,
      // since once this fires the statement boundary is already settled.
      if (opts.enforce_semicolons && isStatementLevel() && token.newlines > 0 &&
        endsExpressionAtStatementLevel(last) && isStatementStarter(token)) {
        output.append(';');
        last = { type: TOKEN.SEMICOLON, text: ';' };
        startNewLine(token);
        return;
      }

      if (last.type === TOKEN.SEMICOLON) {
        startNewLine(token);
        return;
      }

      if (last.type === TOKEN.START_BLOCK) {
        startNewLine(token);
        return;
      }

      if (last.type === TOKEN.END_BLOCK && isStatementLevel()) {
        const hugs = token.type === TOKEN.RESERVED && HUGS_PREVIOUS_BLOCK.indexOf(token.text) !== -1;
        const collapseStyle = opts.brace_style === 'collapse' || opts.brace_style === 'none';
        if (hugs && collapseStyle) {
          needsSpaceBeforeCurrent = true;
          return;
        }
        startNewLine(token);
        return;
      }

      if (context_stack.length === 0 && (last.type === TOKEN.END_EXPR || last.type === TOKEN.ARRAY_END)) {
        // top-level expression statement closed without a trailing ';' seen yet - no-op,
        // the ';' handler will start the next line.
        return;
      }

      // Preserve a source line break inside an expression/condition/array list, but
      // never invent one that wasn't there.
      if (opts.preserve_newlines && token.newlines > 0 && context_stack.length > 0 &&
        last.type !== TOKEN.START_EXPR && last.type !== TOKEN.START_BLOCK && last.type !== TOKEN.ARRAY_START) {
        output.ensure_newline();
        output.set_indent(indent_level + 1);
        needsSpaceBeforeCurrent = false;
      }
    }

    function pushIndent(kind) {
      context_stack.push(kind);
      indent_level += 1;
    }

    function popIndent() {
      context_stack.pop();
      indent_level = Math.max(0, indent_level - 1);
    }

    function handleStartExpr(token) {
      beginStatementLine(token);
      emit(token);
      context_stack.push(token.text === '(' ? 'paren' :
        (last && last.type === TOKEN.RESERVED && CONTROL_WITH_CONDITION.indexOf(last.text) !== -1 ? 'condition' : 'index'));
    }

    function handleEndExpr(token) {
      context_stack.pop();
      emit(token);
    }

    function handleStartBlock(token) {
      emit(token);
      pushIndent('block');
    }

    function handleEndBlock(token) {
      popIndent();
      const onOwnLine = !(opts.brace_preserve_inline && last && last.type === TOKEN.START_BLOCK);
      if (last && last.type !== TOKEN.START_BLOCK && onOwnLine) {
        startNewLine();
      }
      emit(token);
    }

    function handleArrayStart(token) {
      emit(token);
      pushIndent('array');
    }

    function handleArrayEnd(token) {
      popIndent();
      emit(token);
    }

    function handleSemicolon(token) {
      emit(token);
    }

    function handleComma(token) {
      emit(token);
    }

    function handleDot(token) {
      beginStatementLine(token);
      emit(token);
    }

    function handleOperator(token) {
      beginStatementLine(token);
      const unary = (token.text === '+' || token.text === '-') && isUnaryContext();
      emit(token);
      if (unary) {
        isUnaryAfterPrint = true;
        return;
      }
      if (token.text !== '+' || opts.wrap_line_length <= 0) return;

      // A binary '+' (string/number concatenation chain) already pushed this line
      // past the configured limit, OR the very next operand (commonly one long
      // string literal, e.g. building a SOAP/XML payload) would push it past on
      // its own - either way, wrap before that next operand rather than
      // retroactively splitting anything already printed.
      const currentLength = output.current_line_length();
      if (currentLength > opts.wrap_line_length) {
        forceWrapBeforeNext = true;
        return;
      }
      const next = tokens.peek(0);
      if (next && currentLength + 1 + next.text.length > opts.wrap_line_length) {
        forceWrapBeforeNext = true;
      }
    }

    function handleEquals(token) {
      beginStatementLine(token);
      emit(token);
    }

    function handleString(token) {
      beginStatementLine(token);
      emit(token);
    }

    function handleWord(token) {
      beginStatementLine(token);
      emit(token);
    }

    function handleEOF() {
      // nothing to print; final cleanup happens in get_code()
    }

    function handleToken(token) {
      switch (token.type) {
        case TOKEN.START_EXPR: handleStartExpr(token); break;
        case TOKEN.END_EXPR: handleEndExpr(token); break;
        case TOKEN.START_BLOCK: handleStartBlock(token); break;
        case TOKEN.END_BLOCK: handleEndBlock(token); break;
        case TOKEN.ARRAY_START: handleArrayStart(token); break;
        case TOKEN.ARRAY_END: handleArrayEnd(token); break;
        case TOKEN.SEMICOLON: handleSemicolon(token); break;
        case TOKEN.COMMA: handleComma(token); break;
        case TOKEN.DOT: handleDot(token); break;
        case TOKEN.OPERATOR: handleOperator(token); break;
        case TOKEN.EQUALS: handleEquals(token); break;
        case TOKEN.STRING: handleString(token); break;
        case TOKEN.WORD:
        case TOKEN.RESERVED: handleWord(token); break;
        case TOKEN.EOF: handleEOF(); break;
        default: emit(token);
      }
    }

    let current = tokens.next();
    while (current) {
      flushCommentsBefore(current);
      if (current.type === TOKEN.EOF) break;
      if (!last && current.comments_before && current.comments_before.length) {
        // beginStatementLine() no-ops with no preceding real token, so a blank line
        // between a leading file comment and the first statement needs handling here.
        let blanks = blankLinesBefore(current);
        // Opt-out-able normalisation: a leading file-header /* block comment */ is
        // always followed by a blank line before the first statement, even if the
        // source itself didn't have one - matching the convention every library
        // function in practice already follows.
        const leadingComments = current.comments_before;
        const lastLeadingComment = leadingComments[leadingComments.length - 1];
        // A "beautify ignore:start/end" block is tokenized as one big BLOCK_COMMENT
        // whose .text embeds the verbatim ignored source - it's a directive, not a
        // documentation header, so it must never gain a synthetic blank line.
        const isIgnoreDirective = !!get_directives(lastLeadingComment.text);
        if (opts.blank_line_after_block_comment && lastLeadingComment.type === TOKEN.BLOCK_COMMENT && !isIgnoreDirective) {
          blanks = Math.max(blanks, 1);
        }
        for (let i = 0; i < blanks; i++) output.newline();
      }
      handleToken(current);
      last = current;
      current = tokens.next();
    }

    return output.get_code(opts.eol === 'auto' ? '\n' : opts.eol);
  }

  return { beautify };
}

module.exports = { Beautifier };
