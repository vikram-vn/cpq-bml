// ESLint-style comment directives for suppressing bml-lint diagnostics:
//   // bml-lint-disable-line [code ...]       - suppress diagnostics on this line
//   // bml-lint-disable-next-line [code ...]  - suppress diagnostics on the next line
//   // bml-lint-disable [code ...]            - suppress from here until a matching bml-lint-enable
//   // bml-lint-enable [code ...]             - re-enable a previous bml-lint-disable
//   // bml-lint-disable-file [code ...]       - suppress for the whole file, wherever placed
// No codes listed = applies to every diagnostic; otherwise only to matching .code values.
function computeLineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') starts.push(i + 1);
    }
    return starts;
}

function offsetToLine(lineStarts, offset) {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (lineStarts[mid] <= offset) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

const directiveRegex = /\bbml-lint-(disable-next-line|disable-line|disable-file|disable|enable)\b([^\r\n]*)/gi;

// Non-global sibling of directiveRegex, to avoid sharing a stateful lastIndex across callers.
const SINGLE_DIRECTIVE_PATTERN = /\bbml-lint-(disable-next-line|disable-line|disable-file|disable|enable)\b([^\r\n]*)/i;

// Returns { type, codes } for a single comment's text, or null if it's not a bml-lint directive.
function describeLintDirective(commentText) {
    const m = commentText.match(SINGLE_DIRECTIVE_PATTERN);
    if (!m) return null;
    return {
        type: m[1].toLowerCase(),
        codes: m[2].trim().split(/[\s,]+/).filter(w => w.startsWith('bml-'))
    };
}

function parseDirectives(text, commentRanges, lineStarts) {
    const directives = [];
    for (const [start, end] of commentRanges) {
        const commentText = text.slice(start, end);
        directiveRegex.lastIndex = 0;
        let m;
        while ((m = directiveRegex.exec(commentText)) !== null) {
            const line = offsetToLine(lineStarts, start + m.index);
            const type = m[1].toLowerCase();
            const codes = m[2].trim().split(/[\s,]+/).filter(w => w.startsWith('bml-'));
            directives.push({ line, type, codes });
        }
    }
    return directives;
}

function computeSuppressions(text, commentRanges) {
    if (!text.includes('bml-lint-')) {
        return { isSuppressed: () => false };
    }
    const lineStarts = computeLineStarts(text);
    const totalLines = lineStarts.length;
    const directives = parseDirectives(text, commentRanges, lineStarts);

        // Removed fallback detection (handled by regex)


    let fileDisableAll = false;
    const fileDisableCodes = new Set();
    const lineDisableAll = new Set();
    const lineDisableCodes = new Map();
    const blockDirectives = [];

    const addLineSuppression = (line, codes) => {
        if (codes.length === 0) {
            lineDisableAll.add(line);
            return;
        }
        if (!lineDisableCodes.has(line)) lineDisableCodes.set(line, new Set());
        const set = lineDisableCodes.get(line);
        codes.forEach((c) => set.add(c));
    };

    for (const d of directives) {
        if (d.type === 'disable-file') {
            if (d.codes.length === 0) fileDisableAll = true;
            else d.codes.forEach((c) => fileDisableCodes.add(c));
        } else if (d.type === 'disable-line') {
            addLineSuppression(d.line, d.codes);
        } else if (d.type === 'disable-next-line') {
            addLineSuppression(d.line + 1, d.codes);
        } else {
            blockDirectives.push(d);
        }
    }

    blockDirectives.sort((a, b) => a.line - b.line);
    const perLineBlockAll = new Array(totalLines).fill(false);
    const perLineBlockCodes = new Array(totalLines).fill(null);

    let curAll = false;
    let curCodes = new Set();
    let dirIndex = 0;
    for (let line = 0; line < totalLines; line++) {
        while (dirIndex < blockDirectives.length && blockDirectives[dirIndex].line <= line) {
            const d = blockDirectives[dirIndex];
            if (d.type === 'disable') {
                if (d.codes.length === 0) curAll = true;
                else d.codes.forEach((c) => curCodes.add(c));
            } else {
                if (d.codes.length === 0) {
                    curAll = false;
                    curCodes = new Set();
                } else {
                    d.codes.forEach((c) => curCodes.delete(c));
                }
            }
            dirIndex++;
        }
        perLineBlockAll[line] = curAll;
        perLineBlockCodes[line] = curCodes.size > 0 ? new Set(curCodes) : null;
    }

    return {
        isSuppressed(line, code) {
            if (fileDisableAll) return true;
            if (code && fileDisableCodes.has(code)) return true;
            if (lineDisableAll.has(line)) return true;
            if (code && lineDisableCodes.has(line) && lineDisableCodes.get(line).has(code)) return true;
            if (perLineBlockAll[line]) return true;
            if (code && perLineBlockCodes[line] && perLineBlockCodes[line].has(code)) return true;
            return false;
        }
    };
}

module.exports = { computeSuppressions, describeLintDirective };
