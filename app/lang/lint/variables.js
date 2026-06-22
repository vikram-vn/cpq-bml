const vscode = require('vscode');

function getDeclaredVariables(cleanText, doc) {
    const declaredVars = new Map(); // varName -> Array of { index, range, isLoopVar }
    
    // 1. Find all assignments: varName =
    const varDeclRegex = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;
    let match;
    while ((match = varDeclRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const matchIndex = match.index;
        
        // Filter out operators like <=, >=, !=, <>
        let idx = matchIndex - 1;
        while (idx >= 0 && /\s/.test(cleanText[idx])) {
            idx--;
        }
        if (idx >= 0 && (cleanText[idx] === '<' || cleanText[idx] === '>' || cleanText[idx] === '!')) {
            continue;
        }

        const startPos = doc.positionAt(matchIndex);
        const endPos = startPos.translate(0, varName.length);
        const range = new vscode.Range(startPos, endPos);

        if (!declaredVars.has(varName)) {
            declaredVars.set(varName, []);
        }
        declaredVars.get(varName).push({ index: matchIndex, range, isLoopVar: false });
    }

    // 2. Find all loop variables: for varName in ...
    const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+/gi;
    while ((match = loopRegex.exec(cleanText)) !== null) {
        const varName = match[1];
        const startPos = doc.positionAt(match.index + match[0].indexOf(varName));
        const endPos = startPos.translate(0, varName.length);
        const range = new vscode.Range(startPos, endPos);
        const matchIndex = match.index + match[0].indexOf(varName);

        if (!declaredVars.has(varName)) {
            declaredVars.set(varName, []);
        }
        declaredVars.get(varName).push({ index: matchIndex, range, isLoopVar: true });
    }

    return declaredVars;
}

function checkVariableDiagnostics(cleanText, declaredVars, doc) {
    const diagnostics = [];

    // Find all blocks { ... } to help with shadowing
    const blocks = [];
    const stack = [];
    for (let i = 0; i < cleanText.length; i++) {
        if (cleanText[i] === '{') {
            stack.push({ start: i });
        } else if (cleanText[i] === '}') {
            if (stack.length > 0) {
                const block = stack.pop();
                block.end = i + 1;
                blocks.push(block);
            }
        }
    }

    // Usage check used to compile a fresh RegExp and rescan the whole file
    // once PER declared variable name (O(variables x file length) - on a
    // large file with many locals, that's the full text re-walked dozens of
    // times). One single pass over the text instead, recording every
    // non-property-access identifier occurrence's index by name; each
    // variable's "is it used anywhere besides its own declarations" check
    // below then just looks for one recorded index outside its declIndices.
    const occurrencesByName = new Map();
    const identRegex = /\b[a-zA-Z_]\w*\b/g;
    let identMatch;
    while ((identMatch = identRegex.exec(cleanText)) !== null) {
        const idx = identMatch.index;
        let before = idx - 1;
        while (before >= 0 && /\s/.test(cleanText[before])) before--;
        if (before >= 0 && cleanText[before] === '.') continue; // property access, not a bare reference
        const name = identMatch[0];
        if (!occurrencesByName.has(name)) occurrencesByName.set(name, []);
        occurrencesByName.get(name).push(idx);
    }

    declaredVars.forEach((decls, varName) => {
        // Sort declarations by index
        decls.sort((a, b) => a.index - b.index);

        // 1. Check for Shadowing
        decls.forEach(decl => {
            if (decl.isLoopVar) {
                // If there is any declaration of the same variable name *before* this loop variable
                // that is outside the loop block, it's shadowing.
                const shadowed = decls.find(other => other.index < decl.index && !other.isLoopVar);
                if (shadowed) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Variable shadowing: '${varName}' shadows a variable in an outer scope`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }
        });

        // 2. Check for Unused Variable: used somewhere other than its own
        // declaration/assignment sites (property-access occurrences were
        // already excluded while building occurrencesByName above).
        const declIndices = new Set(decls.map(d => d.index));
        const occurrences = occurrencesByName.get(varName) || [];
        const isUsed = occurrences.some(index => !declIndices.has(index));

        if (!isUsed) {
            // Flag the first declaration/assignment as unused
            const firstDecl = decls[0];

            // A 'for x in someArray { ... }' whose body never references x is a
            // very common, often deliberate BML idiom for "repeat once per item"
            // when only the iteration count matters (the real per-item value is
            // tracked separately, e.g. via a manually-incremented index variable).
            // That's a meaningfully different situation from a normal variable
            // that was assigned and then forgotten, so it gets a lower-severity,
            // more precise diagnostic instead of the same 'Unused variable' Warning.
            const isOnlyLoopVar = decls.every(d => d.isLoopVar);
            if (isOnlyLoopVar) {
                const diag = new vscode.Diagnostic(
                    firstDecl.range,
                    `Unused loop variable: '${varName}' is never referenced inside its loop body. This is fine if you only need to repeat the loop once per item - otherwise check for a typo.`,
                    vscode.DiagnosticSeverity.Information
                );
                diag.code = 'bml-unused-loop-var';
                diagnostics.push(diag);
            } else {
                diagnostics.push(
                    new vscode.Diagnostic(
                        firstDecl.range,
                        `Unused variable: ${varName}`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }
    });

    return diagnostics;
}

module.exports = { getDeclaredVariables, checkVariableDiagnostics };
