function findMatchingBracket(text, openIndex, openChar, closeChar) {
    const openCode = typeof openChar === 'string' ? openChar.charCodeAt(0) : openChar;
    const closeCode = typeof closeChar === 'string' ? closeChar.charCodeAt(0) : closeChar;
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        if (ch === openCode) depth++;
        else if (ch === closeCode) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

// Groups consecutive if -> elif* -> else? sequences into chains in a single linear pass.
function parseConditionalChains(text) {
    const chains = [];
    const kwRegex = /\b(if|elif|else)\b/gi;
    let match;
    let currentChain = null;
    let lastBranchEnd = -1;

    while ((match = kwRegex.exec(text)) !== null) {
        const kw = match[1].toLowerCase();
        const kwStart = match.index;
        let i = kwStart + match[0].length;

        let conditionText = null;
        if (kw === 'if' || kw === 'elif') {
            while (i < text.length && text.charCodeAt(i) <= 32) i++;
            if (text.charCodeAt(i) !== 40) { // '('
                currentChain = null;
                continue;
            }
            const condEnd = findMatchingBracket(text, i, 40, 41);
            if (condEnd === -1) { currentChain = null; break; }
            conditionText = text.slice(i + 1, condEnd);
            i = condEnd + 1;
        }

        while (i < text.length && text.charCodeAt(i) <= 32) i++;
        if (text.charCodeAt(i) !== 123) { // '{'
            currentChain = null;
            continue;
        }
        const bodyOpen = i;
        const bodyEnd = findMatchingBracket(text, i, 123, 125);
        if (bodyEnd === -1) { currentChain = null; break; }
        const bodyStart = bodyOpen + 1;

        if (kw === 'if') {
            currentChain = [{ type: 'if', conditionText, kwStart, bodyStart, bodyEnd }];
            chains.push(currentChain);
        } else if (kw === 'elif' && currentChain && kwStart >= lastBranchEnd) {
            currentChain.push({ type: 'elif', conditionText, kwStart, bodyStart, bodyEnd });
        } else if (kw === 'else' && currentChain && kwStart >= lastBranchEnd) {
            currentChain.push({ type: 'else', conditionText: null, kwStart, bodyStart, bodyEnd });
            currentChain = null;
        } else {
            currentChain = null;
        }

        lastBranchEnd = bodyEnd;
    }

    return chains;
}

// Flags a later if/elif branch whose condition is textually identical (whitespace-
// normalized) to an earlier one in the same chain - it can never run.
// Chains must come from cleanText, not noStringsText: blanking strings would make
// `x == "a"` and `x == "b"` collapse to the same condition and falsely look like duplicates.
function checkDuplicateConditionBranches(conditionalChains, doc, vscode) {
    const diagnostics = [];

    for (const chain of conditionalChains) {
        const seen = new Map();
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
