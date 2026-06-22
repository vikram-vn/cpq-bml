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

// Flags code between a terminating statement (return/break/continue/throwerror) and
// the closing brace of its enclosing block - control has already left unconditionally.
function checkUnreachableCode(noStringsText, doc, vscode) {
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
        const startPos = doc.positionAt(deadStart);
        const endPos = doc.positionAt(block.end);
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            `Unreachable code: this can never execute - it comes after an unconditional '${kw}'.`,
            vscode.DiagnosticSeverity.Warning
        );
        diag.code = 'bml-unreachable-code';
        diagnostics.push(diag);
        reportedZones.push([deadStart, block.end]);
    }

    return diagnostics;
}

module.exports = { checkUnreachableCode, findBlocks, findInnermostBlock, findStatementSemicolon };
