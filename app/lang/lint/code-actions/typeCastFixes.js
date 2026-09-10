const vscode = require('vscode');

/**
 * Type casting and assignment/return consistency Quick Fixes:
 * - bml-type-mismatch (reassignment to different type)
 * - bml-return-type-mismatch (return value does not match metadata returnType)
 * - bml-dict-put-type-mismatch (dict element type mismatch on put())
 * - bml-dict-values-unsupported-type (values() called on anytype or boolean dict)
 */

function getTypeCastFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag) return fixes;

    // 1. bml-dict-put-type-mismatch
    // e.g. "Type mismatch: Cannot insert 'Integer' value into 'myDict' declared as dict("string"). Expected 'string'."
    if (diag.code === 'bml-dict-put-type-mismatch') {
        const msg = diag.message;
        const match = msg.match(/Expected\s+['"]([^'"]+)['"]/i);
        const expectedType = match ? match[1].toLowerCase() : 'string';

        const line = document.lineAt(editRange.start.line);
        const lineText = line.text;
        const putMatch = lineText.match(/\bput\s*\(\s*([a-zA-Z_]\w*)\s*,\s*([^,]+)\s*,\s*([^);]+)\)/i);
        if (putMatch) {
            const rawVal = putMatch[3].trim();
            const valIdxInLine = lineText.lastIndexOf(rawVal);
            if (valIdxInLine !== -1) {
                const valRange = new vscode.Range(
                    editRange.start.line,
                    valIdxInLine,
                    editRange.start.line,
                    valIdxInLine + rawVal.length
                );

                if (expectedType === 'string') {
                    addFix(`Cast value to String using 'string(${rawVal})'`, `string(${rawVal})`, valRange, true);
                } else if (expectedType === 'integer') {
                    addFix(`Parse value using 'atoi(${rawVal})'`, `atoi(${rawVal})`, valRange, true);
                } else if (expectedType === 'float') {
                    addFix(`Parse value using 'atof(${rawVal})'`, `atof(${rawVal})`, valRange, true);
                } else if (expectedType === 'boolean') {
                    addFix(`Cast value using 'boolean(${rawVal})'`, `boolean(${rawVal})`, valRange, true);
                }
            }
        }
    }
    // 2. bml-return-type-mismatch
    // e.g. "Return type mismatch: Function metadata specifies 'String', but return statement returns 'Integer'."
    else if (diag.code === 'bml-return-type-mismatch') {
        const msg = diag.message;
        const match = msg.match(/metadata specifies\s+['"]([^'"]+)['"]/i);
        const expectedType = match ? match[1].toLowerCase() : 'string';

        const line = document.lineAt(editRange.start.line);
        const lineText = line.text;
        const retMatch = lineText.match(/\breturn\s+([^;]+);?/i);
        if (retMatch) {
            const expr = retMatch[1].trim();
            const exprIdx = lineText.indexOf(expr, lineText.indexOf('return') + 6);
            if (exprIdx !== -1) {
                const exprRange = new vscode.Range(
                    editRange.start.line,
                    exprIdx,
                    editRange.start.line,
                    exprIdx + expr.length
                );

                if (expectedType === 'string') {
                    addFix(`Convert return expression using 'string(${expr})'`, `string(${expr})`, exprRange, true);
                } else if (expectedType === 'integer') {
                    addFix(`Cast return expression using 'integer(${expr})'`, `integer(${expr})`, exprRange, true);
                } else if (expectedType === 'float') {
                    addFix(`Cast return expression using 'float(${expr})'`, `float(${expr})`, exprRange, true);
                } else if (expectedType === 'boolean') {
                    addFix(`Cast return expression using 'boolean(${expr})'`, `boolean(${expr})`, exprRange, true);
                } else if (expectedType === 'stringbuilder') {
                    addFix(`Wrap return in 'stringbuilder(${expr})'`, `stringbuilder(${expr})`, exprRange, true);
                }
            }
        }
    }
    // 3. bml-type-mismatch (variable reassignment)
    // e.g. "Type mismatch: 'count' was first assigned a Integer value (line 1) - CPQ will not accept reassigning it to a String value."
    else if (diag.code === 'bml-type-mismatch') {
        const msg = diag.message;
        const firstTypeMatch = msg.match(/first assigned a\s+([a-zA-Z_]+)\s+value|declared as a\s+([a-zA-Z_]+)\s+parameter/i);
        const expectedType = firstTypeMatch ? (firstTypeMatch[1] || firstTypeMatch[2]).toLowerCase() : 'string';

        const line = document.lineAt(editRange.start.line);
        const lineText = line.text;
        const assignMatch = lineText.match(/=\s*([^;]+);?/);
        if (assignMatch) {
            const rhs = assignMatch[1].trim();
            const rhsIdx = lineText.indexOf(rhs, lineText.indexOf('=') + 1);
            if (rhsIdx !== -1) {
                const rhsRange = new vscode.Range(
                    editRange.start.line,
                    rhsIdx,
                    editRange.start.line,
                    rhsIdx + rhs.length
                );

                if (expectedType === 'string') {
                    addFix(`Cast reassignment to String using 'string(${rhs})'`, `string(${rhs})`, rhsRange, true);
                } else if (expectedType === 'integer') {
                    addFix(`Cast reassignment to Integer using 'integer(${rhs})'`, `integer(${rhs})`, rhsRange, true);
                } else if (expectedType === 'float') {
                    addFix(`Cast reassignment to Float using 'float(${rhs})'`, `float(${rhs})`, rhsRange, true);
                } else if (expectedType === 'boolean') {
                    addFix(`Cast reassignment to Boolean using 'boolean(${rhs})'`, `boolean(${rhs})`, rhsRange, true);
                }
            }
        }
    }
    // 4. bml-dict-values-unsupported-type
    // e.g. "Function 'values()' does not support 'anytype' dictionaries."
    else if (diag.code === 'bml-dict-values-unsupported-type') {
        const line = document.lineAt(editRange.start.line);
        const lineText = line.text;
        const m = lineText.match(/\bvalues\s*\(\s*([a-zA-Z_]\w*)\s*\)/i);
        if (m) {
            const dictVar = m[1];
            const action = new vscode.CodeAction(`Iterate keys with 'keys(${dictVar})' instead of 'values()'`, vscode.CodeActionKind.QuickFix);
            action.edit = new vscode.WorkspaceEdit();
            const valuesCallIdx = lineText.indexOf(m[0]);
            const replaceRange = new vscode.Range(
                editRange.start.line,
                valuesCallIdx,
                editRange.start.line,
                valuesCallIdx + m[0].length
            );
            action.edit.replace(document.uri, replaceRange, `keys(${dictVar})`);
            action.diagnostics = [diag];
            action.isPreferred = true;
            fixes.push(action);
        }
    }

    function addFix(title, replacement, targetRange, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, targetRange, replacement);
        action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    return fixes;
}

module.exports = { getTypeCastFixes };
