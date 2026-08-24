"use strict";
const { getCommentRanges } = require('../lint/rules/comments');
const { matchTag } = require('./tags');
const { describeDirective } = require('./directives');
const { findDocHeaderBlocks } = require('./docHeader');

function isWithinAny(ranges, start, end) {
    return ranges.some(([rStart, rEnd]) => start >= rStart && end <= rEnd);
}

// Returns plain offset ranges; index.js converts these to vscode.Range.
function buildCommentDecorations(text) {
    const commentRanges = getCommentRanges(text);
    const docHeaders = findDocHeaderBlocks(text, commentRanges);
    const directives = [];
    const tags = new Map();

    for (const [start, end] of commentRanges) {
        const isLineComment = text[start] === '/' && text[start + 1] === '/';
        const rawCommentText = text.slice(start, end);

        const directive = describeDirective(rawCommentText);
        if (directive) {
            directives.push([start, end]);
            continue;
        }

        if (isWithinAny(docHeaders, start, end)) continue;

        const bodyText = isLineComment ? text.slice(start + 2, end) : text.slice(start + 2, Math.max(start + 2, end - 2));
        const tagId = matchTag(bodyText, isLineComment);
        if (tagId) {
            if (!tags.has(tagId)) tags.set(tagId, []);
            tags.get(tagId).push([start, end]);
        }
    }

    return { tags, directives, docHeaders };
}

module.exports = { buildCommentDecorations };
