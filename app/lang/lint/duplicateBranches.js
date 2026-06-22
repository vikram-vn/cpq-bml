function findMatchingBracket(text, openIndex, openChar, closeChar) {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = openIndex; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
        if (inSingleQuote || inDoubleQuote) continue;
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

// Walks the whole document once, recognizing if/elif/else statements and
// their (...)condition + {...}body, and groups consecutive if -> elif* ->
// else? sequences into "chains". Bails out of a chain (resets to none) as
// soon as anything else appears between two branches, or if a condition/body
// isn't a clean (...) / {...} pair - conservative by design, since this is
// pure text scanning, not a real parser.
function parseConditionalChains(text) {
    const chains = [];
    let currentChain = null;
    let i = 0;

    while (i < text.length) {
        while (i < text.length && /\s/.test(text[i])) i++;
        if (i >= text.length) break;

        const kwMatch = /^(if|elif|else)\b/i.exec(text.slice(i, i + 4));
        if (!kwMatch) {
            currentChain = null;
            i++;
            continue;
        }

        const kw = kwMatch[1].toLowerCase();
        const kwStart = i;
        i += kwMatch[1].length;
        let conditionText = null;

        if (kw === 'if' || kw === 'elif') {
            while (i < text.length && /\s/.test(text[i])) i++;
            if (text[i] !== '(') { currentChain = null; continue; }
            const condEnd = findMatchingBracket(text, i, '(', ')');
            if (condEnd === -1) { currentChain = null; break; }
            conditionText = text.slice(i + 1, condEnd);
            i = condEnd + 1;
        }

        while (i < text.length && /\s/.test(text[i])) i++;
        if (text[i] !== '{') { currentChain = null; continue; } // single-statement bodies aren't modeled - bail on this branch
        const bodyOpen = i;
        const bodyEnd = findMatchingBracket(text, i, '{', '}');
        if (bodyEnd === -1) { currentChain = null; break; }
        i = bodyEnd + 1;
        const bodyStart = bodyOpen + 1; // first index inside the body, after '{'

        if (kw === 'if') {
            currentChain = [{ type: 'if', conditionText, kwStart, bodyStart, bodyEnd }];
            chains.push(currentChain);
        } else if (kw === 'elif' && currentChain) {
            currentChain.push({ type: 'elif', conditionText, kwStart, bodyStart, bodyEnd });
        } else if (kw === 'else' && currentChain) {
            currentChain.push({ type: 'else', conditionText: null, kwStart, bodyStart, bodyEnd });
            currentChain = null;
        } else {
            currentChain = null;
        }
    }

    return chains;
}

// ESLint's no-dupe-else-if / RuboCop's Lint/DuplicateBranch: within one
// if/elif/elif/.../else chain, a later branch whose condition is textually
// identical (whitespace-normalized) to an earlier one in the same chain can
// never run - the earlier, identical condition already caught it first.
//
// Takes chains already parsed by parseConditionalChains(cleanText) -
// comments blanked, strings intact - rather than chains parsed from
// noStringsText: comparing on string-blanked text would make `x == "a"` and
// `x == "b"` collapse to the same "normalized" condition and falsely look
// like duplicates. findMatchingBracket already tracks quotes itself, so
// parsing real string content is still safe against stray brackets inside a
// literal. lint.js parses cleanText once and passes the result to both this
// and lonelyIf.js, instead of each re-parsing the whole file independently.
function checkDuplicateConditionBranches(conditionalChains, doc, vscode) {
    const diagnostics = [];

    for (const chain of conditionalChains) {
        const seen = new Map(); // normalized condition -> first branch's kwStart
        for (const branch of chain) {
            if (branch.type === 'else' || branch.conditionText === null) continue;
            const normalized = branch.conditionText.replace(/\s+/g, ' ').trim();
            if (!normalized) continue;

            if (seen.has(normalized)) {
                const startPos = doc.positionAt(branch.kwStart);
                const endPos = startPos.translate(0, branch.type.length);
                const diag = new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `Duplicate condition: '${normalized}' was already checked earlier in this if/elif chain - this branch can never run.`,
                    vscode.DiagnosticSeverity.Warning
                );
                diag.code = 'bml-duplicate-branch-condition';
                diagnostics.push(diag);
            } else {
                seen.set(normalized, branch.kwStart);
            }
        }
    }

    return diagnostics;
}

module.exports = { checkDuplicateConditionBranches, parseConditionalChains };
