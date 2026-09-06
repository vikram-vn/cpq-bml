const { vscode, makeDiagnostic } = require('./shared');

/**
 * Constructs that look plausible but aren't valid BML:
 * break/continue outside a loop, object-style member access.
 *
 * Codes: bml-loop-control-outside-loop,
 *        bml-invalid-member-access
 */
function checkSyntaxRules(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Loop Control Statement Check (break/continue outside of loops, run on noStringsText)
    if (noStringsText.includes('break') || noStringsText.includes('continue')) {
        const braceOrKeywordRegex = /\{|\}|\bfor\b|\bbreak\b|\bcontinue\b/g;
        const braceStack = [];
        let lastWasFor = false;
        let loopMatch;
        while ((loopMatch = braceOrKeywordRegex.exec(noStringsText)) !== null) {
            const token = loopMatch[0];
            if (token === 'for') {
                lastWasFor = true;
            } else if (token === '{') {
                braceStack.push(lastWasFor ? 'loop' : 'other');
                lastWasFor = false;
            } else if (token === '}') {
                if (braceStack.length > 0) {
                    braceStack.pop();
                }
            } else if (token === 'break' || token === 'continue') {
                const isInLoop = braceStack.includes('loop');
                if (!isInLoop) {
                    const startPos = doc.positionAt(loopMatch.index);
                    const endPos = startPos.translate(0, token.length);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `BML Syntax Error: '${token}' statement is only allowed inside a loop body.`,
                        vscode.DiagnosticSeverity.Error,
                        'bml-loop-control-outside-loop'
                    ));
                }
                lastWasFor = false;
            } else {
                lastWasFor = false;
            }
        }
    }

    // Invalid Member Access Check (run on noStringsText)
    if (noStringsText.includes('.')) {
        const invalidDotRegex = /\b([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\s*\()?/g;
        let match;
        while ((match = invalidDotRegex.exec(noStringsText)) !== null) {
            const prefix = match[1];
            const suffix = match[2];
            const isMethodCall = match[0].trim().endsWith("(");
            if (prefix === "util" || prefix === "commerce" || prefix.toLowerCase() === "cpqjs") {
                continue;
            }
            const beforeMatch = noStringsText.slice(Math.max(0, match.index - 12), match.index);
            if (/\b(?:util|commerce|cpqjs)\.$/i.test(beforeMatch)) {
                continue;
            }
            const isInvalidProperty = suffix === "length" || suffix === "size";
            if (isMethodCall || isInvalidProperty) {
                const startPos = doc.positionAt(match.index);
                const endPos = doc.positionAt(match.index + match[0].length);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    `BML Syntax Error: Member access or method call ('${match[0].trim()}') is not supported. BML does not have objects, properties, or methods. Use standard BML functions instead (e.g., 'sizeofarray()', 'jsonget()', 'get()').`,
                    vscode.DiagnosticSeverity.Error,
                    'bml-invalid-member-access'
                ));
            }
        }
    }

    return diagnostics;
}

module.exports = { checkSyntaxRules };
