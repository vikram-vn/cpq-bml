"use strict";
const { describeLintDirective } = require('../lint/suppressions');
const { get_directives } = require('../beautify/bml/tokenizerHelpers');

// Returns { type: 'beautify-ignore', mode: 'start'|'end' } or null.
function describeBeautifyDirective(commentText) {
    const directives = get_directives(commentText);
    if (!directives || !directives.ignore) return null;
    return { type: 'beautify-ignore', mode: directives.ignore };
}

// Returns a description for whichever functional directive commentText is,
// or null if it's just a regular (possibly tagged) comment.
function describeDirective(commentText) {
    const lintDirective = describeLintDirective(commentText);
    if (lintDirective) return { kind: 'lint', ...lintDirective };
    const beautifyDirective = describeBeautifyDirective(commentText);
    if (beautifyDirective) return { kind: 'beautify', ...beautifyDirective };
    return null;
}

module.exports = { describeLintDirective, describeBeautifyDirective, describeDirective };
