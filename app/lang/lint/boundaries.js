const vscode = require('vscode');
const { getStringRanges } = require('./strings');

function checkBoundaries(cleanText, noStringsText, doc) {
    const diagnostics = [];

    // 1. Special / Corrupting Characters (run on cleanText to detect anywhere including comments)
    // Looking for \x1c (0x1c FS) and other control characters [\x00-\x08\x0b\x0c\x0e-\x1f]
    const invalidCharRegex = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
    let match;
    while ((match = invalidCharRegex.exec(cleanText)) !== null) {
        const char = match[0];
        const code = char.charCodeAt(0);
        const startPos = doc.positionAt(match.index);
        const endPos = startPos.translate(0, 1);
        
        let message = '';
        if (code === 0x1c) {
            message = "Script contains corrupting special character (0x1c) which can corrupt the Commerce Process when the script is deployed";
        } else {
            message = `Script contains invalid control character (0x${code.toString(16).padStart(2, '0')}) which can corrupt the Commerce Process when the script is deployed`;
        }

        diagnostics.push(
            new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                message,
                vscode.DiagnosticSeverity.Error
            )
        );
    }

    // 2. Script Length Limit (64kb try-block limit)
    // Warning if BML script length exceeds 64KB (65536 characters)
    if (cleanText.length > 65536) {
        const range = new vscode.Range(0, 0, 0, 1);
        diagnostics.push(
            new vscode.Diagnostic(
                range,
                `BML script size (${cleanText.length} characters) exceeds the 64KB limit on generated Java try block`,
                vscode.DiagnosticSeverity.Warning
            )
        );
    }

    // 3. BMQL Schema Limits (Table & Column Name Lengths)
    const bmqlQueryRegex = /\bbmql\s*\(\s*(["'])([\s\S]*?)\1\s*(?:,|\))/gi;
    while ((match = bmqlQueryRegex.exec(cleanText)) !== null) {
        const queryText = match[2];
        const queryOffset = match.index + match[0].indexOf(queryText);

        // A. Table Name Length Check (20 characters limit)
        // Match table name after FROM or JOIN
        const tableRegex = /\b(?:from|join)\s+([a-zA-Z_]\w*)/gi;
        let tableMatch;
        while ((tableMatch = tableRegex.exec(queryText)) !== null) {
            const tableName = tableMatch[1];
            if (tableName.length > 20) {
                const tableIndexInQuery = tableMatch.index + tableMatch[0].indexOf(tableName);
                const startPos = doc.positionAt(queryOffset + tableIndexInQuery);
                const endPos = startPos.translate(0, tableName.length);
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Data Table name '${tableName}' exceeds the 20-character limit`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        }

        // B. Column Name Length Check (20 characters limit)
        // Extract substring between SELECT and FROM
        const selectFromRegex = /\bselect\s+([\s\S]*?)\bfrom\b/i;
        const selectFromMatch = selectFromRegex.exec(queryText);
        if (selectFromMatch) {
            const colsPart = selectFromMatch[1];
            const colsPartOffset = queryText.indexOf(colsPart);
            const cols = colsPart.split(',');
            
            let currentOffset = colsPartOffset;
            for (let i = 0; i < cols.length; i++) {
                const rawCol = cols[i];
                const trimmedCol = rawCol.trim();
                
                if (trimmedCol && trimmedCol !== '*') {
                    // Extract actual column name (ignore aliases, functions like sum(), count(), t. prefix)
                    let colName = trimmedCol.split(/\s+as\s+/i)[0].trim();
                    colName = colName.replace(/^[a-zA-Z_]\w*\((.*?)\)$/, '$1').trim();
                    if (colName.includes('.')) {
                        colName = colName.split('.').pop().trim();
                    }

                    if (/^[a-zA-Z_]\w*$/.test(colName)) {
                        if (colName.length > 20) {
                            const colIndexInColSegment = rawCol.indexOf(colName);
                            const startPos = doc.positionAt(queryOffset + currentOffset + colIndexInColSegment);
                            const endPos = startPos.translate(0, colName.length);
                            diagnostics.push(
                                new vscode.Diagnostic(
                                    new vscode.Range(startPos, endPos),
                                    `Data Table Column name '${colName}' exceeds the 20-character limit`,
                                    vscode.DiagnosticSeverity.Warning
                                )
                            );
                        }
                    }
                }
                currentOffset += rawCol.length + 1; // +1 for the comma separator
            }
        }
    }

    // 4. Numeric Limits (run on noStringsText to ignore numbers in comments/strings)
    const numericRegex = /\b\d+(?:\.\d+)?\b/g;
    while ((match = numericRegex.exec(noStringsText)) !== null) {
        const val = match[0];
        const index = match.index;
        
        // Exclude properties/variables
        if (index > 0) {
            const precedingChar = noStringsText[index - 1];
            if (precedingChar === '.' || precedingChar === '_' || /[a-zA-Z]/.test(precedingChar)) {
                continue;
            }
        }

        const startPos = doc.positionAt(index);
        const endPos = startPos.translate(0, val.length);

        // Determine if there is a preceding minus sign (making it a negative literal)
        let precedingCharIdx = index - 1;
        while (precedingCharIdx >= 0 && /\s/.test(noStringsText[precedingCharIdx])) {
            precedingCharIdx--;
        }
        let precedingMinus = false;
        if (precedingCharIdx >= 0 && noStringsText[precedingCharIdx] === '-') {
            // Find character before the minus
            let beforeMinusIdx = precedingCharIdx - 1;
            while (beforeMinusIdx >= 0 && /\s/.test(noStringsText[beforeMinusIdx])) {
                beforeMinusIdx--;
            }
            if (beforeMinusIdx < 0 || !/[a-zA-Z0-9_)]/.test(noStringsText[beforeMinusIdx])) {
                precedingMinus = true;
            }
        }

        const digitsCount = val.replace(/[^0-9]/g, '').length;

        if (val.includes('.')) {
            // Float literal
            const valNum = parseFloat(val) * (precedingMinus ? -1 : 1);
            
            // Limit 16 digits
            if (digitsCount > 16) {
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Float/Currency literal has ${digitsCount} digits, which exceeds the 16-digit precision limit and will be rounded`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }

            // Decimal places check: 6 decimal places limit
            const parts = val.split('.');
            const decimals = parts[1].split(/[eE]/)[0];
            if (decimals.length > 6) {
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Float literal has ${decimals.length} decimal places, which exceeds the 6 decimal places limit for Data Table columns`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }

            // Currency value limit: 90 trillion
            if (Math.abs(valNum) > 90000000000000) {
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Currency limit check: Value exceeds the 90 trillion (90,000,000,000,000) limit for Currency attributes`,
                        vscode.DiagnosticSeverity.Warning
                    )
                );
            }
        } else {
            // Integer literal
            let valNum = parseInt(val, 10);
            if (precedingMinus) valNum = -valNum;

            // Integer range: -2,147,483,648 to 2,147,483,647
            if (valNum < -2147483648 || valNum > 2147483647) {
                diagnostics.push(
                    new vscode.Diagnostic(
                        new vscode.Range(startPos, endPos),
                        `Integer literal '${valNum}' is out of range (-2,147,483,648 to 2,147,483,647)`,
                        vscode.DiagnosticSeverity.Error
                    )
                );
            } else {
                // Limit for Integer Data Table column: 999,999,999
                if (Math.abs(valNum) > 999999999) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            new vscode.Range(startPos, endPos),
                            `Integer value exceeds the maximum value of 999,999,999 for a Data Table integer column`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }

                // Currency value limit: 90 trillion (could also be written as integer)
                if (Math.abs(valNum) > 90000000000000) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            new vscode.Range(startPos, endPos),
                            `Currency limit check: Value exceeds the 90 trillion (90,000,000,000,000) limit for Currency attributes`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }

                // Check 16-digit float precision warning if integer has >16 digits
                if (digitsCount > 16) {
                    diagnostics.push(
                        new vscode.Diagnostic(
                            new vscode.Range(startPos, endPos),
                            `Float/Currency literal has ${digitsCount} digits, which exceeds the 16-digit precision limit and will be rounded`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            }
        }
    }

    // 5. String Literal Limits
    const stringRanges = getStringRanges(cleanText);
    for (const [start, end] of stringRanges) {
        const strVal = cleanText.slice(start + 1, end - 1);
        const len = strVal.length;

        const startPos = doc.positionAt(start);
        const endPos = doc.positionAt(end);
        const range = new vscode.Range(startPos, endPos);

        if (len > 20000000) {
            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `String literal length (${len}) exceeds 20,000,000 characters limit for json() conversion`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        } else if (len > 4000) {
            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `String literal length (${len}) exceeds 4000 characters limit for Submit Comments or Attribute Descriptions`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        } else if (len > 256) {
            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `String literal length (${len}) exceeds 256 characters limit for Configuration text fields`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        } else if (len > 255) {
            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `String literal length (${len}) exceeds 255 characters limit for standard Commerce text fields (and truncates standard part numbers)`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    return diagnostics;
}

module.exports = { checkBoundaries };
