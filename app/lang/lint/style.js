const vscode = require('vscode');

function makeDiagnostic(range, message, severity, code) {
    const diag = new vscode.Diagnostic(range, message, severity);
    diag.code = code;
    return diag;
}

function checkStyle(cleanText, noStringsText, doc, declaredVars) {
    const diagnostics = [];
    const lines = doc.getText().split(/\r?\n/);
    const cleanLines = cleanText.split(/\r?\n/);

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
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                'Style Warning: There should never be more than one statement on a single line.',
                vscode.DiagnosticSeverity.Warning,
                'bml-multiple-statements-per-line'
            ));
        }

        // Trailing comma check: e.g. put(fancyStepDict, "waitingForSignature", );
        const cleanRawLine = cleanLines[i].split('//')[0];
        const lineWithoutStrings = cleanRawLine.replace(/"(?:[^"\\]|\\.)*"/g, '"x"');
        const trailingCommaMatch = lineWithoutStrings.match(/,\s*([)\]])/);
        if (trailingCommaMatch) {
            const char = trailingCommaMatch[1];
            const startPos = new vscode.Position(i, 0);
            const endPos = new vscode.Position(i, lines[i].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Syntax Error: Trailing comma before closing '${char}' is not allowed.`,
                vscode.DiagnosticSeverity.Error,
                'bml-trailing-comma-error'
            ));
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
                const startPos = new vscode.Position(i, 0);
                const endPos = new vscode.Position(i, lines[i].length);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    'Style Warning: Curly brackets should always open at the end of a line of code, and no code should follow them.',
                    vscode.DiagnosticSeverity.Warning,
                    'bml-brace-style-open'
                ));
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
            
            // Allow expressions or initializers like '};', '},', '})', etc.
            const isExpressionOrInitializer = /^[);,]/.test(afterBrace);

            let isViolation = false;
            if (!isExpressionOrInitializer) {
                if ((beforeBrace.length > 0 && !beforeBrace.endsWith('{')) || (afterBrace.length > 0 && !isElseOrElif)) {
                    isViolation = true;
                }
            }

            if (isViolation) {
                const startPos = new vscode.Position(i, 0);
                const endPos = new vscode.Position(i, lines[i].length);
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    'Style Warning: Curly brackets should always close at the beginning of a line of code, and no code should exist on the same line.',
                    vscode.DiagnosticSeverity.Warning,
                    'bml-brace-style-close'
                ));
            }
        }
    }

    // 4. Local Variable Naming checks (Removed to align with official Oracle BML standards)

    // 5. Functions with a single argument must have parenthesis
    // e.g. not hasLicensing -> not(hasLicensing)
    const singleArgRegex = /\b(not)\s+([a-zA-Z_]\w*)\b/g;
    let match;
    while ((match = singleArgRegex.exec(noStringsText)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, match[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `Style Warning: Functions/operators with a single argument should enclose that argument in parentheses, e.g. not(${match[2]}) rather than not ${match[2]}.`,
            vscode.DiagnosticSeverity.Warning,
            'bml-not-without-parens'
        ));
    }

    // 6. Print statements inside debug block check
    // Matches both call syntax (print(x)) and BML's equally-valid bare
    // statement syntax (print x;, print "literal";) - both are shown as
    // interchangeable in Oracle's own docs/examples, so only matching the
    // parenthesized form missed the bare form entirely. Checked against
    // cleanLines (comments blanked, string literals intact) rather than
    // noStringsLines: getStringRanges blanks the quote characters too, so a
    // bare `print "just a literal";` would otherwise look like nothing but
    // whitespace up to the semicolon and never match.
    const printTriggerRegex = /\bprint\b\s*(?:\(|[^\s;])/;
    for (let i = 0; i < noStringsLines.length; i++) {
        const line = noStringsLines[i];
        if (printTriggerRegex.test(cleanLines[i])) {
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
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    'Style Info: Print statements should be enclosed in a debug-flag controlled if block (e.g. if (debug) { ... }).',
                    vscode.DiagnosticSeverity.Information,
                    'bml-unguarded-print'
                ));
            }
        }
    }



    // 8. Very long statement check (>200 chars, excluding strings/comments)
    // A bmql(...) call's query string has to stay on one line - BML has no
    // line-continuation syntax that keeps a string literal intact across
    // lines - so a long BMQL query legitimately can't be wrapped and is
    // exempt from this check.
    const bmqlLineRe = /\bbmql\s*\(/i;
    for (let i = 0; i < noStringsLines.length; i++) {
        const line = noStringsLines[i];
        const codeOnly = line.split('//')[0].trim();
        if (codeOnly.length > 200 && !bmqlLineRe.test(lines[i])) {
            const startPos = new vscode.Position(i, 0);
            const endPos = new vscode.Position(i, lines[i].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Style Warning: Line exceeds 200 characters of code (${codeOnly.length} chars). Consider breaking it into multiple lines.`,
                vscode.DiagnosticSeverity.Warning,
                'bml-line-too-long'
            ));
        }
    }

    return diagnostics;
}

module.exports = { checkStyle };
