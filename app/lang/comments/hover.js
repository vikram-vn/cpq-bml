"use strict";
const { getCommentRanges } = require('../lint/rules/comments');
const { describeDirective } = require('./directives');

const LINT_DIRECTIVE_EXPLANATIONS = {
    'disable': 'Suppresses bml-lint diagnostics from this point until a matching `bml-lint-enable` (or end of file).',
    'disable-line': 'Suppresses bml-lint diagnostics on this line only.',
    'disable-next-line': 'Suppresses bml-lint diagnostics on the next line only.',
    'disable-file': 'Suppresses bml-lint diagnostics for the whole file, regardless of where this comment is placed.',
    'enable': 'Re-enables bml-lint diagnostics previously suppressed by a `bml-lint-disable` comment.'
};

// Returns a Markdown string, or null if offset isn't inside a directive comment.
function getHoverMarkdown(text, offset) {
    const commentRanges = getCommentRanges(text);
    const range = commentRanges.find(([start, end]) => offset >= start && offset <= end);
    if (!range) return null;

    const [start, end] = range;
    const directive = describeDirective(text.slice(start, end));
    if (!directive) return null;

    if (directive.kind === 'lint') {
        const scope = directive.codes.length > 0
            ? `Applies only to: \`${directive.codes.join('`, `')}\`.`
            : 'Applies to every diagnostic (no specific codes listed).';
        return `**bml-lint-${directive.type}**\n\n${LINT_DIRECTIVE_EXPLANATIONS[directive.type] || ''}\n\n${scope}`;
    }

    if (directive.kind === 'beautify') {
        return directive.mode === 'start'
            ? '**beautify ignore:start**\n\nThe BML beautifier leaves everything between this comment and the matching `beautify ignore:end` untouched.'
            : '**beautify ignore:end**\n\nMarks the end of a region the BML beautifier leaves untouched (started by a matching `beautify ignore:start`).';
    }

    return null;
}

module.exports = { getHoverMarkdown };
