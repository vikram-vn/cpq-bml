const vscode = require('vscode');

/**
 * 100% BML-Accurate Quick Fixes for Strings & Arrays:
 * - join(delim, arr) -> join(arr, delim)
 * - string(strVar) -> strVar (redundant cast)
 * - atoi("") / atof("") -> 0 / 0.0
 * - append(arr, item); -> arr = append(arr, item);
 * - sort(arr, "ascending") -> sort(arr, "asc")
 * - sizeofarray(arr) == 0 -> isempty(arr)
 */

function getStringArrayFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag || !diag.code) return fixes;

    function addFix(title, replacement, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, editRange, replacement);
        if (diag) action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    const text = document.getText(editRange);

    // 1. Swapped join arguments: join(delim, arr) -> join(arr, delim)
    if (diag.code === 'bml-join-swapped-args') {
        const m = text.match(/join\s*\(\s*("[^"]*"|'[^']*'|[^,]+)\s*,\s*([^)]+)\s*\)/i);
        if (m) {
            const first = m[1].trim();
            const second = m[2].trim();
            addFix(`Swap arguments to 'join(${second}, ${first})'`, `join(${second}, ${first})`, true);
        }
        return fixes;
    }

    // 2. Redundant string() cast on existing String
    if (diag.code === 'bml-string-cast-of-string') {
        const m = text.match(/string\s*\(\s*([a-zA-Z_]\w*)\s*\)/i);
        if (m) {
            addFix(`Remove redundant 'string()' call`, m[1], true);
        }
        return fixes;
    }

    // 3. Empty literal in atoi("") or atof("")
    if (diag.code === 'bml-atoi-atof-empty-literal' || diag.code === 'bml-atoi-atof-empty-string') {
        if (/atoi/i.test(text)) {
            addFix(`Replace empty 'atoi("")' with 0`, '0', true);
        } else if (/atof/i.test(text)) {
            addFix(`Replace empty 'atof("")' with 0.0`, '0.0', true);
        }
        return fixes;
    }

    // 4. Unassigned append: append(arr, item) -> arr = append(arr, item);
    if (diag.code === 'bml-unassigned-append') {
        const m = text.match(/^\s*append\s*\(\s*([a-zA-Z_]\w*)\s*,\s*([^;]+)\)\s*;?/);
        if (m) {
            const arrVar = m[1];
            const item = m[2].trim();
            addFix(`Assign append result: '${arrVar} = append(${arrVar}, ${item});'`, `${arrVar} = append(${arrVar}, ${item});`, true);
        }
        return fixes;
    }

    // 5. Invalid sort order literal: "ascending" -> "asc", "descending" -> "desc"
    if (diag.code === 'bml-sort-invalid-order') {
        if (/ascending/i.test(text)) {
            addFix(`Change sort order to '"asc"'`, text.replace(/["']ascending["']/i, '"asc"'), true);
        } else if (/descending/i.test(text)) {
            addFix(`Change sort order to '"desc"'`, text.replace(/["']descending["']/i, '"desc"'), true);
        }
        return fixes;
    }

    // 6. sizeofarray(arr) == 0 -> isempty(arr)
    if (diag.code === 'bml-sizeofarray-zero-check') {
        const m = text.match(/sizeofarray\s*\(\s*([a-zA-Z_]\w*)\s*\)\s*(?:==|<=)\s*0/);
        if (m) {
            const arrVar = m[1];
            addFix(`Use 'isempty(${arrVar})'`, `isempty(${arrVar})`, true);
        }
        const mGt = text.match(/sizeofarray\s*\(\s*([a-zA-Z_]\w*)\s*\)\s*>\s*0/);
        if (mGt) {
            const arrVar = mGt[1];
            addFix(`Use 'not(isempty(${arrVar}))'`, `not(isempty(${arrVar}))`, true);
        }
        return fixes;
    }

    return fixes;
}

module.exports = { getStringArrayFixes };
