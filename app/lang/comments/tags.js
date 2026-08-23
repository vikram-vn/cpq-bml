"use strict";
// Symbol tags match the literal character(s) right after the comment marker;
// word tags match case-insensitively as a whole word.
const DEFAULT_TAGS = [
    { id: '!', kind: 'symbol', color: '#FF4B4B', lightColor: '#D93838', bold: true },
    { id: '?', kind: 'symbol', color: '#3498DB', lightColor: '#2980B9', italic: true },
    { id: '*', kind: 'symbol', color: '#98C379', lightColor: '#27AE60', italic: true },
    // Line comments only - a `/* // ... */` block isn't "disabled code".
    { id: '//', kind: 'symbol', color: '#75715E', lightColor: '#7F8C8D', strikethrough: true, lineCommentOnly: true },
    { id: 'todo', kind: 'word', color: '#FFA500', lightColor: '#D35400', bold: true },
    { id: 'fixme', kind: 'word', color: '#FF6B6B', lightColor: '#C0392B', bold: true },
    { id: 'hack', kind: 'word', color: '#FF8C00', lightColor: '#D35400', bold: true, underline: true },
    { id: 'xxx', kind: 'word', color: '#FF8C00', lightColor: '#D35400', bold: true, underline: true },
    { id: 'note', kind: 'word', color: '#3DC9B0', lightColor: '#16A085' },
    { id: 'bug', kind: 'word', color: '#FF6B6B', lightColor: '#C0392B', bold: true },
    { id: 'warning', kind: 'word', color: '#FFD700', lightColor: '#B7950B', bold: true },
    { id: 'important', kind: 'word', color: '#E74C3C', lightColor: '#C0392B', bold: true },
    { id: 'optimize', kind: 'word', color: '#3DC9B0', lightColor: '#16A085', bold: true },
    { id: 'idea', kind: 'word', color: '#3498DB', lightColor: '#2980B9' }
];

DEFAULT_TAGS.forEach((tag) => {
    if (tag.kind === 'word') {
        tag.regex = new RegExp('^' + tag.id + '\\b', 'i');
    }
});

function matchTag(commentBodyText, isLineComment) {
    let start = 0;
    while (start < commentBodyText.length && commentBodyText.charCodeAt(start) <= 32) {
        start++;
    }
    const trimmed = start > 0 ? commentBodyText.slice(start) : commentBodyText;
    if (!trimmed) return null;

    for (const tag of DEFAULT_TAGS) {
        if (tag.lineCommentOnly && !isLineComment) continue;
        if (tag.kind === 'symbol') {
            if (trimmed.startsWith(tag.id)) return tag.id;
        } else {
            if (tag.regex.test(trimmed)) return tag.id;
        }
    }
    return null;
}

module.exports = { DEFAULT_TAGS, matchTag };
