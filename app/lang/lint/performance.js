const vscode = require('vscode');

function checkPerformance(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // Helper: Find all for-loop ranges in noStringsText
    const loops = [];
    const loopRegex = /\bfor\s+([a-zA-Z_]\w*)\s+in\s+/gi;
    let match;
    while ((match = loopRegex.exec(noStringsText)) !== null) {
        const startIndex = match.index;
        const openBrace = noStringsText.indexOf('{', startIndex);
        if (openBrace !== -1) {
            let depth = 1;
            let endBrace = -1;
            for (let i = openBrace + 1; i < noStringsText.length; i++) {
                if (noStringsText[i] === '{') depth++;
                else if (noStringsText[i] === '}') depth--;
                if (depth === 0) {
                    endBrace = i + 1;
                    break;
                }
            }
            if (endBrace !== -1) {
                loops.push({ start: openBrace, end: endBrace, loopVar: match[1], startIndex: startIndex });
            }
        }
    }

    // Check for nested loops
    loops.forEach(l1 => {
        const isNested = loops.some(l2 => l1.start > l2.start && l1.end < l2.end);
        if (isNested) {
            const startPos = doc.positionAt(l1.startIndex);
            const endPos = startPos.translate(0, 3); // length of 'for'
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    'Commerce Best Practice: Nested loop detected. Avoid nested loops to prevent negative performance impact',
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    });

    // 1. BMQL inside loops detection (run on noStringsText to ignore bmql in comments/strings)
    const bmqlRegex = /\bbmql\s*\(/gi;
    while ((match = bmqlRegex.exec(noStringsText)) !== null) {
        const index = match.index;
        const inLoop = loops.some(loop => index >= loop.start && index < loop.end);
        if (inLoop) {
            const startPos = doc.positionAt(index);
            const endPos = startPos.translate(0, 4); // length of 'bmql'
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    'Performance Warning: BMQL query inside loop. Move query outside the loop for better performance',
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    // 2. String concatenation in loops detection
    // Match self-concatenation in noStringsText
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
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Performance Warning: String concatenation inside loop for '${varName}'. Use StringBuilder (sbappend/sbtostring) instead`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }
    });

    // 3. Repeated BMQL queries and Table Queries (run on cleanText since we need string literals)
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
                diagnostics.push(
                    new vscode.Diagnostic(
                        ranges[i],
                        'Performance Info: Repeated identical BMQL query. Consider caching the results',
                        vscode.DiagnosticSeverity.Information
                    )
                );
            }
        }
    });

    // Flag excessive table queries (if table queried more than 2 times)
    tableCounts.forEach((ranges, tableName) => {
        if (ranges.length > 2) {
            ranges.forEach(range => {
                diagnostics.push(
                    new vscode.Diagnostic(
                        range,
                        `Performance Info: Table '${tableName}' is queried ${ranges.length} times. Consider combining queries`,
                        vscode.DiagnosticSeverity.Information
                    )
                );
            });
        }
    });

    // 4. Deep Nesting Warning (run on noStringsText to ignore braces inside strings)
    let currentDepth = 0;
    for (let i = 0; i < noStringsText.length; i++) {
        if (noStringsText[i] === '{') {
            currentDepth++;
            if (currentDepth > 3) {
                const startPos = doc.positionAt(i);
                const endPos = startPos.translate(0, 1);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Design Warning: Nesting depth of ${currentDepth} exceeds recommended limit of 3`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        } else if (noStringsText[i] === '}') {
            currentDepth--;
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
        diagnostics.push(
            new vscode.Diagnostic(
                range,
                `Complexity Warning: Cyclomatic complexity is high (${decisionCount}). Consider refactoring into helper functions`,
                vscode.DiagnosticSeverity.Warning
            )
        );
    }

    return diagnostics;
}

module.exports = { checkPerformance };
