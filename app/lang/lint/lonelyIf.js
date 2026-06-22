const { parseConditionalChains } = require('./duplicateBranches');

// ESLint's no-lonely-if, adapted to BML: unlike JS's "else if" (just an else
// containing another if statement, with no dedicated syntax), BML has a
// first-class 'elif' keyword specifically so this pattern never has to be
// written by hand. An else-block whose entire body is nothing but one
// if/elif*/else? chain - with the chain consuming the body's whole start-to-
// end span, and no other statements before/after it - should have been
// written as 'elif' from the start.
// Takes the top-level chains already parsed by lint.js (one
// parseConditionalChains(cleanText) call shared with duplicateBranches.js,
// instead of each rule re-parsing the whole file independently) - cleanText
// itself is still needed too, since each else-branch's body gets re-parsed
// as its own independent text below (a different, smaller input each time,
// not a redundant repeat of the same top-level parse).
function checkLonelyIf(cleanText, conditionalChains, doc, vscode) {
    const diagnostics = [];

    for (const chain of conditionalChains) {
        for (const branch of chain) {
            if (branch.type !== 'else') continue;

            // parseConditionalChains treats {...} bodies as opaque blocks -
            // it never recurses into them - so to look "inside" this else's
            // body, parse that body's own text as an independent document,
            // not as a slice of the original (which would just reproduce
            // this same outer chain all over again).
            const bodyText = cleanText.slice(branch.bodyStart, branch.bodyEnd);
            const leadingWhitespace = bodyText.match(/^\s*/)[0].length;

            const innerChains = parseConditionalChains(bodyText).filter(
                (c) => c[0].kwStart === leadingWhitespace
            );
            if (innerChains.length !== 1) continue;

            const innerChain = innerChains[0];
            const lastInnerBranch = innerChain[innerChain.length - 1];
            // The inner chain must consume the else-body's entire remaining
            // content (aside from trailing whitespace) - nothing else may
            // come before or after it. lastInnerBranch.bodyEnd points AT its
            // own closing '}' (inclusive), so start checking right after it.
            if (bodyText.slice(lastInnerBranch.bodyEnd + 1).trim() !== '') continue;

            const startPos = doc.positionAt(branch.kwStart);
            const endPos = startPos.translate(0, 'else'.length);
            const diag = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `This 'else' contains nothing but a single 'if' statement - use 'elif' instead, BML has it specifically for this.`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'bml-lonely-if';
            diagnostics.push(diag);
        }
    }

    return diagnostics;
}

module.exports = { checkLonelyIf };
