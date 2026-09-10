const vscode = require('vscode');
const { splitArgumentsList } = require('@/lang/lint/rules/functionSignature');

function makeDiagnostic(range, message, severity, code) {
    const diag = new vscode.Diagnostic(range, message, severity);
    diag.code = code;
    return diag;
}

function isPipe(str) {
    if (!str) return false;
    const t = str.trim();
    return t === '"|"' || t === "'|'";
}

function isTilde(str) {
    if (!str) return false;
    const t = str.trim();
    return t === '"~"' || t === "'~'";
}

function isCpqLineItemArgs(args) {
    if (!args || args.length < 4) return false;

    // 7 arguments: sbappend(sb, docNum, "~", dynamicVar, "~", val, "|")
    if (args.length === 7) {
        return isTilde(args[2]) && isTilde(args[4]) && isPipe(args[6]);
    }

    // 6 arguments:
    // Case A (dynamic with pipe): sbappend(sb, "1~", dynamicVar, "~", val, "|")
    // Case B (separated docNum dynamic without pipe): sbappend(sb, docNum, "~", dynamicVar, "~", val)
    if (args.length === 6) {
        if (args[1].includes('~') && isTilde(args[3]) && isPipe(args[5])) {
            return true;
        }
        if (isTilde(args[2]) && isTilde(args[4])) {
            return true;
        }
        return false;
    }

    // 5 arguments:
    // Case A (canonical static with separated docNum): sbappend(sb, docNum, "~var~", val, "|")
    // Case B (dynamic without pipe): sbappend(sb, "1~", dynamicVar, "~", val)
    if (args.length === 5) {
        const hasTildeInVar = args[2].trim().includes('~');
        if (!isPipe(args[1]) && hasTildeInVar && isPipe(args[4])) {
            return true;
        }
        if (args[1].includes('~') && isTilde(args[3])) {
            return true;
        }
        return false;
    }

    // 4 arguments:
    // Case A (canonical static with embedded/omitted docNum): sbappend(sb, "1~var~", val, "|") or sbappend(sb, "~var~", val, "|")
    // Case B (separated docNum without pipe): sbappend(sb, docNum, "~var~", val)
    if (args.length === 4) {
        if (!isPipe(args[1]) && args[1].includes('~') && isPipe(args[3])) {
            return true;
        }
        if (!isPipe(args[1]) && args[2].trim().includes('~')) {
            return true;
        }
        return false;
    }

    return false;
}

function checkPerformance(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Helper: Find all for-loop ranges in noStringsText if any exist
    const loops = [];
    if (noStringsText.includes('for')) {
        const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+/gi;
        let match;
        while ((match = loopRegex.exec(noStringsText)) !== null) {
            const startIndex = match.index;
            const openBrace = noStringsText.indexOf('{', startIndex);
            if (openBrace !== -1) {
                let depth = 1;
                let endBrace = -1;
                for (let i = openBrace + 1; i < noStringsText.length; i++) {
                    const c = noStringsText.charCodeAt(i);
                    if (c === 123) depth++;
                    else if (c === 125) {
                        depth--;
                        if (depth === 0) {
                            endBrace = i + 1;
                            break;
                        }
                    }
                }
                if (endBrace !== -1) {
                    loops.push({ start: openBrace, end: endBrace, loopVar: match[1], startIndex: startIndex });
                }
            }
        }
    }

    const isInLoop = (index) => {
        for (let i = 0; i < loops.length; i++) {
            if (index >= loops[i].start && index < loops[i].end) return true;
        }
        return false;
    };

    // Check for nested loops (flag when loop nesting depth exceeds 3)
    for (let i = 0; i < loops.length; i++) {
        const l1 = loops[i];
        let loopDepth = 1;
        for (let j = 0; j < loops.length; j++) {
            if (i !== j && l1.start > loops[j].start && l1.end < loops[j].end) {
                loopDepth++;
            }
        }
        if (loopDepth > 3) {
            const startPos = doc.positionAt(l1.startIndex);
            const endPos = startPos.translate(0, 3); // length of 'for'
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                `Commerce Best Practice: Loop nesting depth of ${loopDepth} exceeds recommended limit of 3`,
                vscode.DiagnosticSeverity.Warning,
                'bml-nested-loop'
            ));
        }
    }

    // 1. BMQL inside loops detection (run on noStringsText to ignore bmql in comments/strings)
    if (loops.length > 0 && (noStringsText.includes('bmql') || noStringsText.includes('BMQL'))) {
        const bmqlRegex = /\bbmql\s*\(/gi;
        while ((match = bmqlRegex.exec(noStringsText)) !== null) {
            const index = match.index;
            if (isInLoop(index)) {
                const startPos = doc.positionAt(index);
                const endPos = startPos.translate(0, 4); // length of 'bmql'
                diagnostics.push(makeDiagnostic(
                    new vscode.Range(startPos, endPos),
                    'Performance Warning: BMQL query inside loop. Move query outside the loop for better performance',
                    vscode.DiagnosticSeverity.Warning,
                    'bml-bmql-in-loop'
                ));
            }
        }
    }

    // 2. String concatenation in loops detection
    if (loops.length > 0) {
        const concatRegex = /\b([a-zA-Z_]\w*)\s*=\s*(?:\1\s*\+|\b.*?\+\s*\1\b)/gi;
        const counters = new Set(['i', 'j', 'k', 'count', 'counter', 'index', 'idx']);
        loops.forEach(loop => {
            const loopBodyNoStrings = noStringsText.slice(loop.start, loop.end);
            const loopBodyWithStrings = cleanText.slice(loop.start, loop.end);
            let innerMatch;
            while ((innerMatch = concatRegex.exec(loopBodyNoStrings)) !== null) {
                const varName = innerMatch[1];
                if (counters.has(varName.toLowerCase())) {
                    continue; // Skip standard loop counters
                }
                
                // Check if the corresponding cleanText block has string literals/concatenations
                const matchIndex = innerMatch.index;
                const expressionTextClean = loopBodyWithStrings.slice(matchIndex, matchIndex + innerMatch[0].length);
                const hasStringIndicators = expressionTextClean.includes('"') || expressionTextClean.includes("'") || expressionTextClean.includes('~') || expressionTextClean.includes('|');
                
                if (hasStringIndicators || varName.toLowerCase().includes('str') || varName.toLowerCase().includes('ret')) {
                    const absoluteIndex = loop.start + matchIndex;
                    const startPos = doc.positionAt(absoluteIndex);
                    const endPos = doc.positionAt(absoluteIndex + innerMatch[0].length);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Performance Warning: String concatenation inside loop for '${varName}'. Use StringBuilder (sbappend/sbtostring) instead`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-string-concat-in-loop'
                    ));
                }
            }
        });
    }

    // 3. Repeated BMQL queries and Table Queries (run on cleanText since we need string literals)
    if (cleanText.includes('bmql') || cleanText.includes('BMQL')) {
        const bmqlQueryRegex = /\bbmql\s*\(\s*(["'])([\s\S]*?)\1\s*(?:,|\))/gi;
        const queryCounts = new Map(); // normalized query string -> positions []
        const tableCounts = new Map(); // table name -> positions []

        while ((match = bmqlQueryRegex.exec(cleanText)) !== null) {
            const queryText = match[2];
            const normalizedQuery = queryText.replace(/\s+/g, ' ').trim().toLowerCase();
            const startPos = doc.positionAt(match.index);
            const endPos = startPos.translate(0, match[0].length);
            const range = new vscode.Range(startPos, endPos);

            if (!queryCounts.has(normalizedQuery)) {
                queryCounts.set(normalizedQuery, []);
            }
            queryCounts.get(normalizedQuery).push(range);

            // Try to extract table name: SELECT ... FROM table_name ...
            const fromMatch = /\bfrom\s+([_a-zA-Z0-9]+)/i.exec(queryText);
            if (fromMatch) {
                const tableName = fromMatch[1].toLowerCase();
                if (!tableCounts.has(tableName)) {
                    tableCounts.set(tableName, []);
                }
                tableCounts.get(tableName).push(range);
            }
        }

        // Flag duplicate queries (after the first one)
        queryCounts.forEach((ranges, query) => {
            if (ranges.length > 1) {
                for (let i = 1; i < ranges.length; i++) {
                    diagnostics.push(makeDiagnostic(
                        ranges[i],
                        'Performance Info: Repeated identical BMQL query. Consider caching the results',
                        vscode.DiagnosticSeverity.Information,
                        'bml-repeated-bmql-query'
                    ));
                }
            }
        });

        // Flag excessive table queries (if table queried more than 2 times)
        tableCounts.forEach((ranges, tableName) => {
            if (ranges.length > 2) {
                ranges.forEach(range => {
                    diagnostics.push(makeDiagnostic(
                        range,
                        `Performance Info: Table '${tableName}' is queried ${ranges.length} times. Consider combining queries`,
                        vscode.DiagnosticSeverity.Information,
                        'bml-excessive-table-queries'
                    ));
                });
            }
        });
    }

    // 4. Deep Nesting Warning (run on noStringsText to ignore braces inside strings)
    if (noStringsText.includes('{')) {
        let currentDepth = 0;
        for (let i = 0; i < noStringsText.length; i++) {
            const code = noStringsText.charCodeAt(i);
            if (code === 123) { // '{'
                currentDepth++;
                if (currentDepth === 6) {
                    const startPos = doc.positionAt(i);
                    const endPos = startPos.translate(0, 1);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Design Warning: Nesting depth of ${currentDepth} exceeds recommended limit of 5`,
                        vscode.DiagnosticSeverity.Warning,
                        'bml-deep-nesting'
                    ));
                }
            } else if (code === 125) { // '}'
                currentDepth--;
            }
        }
    }

    // 5. Complexity Score Calculation (run on noStringsText to ignore keywords inside strings)
    const decisionRegex = /\b(if|elif|for|and|or)\b/gi;
    let decisionCount = 0;
    while (decisionRegex.exec(noStringsText) !== null) {
        decisionCount++;
    }

    if (decisionCount > 15) {
        const range = new vscode.Range(0, 0, 0, 1);
        diagnostics.push(makeDiagnostic(
            range,
            `Complexity Warning: Cyclomatic complexity is high (${decisionCount}). Consider refactoring into helper functions`,
            vscode.DiagnosticSeverity.Warning,
            'bml-high-complexity'
        ));
    }

    // 6. Production Print Statements (Oracle CPQ Best Practice: Remove print statements before go-live)
    if (noStringsText.includes('print')) {
        const printRegex = /\bprint\b(?:\s*\(|\s+[^\r\n;]+;)/gi;
        while ((match = printRegex.exec(noStringsText)) !== null) {
            const startPos = doc.positionAt(match.index);
            const endPos = startPos.translate(0, 5);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                "Best Practice / Performance Advisory: Remove or comment out 'print' statements before deploying to production to avoid logging overhead",
                vscode.DiagnosticSeverity.Information,
                'bml-production-print-statement'
            ));
        }
    }

    // 7. Hardcoded Environment / Site Domain Names (Oracle CPQ Best Practice: IdentifySiteName.md)
    if (cleanText.includes('.bigmachines.com') || cleanText.includes('.oraclecloud.com') || cleanText.includes('.cpq.oracle.com')) {
        const siteDomainRegex = /["'](?:https?:\/\/)?([a-zA-Z0-9_-]+(?:\.bigmachines\.com|\.oraclecloud\.com|\.cpq\.oracle\.com))[^"']*["']/gi;
        while ((match = siteDomainRegex.exec(cleanText)) !== null) {
            const startPos = doc.positionAt(match.index);
            const endPos = startPos.translate(0, match[0].length);
            diagnostics.push(makeDiagnostic(
                new vscode.Range(startPos, endPos),
                "Best Practice Advisory: Hardcoded site domain in string literal. Use '_system_site_name' or system variables for environment-aware scripts",
                vscode.DiagnosticSeverity.Information,
                'bml-hardcoded-sitename'
            ));
        }
    }

    // 8. Multi-argument sbappend() Check
    if (cleanText.includes('sbappend')) {
        const sbRegex = /\bsbappend\s*\(/gi;
        while ((match = sbRegex.exec(cleanText)) !== null) {
            const openParenIdx = match.index + match[0].length - 1;
            let depth = 1;
            let inSingle = false;
            let inDouble = false;
            let closeParenIdx = -1;

            for (let i = openParenIdx + 1; i < cleanText.length; i++) {
                const ch = cleanText[i];
                if (ch === '\\') {
                    i++;
                    continue;
                }
                if (ch === "'" && !inDouble) {
                    inSingle = !inSingle;
                } else if (ch === '"' && !inSingle) {
                    inDouble = !inDouble;
                } else if (!inSingle && !inDouble) {
                    if (ch === '(') depth++;
                    else if (ch === ')') {
                        depth--;
                        if (depth === 0) {
                            closeParenIdx = i;
                            break;
                        }
                    }
                }
            }

            if (closeParenIdx !== -1) {
                let fullEndIdx = closeParenIdx + 1;
                while (fullEndIdx < cleanText.length && (cleanText[fullEndIdx] === ' ' || cleanText[fullEndIdx] === '\t')) {
                    fullEndIdx++;
                }
                if (fullEndIdx < cleanText.length && cleanText[fullEndIdx] === ';') {
                    fullEndIdx++;
                }
                const argsText = cleanText.substring(openParenIdx + 1, closeParenIdx);
                const args = splitArgumentsList(argsText);
                if (args.length > 3) {
                    // Do not flag canonical CPQ line item format: sbappend(sb, docNum, "~var~", val, "|");
                    if (isCpqLineItemArgs(args)) {
                        continue;
                    }
                    const startPos = doc.positionAt(match.index);
                    const endPos = doc.positionAt(fullEndIdx);
                    diagnostics.push(makeDiagnostic(
                        new vscode.Range(startPos, endPos),
                        `Performance / Readability Advisory: 'sbappend' called with ${args.length - 1} items to append. Consider splitting into paired 'sbappend' statements`,
                        vscode.DiagnosticSeverity.Information,
                        'bml-sbappend-multiple-args'
                    ));
                }
            }
        }
    }

    // 9. Split CPQ Line Item sbappend Check
    // Detects when docNum~var~ and val| (or val without pipe) are split across separate sbappend calls
    const splitCpqRegex = /\bsbappend\s*\(\s*(\w+)\s*,\s*([^,;]+)\s*,\s*(["']~[^~;]+~["'])\s*\)\s*;\s*sbappend\s*\(\s*\1\s*,\s*([^,;]+?)(?:\s*,\s*(["']\|["']))?\s*\)\s*;/gi;
    let splitMatch;
    while ((splitMatch = splitCpqRegex.exec(cleanText)) !== null) {
        const startPos = doc.positionAt(splitMatch.index);
        const endPos = doc.positionAt(splitMatch.index + splitMatch[0].length);
        diagnostics.push(makeDiagnostic(
            new vscode.Range(startPos, endPos),
            `CPQ Line Item Advisory: Split 'sbappend' statements found for attribute ${splitMatch[3]}. Use canonical format 'sbappend(sb, docNum, "~var~", val, "|");'`,
            vscode.DiagnosticSeverity.Information,
            'bml-sbappend-cpq-split'
        ));
    }

    return diagnostics;
}

module.exports = {
    checkPerformance,
    isCpqLineItemArgs,
    isPipe,
    isTilde
};
