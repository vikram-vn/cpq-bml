const vscode = require('vscode');
const { splitArgumentsList } = require('@/lang/lint/rules/functionSignature');

/**
 * Handles function argument type mismatches (bml-function-arg-type)
 * and argument count errors (bml-function-arg-count).
 * 
 * Automatically offers QuickFix conversions:
 * - Argument to String: string(x), datetostr(x), sbtostring(x), jsontostr(x)
 * - Argument to Integer: atoi(x), integer(x)
 * - Argument to Float: atof(x), float(x)
 * - Argument to Boolean: boolean(x)
 * - Argument to Json: json(x)
 * - Argument to JsonArray: jsonarray(x)
 * - Missing dict("anytype") get() 3rd parameter: get(d, k, "string")
 */

function getFunctionSignatureFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag) return fixes;

    if (diag.code === 'bml-function-arg-type') {
        const msg = diag.message;
        // Example: "Argument 2 to 'append' should be String, but got a Integer value."
        const match = msg.match(/Argument\s+(\d+)\s+to\s+['"]([^'"]+)['"]\s+should be\s+([^,]+),\s+but got a\s+([^ ]+)\s+value/i);
        if (!match) return fixes;

        const argIndex = parseInt(match[1], 10) - 1; // 0-based
        const funcName = match[2];
        const expectedTypeRaw = match[3].trim();
        const actualType = match[4].trim();

        // Parse line and extract the function call's argument list
        const lineText = document.lineAt(editRange.start.line).text;
        const callStartChar = editRange.start.character;
        const subText = lineText.substring(callStartChar);

        // Find the argument list inside parens following the function call
        const openParenIdx = lineText.indexOf('(', callStartChar);
        if (openParenIdx === -1) return fixes;

        // Find matching closing paren
        let depth = 0;
        let closeParenIdx = -1;
        for (let i = openParenIdx; i < lineText.length; i++) {
            if (lineText[i] === '(') depth++;
            else if (lineText[i] === ')') {
                depth--;
                if (depth === 0) {
                    closeParenIdx = i;
                    break;
                }
            }
        }
        if (closeParenIdx === -1) return fixes;

        const argsText = lineText.substring(openParenIdx + 1, closeParenIdx);
        const args = splitArgumentsList(argsText);
        if (argIndex < 0 || argIndex >= args.length) return fixes;

        const targetArg = args[argIndex].trim();
        if (!targetArg) return fixes;

        // Calculate exact range of targetArg in the document
        // Find position of targetArg within argsText
        let searchStart = 0;
        for (let i = 0; i < argIndex; i++) {
            const partIdx = argsText.indexOf(args[i], searchStart);
            if (partIdx !== -1) searchStart = partIdx + args[i].length;
        }
        const argOffsetInArgsText = argsText.indexOf(targetArg, searchStart);
        if (argOffsetInArgsText === -1) return fixes;

        const argStartChar = openParenIdx + 1 + argOffsetInArgsText;
        const argEndChar = argStartChar + targetArg.length;
        const argRange = new vscode.Range(
            editRange.start.line,
            argStartChar,
            editRange.start.line,
            argEndChar
        );

        const expLower = expectedTypeRaw.toLowerCase();
        const actLower = actualType.toLowerCase();

        // 1. Expected String
        if (expLower.includes('string') && !expLower.includes('[]')) {
            if (actLower.includes('stringbuilder')) {
                addFix(`Wrap in 'sbtostring(${targetArg})'`, `sbtostring(${targetArg})`, true);
            } else if (actLower.includes('date')) {
                addFix(`Convert with 'datetostr(${targetArg})'`, `datetostr(${targetArg})`, true);
            } else if (actLower.includes('jsonarray')) {
                addFix(`Convert with 'jsonarraytostr(${targetArg})'`, `jsonarraytostr(${targetArg})`, true);
            } else if (actLower.includes('json')) {
                addFix(`Convert with 'jsontostr(${targetArg})'`, `jsontostr(${targetArg})`, true);
            } else {
                addFix(`Convert to String using 'string(${targetArg})'`, `string(${targetArg})`, true);
            }
        }
        // 2. Expected Integer
        else if (expLower.includes('integer') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse integer using 'atoi(${targetArg})'`, `atoi(${targetArg})`, true);
            } else if (actLower.includes('float')) {
                addFix(`Cast to integer using 'integer(${targetArg})'`, `integer(${targetArg})`, true);
            } else {
                addFix(`Convert to Integer using 'integer(${targetArg})'`, `integer(${targetArg})`, true);
            }
        }
        // 3. Expected Float
        else if (expLower.includes('float') && !expLower.includes('[]')) {
            if (actLower.includes('string')) {
                addFix(`Parse float using 'atof(${targetArg})'`, `atof(${targetArg})`, true);
            } else {
                addFix(`Convert to Float using 'float(${targetArg})'`, `float(${targetArg})`, true);
            }
        }
        // 4. Expected Boolean
        else if (expLower.includes('boolean') && !expLower.includes('[]')) {
            addFix(`Convert to Boolean using 'boolean(${targetArg})'`, `boolean(${targetArg})`, true);
        }
        // 5. Expected Json
        else if (expLower.includes('json') && !expLower.includes('array') && !expLower.includes('[]')) {
            addFix(`Parse JSON object using 'json(${targetArg})'`, `json(${targetArg})`, true);
        }
        // 6. Expected JsonArray
        else if (expLower.includes('jsonarray') && !expLower.includes('[]')) {
            addFix(`Parse JSON array using 'jsonarray(${targetArg})'`, `jsonarray(${targetArg})`, true);
        }

        function addFix(title, replacement, isPreferred = false) {
            const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            action.edit.replace(document.uri, argRange, replacement);
            action.diagnostics = [diag];
            if (isPreferred) action.isPreferred = true;
            fixes.push(action);
        }
    }
    else if (diag.code === 'bml-function-arg-count') {
        const msg = diag.message;
        // Check for dict("anytype") get() 3rd argument requirement
        if (msg.includes("dict(\"anytype\")") && msg.includes("get()")) {
            const lineText = document.lineAt(editRange.start.line).text;
            const openParen = lineText.indexOf('(', editRange.start.character);
            const closeParen = lineText.lastIndexOf(')');
            if (openParen !== -1 && closeParen !== -1 && closeParen > openParen) {
                const argsContent = lineText.substring(openParen + 1, closeParen).trim();
                ['"string"', '"integer"', '"float"', '"boolean"', '"anytype"'].forEach((typeStr, idx) => {
                    const action = new vscode.CodeAction(`Add ${typeStr} valueType parameter to get()`, vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    const replaceRange = new vscode.Range(editRange.start.line, openParen + 1, editRange.start.line, closeParen);
                    action.edit.replace(document.uri, replaceRange, `${argsContent}, ${typeStr}`);
                    action.diagnostics = [diag];
                    if (idx === 0) action.isPreferred = true;
                    fixes.push(action);
                });
            }
        }
    }

    return fixes;
}

module.exports = { getFunctionSignatureFixes };
