const { parseConditionalChains } = require('./duplicateBranches');

// Flags an else-block whose entire body is just one if/elif*/else? chain - BML has a
// first-class 'elif' for this, unlike JS's "else if". conditionalChains is the shared
// top-level parse from lint.js; cleanText is still needed since each else-branch's
// body gets re-parsed independently below.
function checkLonelyIf(cleanText, conditionalChains, doc, vscode) {
    const diagnostics = [];

    for (const chain of conditionalChains) {
        for (const branch of chain) {
            if (branch.type !== 'else') continue;

            // parseConditionalChains treats {...} bodies as opaque, so the body must be
            // parsed as its own independent text to look inside it.
            const bodyText = cleanText.slice(branch.bodyStart, branch.bodyEnd);
            const leadingWhitespace = bodyText.match(/^\s*/)[0].length;

            const innerChains = parseConditionalChains(bodyText).filter(
                (c) => c[0].kwStart === leadingWhitespace
            );
            if (innerChains.length !== 1) continue;

            const innerChain = innerChains[0];
            const lastInnerBranch = innerChain[innerChain.length - 1];
            // bodyEnd points at the chain's own closing '}'; nothing else may follow it.
            if (bodyText.slice(lastInnerBranch.bodyEnd + 1).trim() !== '') continue;

            const startPos = doc.positionAt(branch.kwStart);
            const endPos = startPos.translate(0, 'else'.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `This 'else' contains nothing but a single 'if' statement - use 'elif' instead, BML has it specifically for this.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-lonelyIf';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkLonelyIf };
