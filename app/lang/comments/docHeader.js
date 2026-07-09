"use strict";
// Tolerant of "Function Name :" vs "Name:" spacing/casing and a leading `//`/`*` marker per line.
const HEADER_LINE_REGEX = /^[ \t]*(?:\/\/|\*)?[ \t]*(?:Function\s+Name|Name|Description|Inputs?|Returns?|Return\s+type|output)\s*:/i;

function isLineCommentStart(text, start) {
    return text[start] === '/' && text[start + 1] === '/';
}

function blockMatchesHeader(text, start, end) {
    return text.slice(start, end).split(/\r\n|\n|\r/).some((line) => HEADER_LINE_REGEX.test(line));
}

// Treats a run of immediately-adjacent line comments (only whitespace/newline between them) as one block.
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
