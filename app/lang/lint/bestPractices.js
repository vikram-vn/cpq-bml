const vscode = require('vscode');

function checkBestPractices(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // 1. Deprecated methods (run on noStringsText to ignore calls inside strings/comments)
    const deprecatedRegex = /\b(strtodate|gettabledata|getpartsdata)\b/g;
    let match;
    while ((match = deprecatedRegex.exec(noStringsText)) !== null) {
        const name = match[1];
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, name.length);
        
        let message = '';
        let severity = vscode.DiagnosticSeverity.Warning;
        if (name === 'strtodate') {
            message = `Deprecated function 'strtodate'. Use 'strtojavadate' instead`;
        } else {
            message = `Deprecated function '${name}'. Use 'bmql' instead to avoid SQL injection vulnerability`;
            severity = vscode.DiagnosticSeverity.Error; // SQL vulnerability is High risk
        }

        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            message,
            severity
        );
        if (name === 'strtodate') {
            diag.code = 'bml-strtodate-fix';
        } else if (name === 'gettabledata') {
            diag.code = 'bml-gettabledata-fix';
        } else if (name === 'getpartsdata') {
            diag.code = 'bml-getpartsdata-fix';
        }
        diagnostics.push(diag);
    }

    // 2. Oracle Constants: NaN vs jNaN (run on noStringsText)
    const nanRegex = /\bNaN\b/g;
    while ((match = nanRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, 3);
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            "Deprecated constant 'NaN'. Use 'jNaN' instead for Java compatibility",
            vscode.DiagnosticSeverity.Warning
        );
        diag.code = 'bml-nan-fix';
        diagnostics.push(diag);
    }

    // 3. SQL Injection and SELECT * in BMQL (run on cleanText since we need string literals intact)
    const bmqlRegex = /\bbmql\s*\(/gi;
    while ((match = bmqlRegex.exec(cleanText)) !== null) {
        const startIdx = match.index;
        let depth = 1;
        let endIdx = -1;
        for (let i = startIdx + match[0].length; i < cleanText.length; i++) {
            if (cleanText[i] === '(') depth++;
            else if (cleanText[i] === ')') depth--;
            if (depth === 0) {
                endIdx = i;
                break;
            }
        }

        if (endIdx !== -1) {
            const argsText = cleanText.slice(startIdx + match[0].length, endIdx);
            let inSingleQuote = false;
            let inDoubleQuote = false;
            let hasDynamicConcat = false;
            let queryLiteralText = '';

            for (let j = 0; j < argsText.length; j++) {
                const char = argsText[j];
                if (char === "'" && !inDoubleQuote) {
                    inSingleQuote = !inSingleQuote;
                } else if (char === '"' && !inSingleQuote) {
                    inDoubleQuote = !inDoubleQuote;
                } else if (char === '+' && !inSingleQuote && !inDoubleQuote) {
                    hasDynamicConcat = true;
                }

                if (inSingleQuote || inDoubleQuote) {
                    queryLiteralText += char;
                }
            }

            const startPos = doc.positionAt(startIdx);
            const endPos = doc.positionAt(endIdx + 1);
            const range = new vscode.Range(startPos, endPos);

            if (hasDynamicConcat) {
                diagnostics.push(
                    new vscode.Diagnostic(
                        range,
                        'Security Warning: Dynamic query concatenation detected in BMQL. Use $variable syntax instead to prevent SQL injection',
                        vscode.DiagnosticSeverity.Error
                    )
                );
            }

            if (/\bselect\s+\*/i.test(queryLiteralText)) {
                diagnostics.push(
                    new vscode.Diagnostic(
                        range,
                        "Commerce Best Practice: Avoid using 'SELECT *' in BMQL. Explicitly list the required columns to optimize performance and reduce memory usage.",
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }
    }

    // 4. Empty Blocks (run on noStringsText)
    const emptyBlockRegex = /\b(if|elif)\s*\(.*?\)\s*\{\s*\}|\bfor\s*(?:\(.*?\)|[^{]*?)\s*\{\s*\}|\belse\s*\{\s*\}/gi;
    while ((match = emptyBlockRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                'Design Warning: Empty block detected',
                vscode.DiagnosticSeverity.Warning
            )
        );
    }

    // 5. Magic Numbers (run on noStringsText to ignore numbers inside strings)
    const magicNumRegex = /\b\d+(?:\.\d+)?\b/g;
    const standardNumbers = new Set(['0', '1', '2', '10', '100', '0.0', '1.0', '2.0']);
    while ((match = magicNumRegex.exec(noStringsText)) !== null) {
        const val = match[0];
        if (standardNumbers.has(val)) {
            continue;
        }

        const index = match.index;
        if (index > 0) {
            const precedingChar = noStringsText[index - 1];
            if (precedingChar === '.' || precedingChar === '_' || /[a-zA-Z]/.test(precedingChar)) {
                continue; // part of property or variable name
            }
        }

        const startPos = doc.positionAt(index);
        const endPos = startPos.translate(0, val.length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Design Info: Magic number '${val}' detected. Consider defining a named constant`,
                vscode.DiagnosticSeverity.Information
            )
        );
    }

    // 6. _config_attributes / _config_attr_text Ban (run on noStringsText)
    const configAttrsRegex = /\b(_config_attributes|_config_attr_text)\b/gi;
    while ((match = configAttrsRegex.exec(noStringsText)) !== null) {
        const attr = match[1];
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, attr.length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Commerce Best Practice: Never use '${attr}' in Commerce BML`,
                vscode.DiagnosticSeverity.Warning
            )
        );
    }

    // 7. Commerce Return Format Check (run on cleanText lines)
    const lines = cleanText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isReturnOrRet = line.trim().startsWith("return ") || line.trim().startsWith("ret =") || line.trim().startsWith("ret=");
        if (isReturnOrRet && line.includes("~") && !line.includes("|")) {
            const startPos = new vscode.Position(i, 0);
            const endPos = new vscode.Position(i, line.length);
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    "Commerce Best Practice: Return information must be formatted as '[docNo]~variableName~variableValue|' (missing '|' delimiter)",
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    // 8. isnumber Check before atoi/atof (run on noStringsText)
    const atoiRegex = /\b(atoi|atof)\s*\(\s*([a-zA-Z_]\w*)\s*\)/g;
    while ((match = atoiRegex.exec(noStringsText)) !== null) {
        const func = match[1];
        const varName = match[2];
        const startIndex = match.index;
        const contextStart = Math.max(0, startIndex - 2000);
        const contextText = noStringsText.substring(contextStart, startIndex);
        // Real CPQ library code validates numericality a few different ways, not
        // just the literal isnumber(x) call: isnull(x) and trim(x) == ""/<> ""
        // empty-string checks are just as safe a guard before atoi/atof, and are
        // the more common idiom in practice (see e.g. abo_jsonCompare's
        // `if (isnull(string1) or trim(string1) == "") { string1 = dummyNumber; }`
        // pattern before its atof() calls).
        const safeBeforeAtoRegex = new RegExp(
            `\\bisnumber\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\bisnull\\s*\\(\\s*${varName}\\s*\\)` +
            `|\\btrim\\s*\\(\\s*${varName}\\s*\\)\\s*(?:==|<>|!=)\\s*["']{2}` +
            `|\\b${varName}\\s*(?:==|<>|!=)\\s*["']{2}`,
            'i'
        );
        if (!safeBeforeAtoRegex.test(contextText)) {
            const startPos = doc.positionAt(startIndex);
            const endPos = startPos.translate(0, match[0].length);
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `Safety Warning: Validate numericality of data with 'isnumber(${varName})' or use a safe wrapper like 'customAtoi'/'customAtof' before calling '${func}'`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    // 9. Split Array Size Verification (run on noStringsText)
    const splitVars = new Set();
    const splitRegex = /\b([a-zA-Z_]\w*)\s*=\s*split\s*\(/g;
    let splitMatch;
    while ((splitMatch = splitRegex.exec(noStringsText)) !== null) {
        splitVars.add(splitMatch[1]);
    }

    if (splitVars.size > 0) {
        const arrayAccessRegex = new RegExp(`\\b(${Array.from(splitVars).join('|')})\\s*\\[\\s*([^\\]]+)\\s*\\]`, 'g');
        let accessMatch;
        while ((accessMatch = arrayAccessRegex.exec(noStringsText)) !== null) {
            const varName = accessMatch[1];
            const accessIndex = accessMatch.index;
            
            const contextStart = Math.max(0, accessIndex - 2000);
            const contextText = noStringsText.substring(contextStart, accessIndex);
            const sizeCheckRegex = new RegExp(`\\bsizeofarray\\s*\\(\\s*${varName}\\s*\\)`, 'i');
            if (!sizeCheckRegex.test(contextText)) {
                const startPos = doc.positionAt(accessIndex);
                const endPos = doc.positionAt(accessIndex + accessMatch[0].length);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Safety Warning: Check the size of the split array '${varName}' using 'sizeofarray()' before accessing elements`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }
    }

    // 10. Missing Return Statement Check (run on noStringsText to ignore return in strings/comments)
    if (!/\breturn\b/.test(noStringsText)) {
        const startPos = new vscode.Position(0, 0);
        const endLineText = doc.lineCount > 0 ? doc.lineAt(0).text : '';
        const endPos = new vscode.Position(0, Math.max(1, endLineText.length));
        const range = new vscode.Range(startPos, endPos);
        diagnostics.push(
            new vscode.Diagnostic(
                range,
                "Script is missing a return statement",
                vscode.DiagnosticSeverity.Error
            )
        );
    }

    // 11. dict() requires a type argument (e.g. dict("string"), dict("anytype")) -
    // dict() with no arguments compiles but throws at runtime. Must run on cleanText
    // (comments blanked, strings left intact) rather than noStringsText - the latter
    // blanks the quotes *and* the type-string content too, so a perfectly valid
    // dict("string") call would otherwise look like an empty dict() call once its
    // argument was blanked away.
    const dictNoArgsRegex = /\bdict\s*\(\s*\)/g;
    while ((match = dictNoArgsRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        const diag = new vscode.Diagnostic(
            new vscode.Range(startPos, endPos),
            `'dict()' requires a type argument (e.g. dict("string"), dict("integer[]"), dict("anytype")) - calling it with none will throw at runtime`,
            vscode.DiagnosticSeverity.Error
        );
        diag.code = 'bml-dict-missing-type';
        diagnostics.push(diag);
    }

    // 12. Division by a literal zero - always a runtime exception in BML, never
    // intentional. Parse the full numeric literal rather than pattern-matching
    // on '0' directly so '/ 0.5' (a perfectly normal divisor) isn't mistaken for
    // '/ 0' just because it starts with the digit zero.
    const divisionRegex = /\/\s*(\d+(?:\.\d+)?)\b/g;
    while ((match = divisionRegex.exec(noStringsText)) !== null) {
        if (parseFloat(match[1]) !== 0) continue;
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                `Division by literal zero ('${match[1]}') will throw a runtime exception`,
                vscode.DiagnosticSeverity.Error
            )
        );
    }

    // 13. Hardcoded URLs check (run on cleanText string literals)
    const urlRegex = /"(https?:\/\/[^\s"]+)"|'(https?:\/\/[^\s']+)'/gi;
    while ((match = urlRegex.exec(cleanText)) !== null) {
        const url = match[1] || match[2];
        if (url && url.length > 8 && !url.endsWith('://')) {
            if (url.includes('w3.org') || url.includes('schema.org')) {
                continue;
            }
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    "Design Warning: Hardcoded URL detected. Consider using a dynamic configuration, Data Table, or System Variable to avoid environment-specific issues.",
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    // 14. Float Equality Comparison (run on noStringsText)
    const floatCompareRegex = /\b([a-zA-Z_]\w*)\s*(==|!=|<>)\s*(\d+\.\d+)|(\d+\.\d+)\s*(==|!=|<>)\s*\b([a-zA-Z_]\w*)/g;
    while ((match = floatCompareRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                "Safety Warning: Comparing float values directly with '==' or '!=' can lead to precision errors. Consider using a tolerance threshold.",
                vscode.DiagnosticSeverity.Warning
            )
        );
    }

    // 15. Array Element Assignment Check (run on noStringsText)
    const arrayAssignRegex = /\b([a-zA-Z_]\w*)\s*\[[^\]]+\]\s*=(?!=)/g;
    while ((match = arrayAssignRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                "BML Syntax Error: Array element assignment (e.g. 'arr[index] = value') is not supported in BML. Use array functions like 'append()', 'insert()', or construct a new array instead.",
                vscode.DiagnosticSeverity.Error
            )
        );
    }

    // 16. Loop Control Statement Check (break/continue outside of loops, run on noStringsText)
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
                const endPos = doc.positionAt(loopMatch.index + token.length);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `BML Syntax Error: '${token}' statement is only allowed inside a loop body.`,
                        vscode.DiagnosticSeverity.Error
                    )
                );
            }
            lastWasFor = false;
        } else {
            lastWasFor = false;
        }
    }

    // 17. Invalid Member Access Check (run on noStringsText)
    const invalidDotRegex = /\b([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\s*\()?/g;
    while ((match = invalidDotRegex.exec(noStringsText)) !== null) {
        const prefix = match[1];
        const suffix = match[2];
        const isMethodCall = match[0].trim().endsWith("(");
        if (prefix === "util" || prefix === "commerce") {
            continue;
        }
        const isInvalidProperty = suffix === "length" || suffix === "size";
        if (isMethodCall || isInvalidProperty) {
            const startPos = doc.positionAt(match.index);
            const endPos = doc.positionAt(match.index + match[0].length);
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `BML Syntax Error: Member access or method call ('${match[0].trim()}') is not supported. BML does not have objects, properties, or methods. Use standard BML functions instead (e.g., 'sizeofarray()', 'jsonget()', 'get()').`,
                    vscode.DiagnosticSeverity.Error
                )
            );
        }
    }

    return diagnostics;
}

module.exports = { checkBestPractices };
