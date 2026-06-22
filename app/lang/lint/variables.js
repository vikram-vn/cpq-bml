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

        // 2. Check for Unused Variable
        // Find all occurrences of \bvarName\b in cleanText
        const wordRegex = new RegExp(`\\b${varName}\\b`, 'g');
        let match;
        let isUsed = false;

        const declIndices = decls.map(d => d.index);

        while ((match = wordRegex.exec(cleanText)) !== null) {
            const index = match.index;

            // Skip if it's one of the declaration/assignment sites
            if (declIndices.includes(index)) {
                continue;
            }

            // Skip if preceded by '.' (property access, e.g., line.varName)
            let idx = index - 1;
            while (idx >= 0 && /\s/.test(cleanText[idx])) {
                idx--;
            }
            if (idx >= 0 && cleanText[idx] === '.') {
                continue;
            }

            // Otherwise, it is a genuine usage!
            isUsed = true;
            break;
        }

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
