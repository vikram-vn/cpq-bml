// Includes an implicit top-level "block" spanning the whole file, so unreachable code
// after a top-level return/break/throwerror with no enclosing braces is still caught.
function findBlocks(text) {
    const blocks = [{ start: 0, end: text.length }];
    const stack = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            stack.push(i);
        } else if (text[i] === '}') {
            if (stack.length > 0) {
                const start = stack.pop();
                blocks.push({ start, end: i });
            }
        }
    }
    return blocks;
}

function findInnermostBlock(blocks, position) {
    let best = null;
    for (const b of blocks) {
        if (b.start <= position && position <= b.end) {
            if (!best || b.end - b.start < best.end - best.start) best = b;
        }
    }
    return best;
}

// Bails (-1) on hitting an enclosing close-bracket first, rather than guess at a
// malformed statement's extent (a missing semicolon is already covered by semicolon.js).
function findStatementSemicolon(text, fromIndex) {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = fromIndex; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
        if (inSingleQuote || inDoubleQuote) continue;
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
            if (depth === 0) return -1;
            depth--;
        } else if (ch === ';' && depth === 0) {
            return i;
        }
    }
    return -1;
}

// Reports a dead zone as a diagnostic, tagged Unnecessary so editors render
// it faded out (VS Code's standard treatment for dead code, same as
// TypeScript) instead of just underlining it.
function reportDeadZone(vscode, doc, diagnostics, deadStart, deadEnd, reasonText) {
    const startPos = doc.positionAt(deadStart);
    const endPos = doc.positionAt(deadEnd);
    const diag = new vscode.Diagnostic(
        new vscode.Range(startPos, endPos),
        `Unreachable code: this can never execute - it comes after ${reasonText}.`,
        vscode.DiagnosticSeverity.Warning
    );
    diag.code = 'bml-unreachable-code';
    diag.tags = [vscode.DiagnosticTag.Unnecessary];
    diagnostics.push(diag);
}

// Finds the start index of a block/chain's last top-level (brace-depth-0
// relative to the slice) ';'-terminated statement, and reports whether that
// statement is itself a terminator (return/break/continue/throwerror). Only
// the branch's own trailing statement is checked - a branch ending in a
// nested if/elif/else instead of a direct terminator is conservatively
// treated as "does not terminate" rather than recursing, to avoid false
// positives from a text-based (non-parsing) analysis.
function bodyEndsWithTerminator(bodyText) {
    const trimmed = bodyText.replace(/\s+$/, '');
    if (!trimmed) return false;

    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    const topLevelSemicolons = [];
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
        if (inSingleQuote || inDoubleQuote) continue;
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
        else if (ch === ';' && depth === 0) topLevelSemicolons.push(i);
    }
    if (topLevelSemicolons.length === 0) return false;

    const lastSemi = topLevelSemicolons[topLevelSemicolons.length - 1];
    // The body must actually end at its last top-level ';' - if there's a
    // nested block (e.g. another if/else) after it, this isn't a simple
    // "last statement is a terminator" case.
    if (lastSemi !== trimmed.length - 1) return false;

    const prevSemi = topLevelSemicolons.length >= 2 ? topLevelSemicolons[topLevelSemicolons.length - 2] : -1;
    const lastStatement = trimmed.slice(prevSemi + 1, lastSemi).trim();
    return /^(return\b|break$|continue$|throwerror\s*\()/i.test(lastStatement);
}

// Flags code between a terminating statement (return/break/continue/throwerror) and
// the closing brace of its enclosing block - control has already left unconditionally.
function checkUnreachableCode(noStringsText, doc, vscode, conditionalChains) {
    const diagnostics = [];
    const blocks = findBlocks(noStringsText);
    const reportedZones = [];

    const terminatorRegex = /\b(return|break|continue|throwerror)\b/g;
    let match;
    while ((match = terminatorRegex.exec(noStringsText)) !== null) {
        const kwStart = match.index;
        const kw = match[1].toLowerCase();

        // Already inside a previously-reported dead zone.
        if (reportedZones.some(([zs, ze]) => kwStart >= zs && kwStart < ze)) continue;

        const afterKw = kwStart + match[1].length;
        if (kw === 'throwerror') {
            let i = afterKw;
            while (i < noStringsText.length && /\s/.test(noStringsText[i])) i++;
            if (noStringsText[i] !== '(') continue; // not actually a call - be defensive
        }

        const semiIndex = findStatementSemicolon(noStringsText, afterKw);
        if (semiIndex === -1) continue;

        const deadStartCandidate = semiIndex + 1;
        const block = findInnermostBlock(blocks, deadStartCandidate);
        if (!block) continue;

        const deadSlice = noStringsText.slice(deadStartCandidate, block.end);
        const firstNonSpace = deadSlice.search(/\S/);
        if (firstNonSpace === -1) continue; // nothing but whitespace/blanked comments - not actually dead

        const deadStart = deadStartCandidate + firstNonSpace;
        reportDeadZone(vscode, doc, diagnostics, deadStart, block.end, `an unconditional '${kw}'`);
        reportedZones.push([deadStart, block.end]);
    }

    // Beyond a single unconditional terminator, an if/elif/.../else chain
    // where EVERY branch (including a final, catch-all else) ends in its own
    // terminator also makes control flow leave unconditionally - so code
    // after the whole chain, in the enclosing block, is unreachable too.
    // conditionalChains' offsets come from cleanText, but blankRanges()
    // preserves character positions/length when producing noStringsText, so
    // they line up with noStringsText slices directly.
    if (conditionalChains) {
        for (const chain of conditionalChains) {
            const lastBranch = chain[chain.length - 1];
            if (lastBranch.type !== 'else') continue; // not exhaustive - no catch-all branch
            const allTerminate = chain.every((branch) =>
                bodyEndsWithTerminator(noStringsText.slice(branch.bodyStart, branch.bodyEnd))
            );
            if (!allTerminate) continue;

            const chainEnd = lastBranch.bodyEnd + 1; // just past the chain's closing '}'
            if (reportedZones.some(([zs, ze]) => chainEnd >= zs && chainEnd < ze)) continue;

            const block = findInnermostBlock(blocks, chainEnd);
            if (!block) continue;

            const deadSlice = noStringsText.slice(chainEnd, block.end);
            const firstNonSpace = deadSlice.search(/\S/);
            if (firstNonSpace === -1) continue;

            const deadStart = chainEnd + firstNonSpace;
            if (reportedZones.some(([zs, ze]) => deadStart >= zs && deadStart < ze)) continue;

            reportDeadZone(vscode, doc, diagnostics, deadStart, block.end, 'an if/elif/else chain where every branch already returns, breaks, continues, or throws');
            reportedZones.push([deadStart, block.end]);
        }
    }

    return diagnostics;
}

module.exports = { checkUnreachableCode, findBlocks, findInnermostBlock, findStatementSemicolon, bodyEndsWithTerminator };
