"use strict";
// Default tag set for BML "better comments" decoration - parity with
// aaron-bond/better-comments' built-in tags (!, ?, *, // for commented-out
// code, TODO), plus a richer default (FIXME/HACK/XXX/NOTE) since this
// extension intentionally doesn't expose settings.json tag customization.
// Symbol tags match the literal character(s) right after the comment marker;
// word tags match case-insensitively as a whole word.
const DEFAULT_TAGS = [
    { id: '!', kind: 'symbol', color: '#FF4B4B', bold: true },
    { id: '?', kind: 'symbol', color: '#3498DB', italic: true },
    { id: '*', kind: 'symbol', color: '#98C379', italic: true },
    // Commented-out code marker (e.g. `////old code`) - line comments only,
    // a `/* // ... */` block doesn't carry the same "disabled code" meaning.
    { id: '//', kind: 'symbol', color: '#75715E', strikethrough: true, lineCommentOnly: true },
    { id: 'todo', kind: 'word', color: '#FFA500', bold: true },
    { id: 'fixme', kind: 'word', color: '#FF6B6B', bold: true },
    { id: 'hack', kind: 'word', color: '#FF8C00', bold: true, underline: true },
    { id: 'xxx', kind: 'word', color: '#FF8C00', bold: true, underline: true },
    { id: 'note', kind: 'word', color: '#3DC9B0' }
];

// commentBodyText is everything after the opening comment marker (`//` or
// `/*`), unstripped of its own leading whitespace. isLineComment distinguishes
// `//` comments from `/* */` ones for the lineCommentOnly `//` tag.
function matchTag(commentBodyText, isLineComment) {
    const trimmed = commentBodyText.replace(/^\s+/, '');
    for (const tag of DEFAULT_TAGS) {
        if (tag.lineCommentOnly && !isLineComment) continue;
        if (tag.kind === 'symbol') {
            if (trimmed.startsWith(tag.id)) return tag.id;
        } else {
            const re = new RegExp('^' + tag.id + '\\b', 'i');
            if (re.test(trimmed)) return tag.id;
        }
    }
    return null;
}

module.exports = { DEFAULT_TAGS, matchTag };
