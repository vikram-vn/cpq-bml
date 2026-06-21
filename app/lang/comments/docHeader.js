"use strict";
// Recognizes the recurring (if inconsistently formatted) doc-header comment
// convention seen throughout bml/library: a leading `// Function Name : ...`
// run of line comments, or a `/* Name: ... Description: ... Inputs: ...
// Return: ... */` block comment. Tolerant of "Function Name :" vs "Name:"
// spacing/casing, and of a leading `//` or `*` continuation marker per line.
const HEADER_LINE_REGEX = /^[ \t]*(?:\/\/|\*)?[ \t]*(?:Function\s+Name|Name|Description|Inputs?|Returns?|Return\s+type|output)\s*:/i;

function isLineCommentStart(text, start) {
    return text[start] === '/' && text[start + 1] === '/';
}

function blockMatchesHeader(text, start, end) {
    return text.slice(start, end).split(/\r\n|\n|\r/).some((line) => HEADER_LINE_REGEX.test(line));
}

// commentRanges: [start,end][] from app/lang/lint/comments.js's getCommentRanges.
// Returns [start,end][] for each detected doc-header block - a single block
// comment range, or a run of immediately-adjacent line comments (nothing but
// whitespace/newline between them) treated as one block.
function findDocHeaderBlocks(text, commentRanges) {
    const sorted = [...commentRanges].sort((a, b) => a[0] - b[0]);
    const blocks = [];
    let i = 0;
    while (i < sorted.length) {
        const [start, end] = sorted[i];
        if (!isLineCommentStart(text, start)) {
            if (blockMatchesHeader(text, start, end)) blocks.push([start, end]);
            i++;
            continue;
        }

        let j = i;
        let groupEnd = end;
        while (j + 1 < sorted.length) {
            const [nextStart, nextEnd] = sorted[j + 1];
            if (!isLineCommentStart(text, nextStart)) break;
            const between = text.slice(groupEnd, nextStart);
            if (!/^[ \t]*(?:\r\n|\n|\r)[ \t]*$/.test(between)) break;
            groupEnd = nextEnd;
            j++;
        }

        if (blockMatchesHeader(text, start, groupEnd)) blocks.push([start, groupEnd]);
        i = j + 1;
    }
    return blocks;
}

module.exports = { findDocHeaderBlocks };
