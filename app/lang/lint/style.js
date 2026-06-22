const vscode = require('vscode');

function checkStyle(cleanText, noStringsText, doc, declaredVars) {
    const diagnostics = [];
    const lines = doc.getText().split(/\r?\n/);



    // 2. Multiple statements and Curly brackets alignment checks
    // Scan noStringsText line by line
    const noStringsLines = noStringsText.split(/\r?\n/);
    for (let i = 0; i < noStringsLines.length; i++) {
        const line = noStringsLines[i];
        const rawCodeLine = line.split('//')[0];
        
        // Semicolon count check
        const semicolonCount = (rawCodeLine.match(/;/g) || []).length;
        if (semicolonCount > 1) {
            const startPos = new vscode.Position(i, 0);
            const endPos = new vscode.Position(i, lines[i].length);
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    'Style Warning: There should never be more than one statement on a single line.',
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }

        const codeLine = rawCodeLine.trim();

        // Skip array literals (e.g. string[]{"a"} or string[5]{"a"})
        if (codeLine.includes('[]') || codeLine.match(/\w+\s*\[/)) {
            continue;
        }

        // Opening brace '{' check: must open at the end of the line
        if (codeLine.includes('{') && !codeLine.includes('{{')) {
            const idx = codeLine.indexOf('{');
            const afterBrace = codeLine.substring(idx + 1).trim();
            if (afterBrace.length > 0 && !afterBrace.startsWith('}')) {
                const startPos = new vscode.Position(i, lines[i].indexOf('{'));
                const endPos = new vscode.Position(i, lines[i].length);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        'Style Warning: Curly brackets should always open at the end of a line of code, and no code should follow them.',
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }

        // Closing brace '}' check: must close at the beginning and end of a line of code
        if (codeLine.includes('}') && !codeLine.includes('}}')) {
            const idx = codeLine.indexOf('}');
            const beforeBrace = codeLine.substring(0, idx).trim();
            const afterBrace = codeLine.substring(idx + 1).trim();
            
            // Allow '} else {' or '} elif (...) {' - BML's own brace_style: 'collapse'
            // default (the beautifier's HUGS_PREVIOUS_BLOCK list) treats elif exactly
            // like else, so a chain of '} elif (...) {' is the *recommended* shape,
            // not a violation - real CPQ library code almost always writes it this way.
            const isElseOrElif = /^(else|elif)\b/i.test(afterBrace);

            if ((beforeBrace.length > 0 && !beforeBrace.endsWith('{')) || (afterBrace.length > 0 && !isElseOrElif)) {
                const startPos = new vscode.Position(i, lines[i].indexOf('}'));
                const endPos = new vscode.Position(i, lines[i].length);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        'Style Warning: Curly brackets should always close at the beginning of a line of code, and no code should exist on the same line.',
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }
    }

    // 4. Local Variable Naming checks
    declaredVars.forEach((decls, varName) => {
        decls.forEach(decl => {
            const startPos = decl.range.start;
            const lineText = lines[startPos.line];
            const cleanLine = noStringsLines[startPos.line].split('//')[0];

            // A. Check Dictionary Naming & Comments
            if (cleanLine.includes('dict(')) {
                if (!varName.endsWith('Dict')) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Dictionary variable '${varName}' should have the 'Dict' suffix.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
                // Check for trailing comment explaining mapping
                const hasMappingComment = /\/\/\s*Key\s*:\s*.*,\s*Value\s*:\s*/i.test(lineText);
                if (!hasMappingComment) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Dictionary declaration '${varName}' must have a comment at the end explaining the Key/Value mapping (e.g. //Key: ..., Value: ...).`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }

            // B. Check Array Suffix
            else if (cleanLine.includes('[]') || cleanLine.match(/\[\s*\d+\s*\]/) || cleanLine.includes('sizeofarray')) {
                const hasArraySuffix = varName.endsWith('List') || varName.endsWith('Arr') || varName.endsWith('Array') || varName.endsWith('2D');
                if (!hasArraySuffix) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Array variable '${varName}' should have 'List', 'Arr', 'Array', or '2D' suffix.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }

            // C. Check RecordSet Suffix
            else if (cleanLine.includes('bmql(') || cleanLine.includes('gettabledata(')) {
                const hasRecordSetSuffix = varName.endsWith('Records') || varName === 'row' || varName === 'record' || varName.endsWith('Record');
                if (!hasRecordSetSuffix) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: RecordSet variable '${varName}' should have the 'Records' suffix.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }

            // D. Check Boolean Prefix
            else if (cleanLine.includes('true') || cleanLine.includes('false') || (cleanLine.match(/[=!<>]=|<|>/) && !cleanLine.includes('dict') && !cleanLine.includes('bmql') && !cleanLine.includes('gettabledata'))) {
                // If it is indeed a boolean comparison or boolean value assignment
                const isBooleanName = varName.startsWith('is') || varName.startsWith('has') || varName === 'debug' || varName === 'debugFlag';
                if (!isBooleanName) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Boolean variable '${varName}' should have 'is' or 'has' prefix.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }

            // E. General camelCase vs Constants checks
            const isConstant = varName === varName.toUpperCase() || varName.includes('_');
            if (isConstant) {
                // Constants: must capitalize all letters, can use underscores
                if (varName.toUpperCase() !== varName) {
                    // Not uppercase
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Constant variable '${varName}' should be in ALL_CAPS.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            } else {
                // Variables: camelCase, no underscores
                const startsWithLower = /^[a-z]/.test(varName);
                const hasUnderscore = varName.includes('_');
                
                if (!startsWithLower) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Variable '${varName}' should start with a lowercase letter (camelCase).`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
                if (hasUnderscore) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            decl.range,
                            `Naming Warning: Variable '${varName}' should use camelCase and not contain underscores.`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }
        });
    });

    // 5. Functions with a single argument must have parenthesis
    // e.g. not hasLicensing -> not(hasLicensing)
    const singleArgRegex = /\b(not)\s+([a-zA-Z_]\w*)\b/g;
    let match;
    while ((match = singleArgRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, match[0].length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Style Warning: Functions/operators with a single argument should enclose that argument in parentheses, e.g. not(${match[2]}) rather than not ${match[2]}.`,
                vscode.DiagnosticSeverity.Warning
            )
        );
    }

    // 6. Print statements inside debug block check
    for (let i = 0; i < noStringsLines.length; i++) {
        const line = noStringsLines[i];
        if (line.includes('print(')) {
            // Check if print is enclosed in a debug-controlled block
            // We can look upwards to find if there is an active 'if' with 'debug'
            let isDebugControlled = false;
            let openBraceCount = 0;
            for (let j = i; j >= 0; j--) {
                const prevLine = noStringsLines[j].trim();
                if (prevLine.includes('}')) {
                    openBraceCount--;
                }
                if (prevLine.includes('{')) {
                    openBraceCount++;
                    if (openBraceCount > 0 && prevLine.toLowerCase().includes('if') && prevLine.toLowerCase().includes('debug')) {
                        isDebugControlled = true;
                        break;
                    }
                }
            }

            if (!isDebugControlled) {
                const startPos = new vscode.Position(i, lines[i].indexOf('print'));
                const endPos = startPos.translate(0, 5);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        'Style Info: Print statements should be enclosed in a debug-flag controlled if block (e.g. if (debug) { ... }).',
                        vscode.DiagnosticSeverity.Information
                    )
                );
            }
        }
    }

    return diagnostics;
}

module.exports = { checkStyle };
