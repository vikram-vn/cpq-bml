const vscode = require('vscode');

/**
 * 100% BML-Accurate Quick Fixes for Dictionaries, JSON, Dates & Math:
 * - dict() -> dict("string") / dict("anytype")
 * - dict("int") -> dict("integer")
 * - get(anyDict, key) -> get(anyDict, key, "string")
 * - jsonget(j, key) -> jsonget(j, key, "string", "")
 * - isjsonnull(j, key)
 * - JSONPath $. prefix
 * - strtodate -> strtojavadate
 * - Date format tokens: YYYY -> yyyy, DD -> dd, mm -> MM
 * - comparedates(d1, d2) == -1 / 0 / 1
 * - adddays(d, n) / minusdays(d, n)
 * - NaN -> jNaN, jNaN() -> jNaN, x == jNaN -> isnan(x)
 * - round(x) -> round(x, 0)
 */

function getDictJsonDateFixes(document, diag, editRange) {
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

    // 1. Missing dictionary type in dict(): dict() -> dict("string") or dict("anytype")
    if (diag.code === 'bml-dict-missing-type') {
        addFix(`Initialize as 'dict("string")'`, `dict("string")`, true);
        addFix(`Initialize as 'dict("anytype")'`, `dict("anytype")`);
        return fixes;
    }

    // 2. Invalid dictionary type: dict("int") -> dict("integer"), dict("bool") -> dict("boolean")
    if (diag.code === 'bml-dict-invalid-type') {
        let fixed = text;
        fixed = fixed.replace(/dict\s*\(\s*["']int["']\s*\)/i, 'dict("integer")');
        fixed = fixed.replace(/dict\s*\(\s*["']bool["']\s*\)/i, 'dict("boolean")');
        fixed = fixed.replace(/dict\s*\(\s*["']text["']\s*\)/i, 'dict("string")');
        if (fixed !== text) {
            addFix(`Use valid dictionary type`, fixed, true);
        }
        return fixes;
    }

    // 3. get() on dict("anytype") missing 3rd valueType argument
    if (diag.code === 'bml-dict-anytype-get-type' || (diag.code === 'bml-function-arg-count' && /valueType/i.test(diag.message || ''))) {
        const m = text.match(/get\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
        if (m) {
            const dictArg = m[1].trim();
            const keyArg = m[2].trim();
            addFix(`Specify return type: 'get(${dictArg}, ${keyArg}, "string")'`, `get(${dictArg}, ${keyArg}, "string")`, true);
            addFix(`Specify return type: 'get(${dictArg}, ${keyArg}, "integer")'`, `get(${dictArg}, ${keyArg}, "integer")`);
            addFix(`Specify return type: 'get(${dictArg}, ${keyArg}, "float")'`, `get(${dictArg}, ${keyArg}, "float")`);
            addFix(`Specify return type: 'get(${dictArg}, ${keyArg}, "boolean")'`, `get(${dictArg}, ${keyArg}, "boolean")`);
            addFix(`Specify return type: 'get(${dictArg}, ${keyArg}, "json")'`, `get(${dictArg}, ${keyArg}, "json")`);
        }
        return fixes;
    }

    // 4. Safe jsonget with default fallback
    if (diag.code === 'bml-json-get-throws-without-default') {
        const m = text.match(/jsonget\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
        if (m) {
            const jArg = m[1].trim();
            const kArg = m[2].trim();
            addFix(`Use safe jsonget with string default: 'jsonget(${jArg}, ${kArg}, "string", "")'`, `jsonget(${jArg}, ${kArg}, "string", "")`, true);
            addFix(`Use safe jsonget with integer default: 'jsonget(${jArg}, ${kArg}, "integer", 0)'`, `jsonget(${jArg}, ${kArg}, "integer", 0)`);
        }
        return fixes;
    }

    // 5. JSONPath missing root $: jsonpath*(j, "path") -> jsonpath*(j, "$.path")
    if (diag.code === 'bml-jsonpath-missing-root') {
        const m = text.match(/(jsonpath\w+)\s*\(\s*([^,]+)\s*,\s*["']([^"'$][^"']*)["']/i);
        if (m) {
            const path = m[3].trim();
            const fixed = text.replace(`"${path}"`, `"$.${path}"`).replace(`'${path}'`, `'$.${path}'`);
            addFix(`Prepend root '$' to JSONPath: '$.${path}'`, fixed, true);
        }
        return fixes;
    }

    // 6. Deprecated strtodate -> strtojavadate
    if (diag.code === 'bml-strtodate-fix') {
        const fixed = text.replace(/\bstrtodate\b/g, 'strtojavadate');
        addFix(`Replace deprecated 'strtodate' with 'strtojavadate'`, fixed, true);
        return fixes;
    }

    // 7. Date format tokens: YYYY -> yyyy, DD -> dd, mm -> MM
    if (diag.code === 'bml-date-format-year') {
        const fixed = text.replace(/YYYY/g, 'yyyy');
        addFix(`Correct format year token to 'yyyy'`, fixed, true);
        return fixes;
    }
    if (diag.code === 'bml-date-format-day') {
        const fixed = text.replace(/DD/g, 'dd');
        addFix(`Correct format day token to 'dd'`, fixed, true);
        return fixes;
    }
    if (diag.code === 'bml-date-format-month') {
        const fixed = text.replace(/\bmm\b/g, 'MM');
        addFix(`Correct format month token to 'MM'`, fixed, true);
        return fixes;
    }

    // 8. Direct date comparison: d1 < d2 -> comparedates(d1, d2) == -1
    if (diag.code === 'bml-direct-date-comparison') {
        const m = text.match(/([a-zA-Z_]\w*)\s*(<|>|<=|>=|==|<>|!=)\s*([a-zA-Z_]\w*)/);
        if (m) {
            const d1 = m[1];
            const op = m[2];
            const d2 = m[3];
            let compExpr = `comparedates(${d1}, ${d2})`;
            if (op === '<') compExpr += ' == -1';
            else if (op === '>') compExpr += ' == 1';
            else if (op === '<=') compExpr += ' <= 0';
            else if (op === '>=') compExpr += ' >= 0';
            else if (op === '==' || op === '===') compExpr += ' == 0';
            else if (op === '<>' || op === '!=') compExpr += ' <> 0';
            addFix(`Use 'comparedates()' for date comparison`, compExpr, true);
        }
        return fixes;
    }

    // 9. Direct date arithmetic: d + 5 -> adddays(d, 5), d - 5 -> minusdays(d, 5)
    if (diag.code === 'bml-date-arithmetic') {
        const m = text.match(/([a-zA-Z_]\w*)\s*([+-])\s*(\d+|[a-zA-Z_]\w*)/);
        if (m) {
            const d = m[1];
            const op = m[2];
            const days = m[3];
            if (op === '+') {
                addFix(`Use 'adddays(${d}, ${days})'`, `adddays(${d}, ${days})`, true);
            } else {
                addFix(`Use 'minusdays(${d}, ${days})'`, `minusdays(${d}, ${days})`, true);
            }
        }
        return fixes;
    }

    // 10. Deprecated NaN -> jNaN
    if (diag.code === 'bml-nan-fix') {
        const fixed = text.replace(/\bNaN\b/g, 'jNaN');
        addFix(`Replace deprecated 'NaN' with 'jNaN'`, fixed, true);
        return fixes;
    }

    // 11. jNaN() function call -> jNaN
    if (diag.code === 'bml-jnan-function-call') {
        const fixed = text.replace(/\bjNaN\s*\(\s*\)/g, 'jNaN');
        addFix(`Remove parentheses from 'jNaN' constant`, fixed, true);
        return fixes;
    }

    // 12. jNaN equality check: x == jNaN -> isnan(x)
    if (diag.code === 'bml-jnan-equality') {
        const m = text.match(/([a-zA-Z_]\w*)\s*(?:==|===)\s*jNaN/i);
        if (m) {
            addFix(`Use 'isnan(${m[1]})'`, `isnan(${m[1]})`, true);
        }
        const mNe = text.match(/([a-zA-Z_]\w*)\s*(?:!=|<>)\s*jNaN/i);
        if (mNe) {
            addFix(`Use 'not(isnan(${mNe[1]}))'`, `not(isnan(${mNe[1]}))`, true);
        }
        return fixes;
    }

    // 13. Missing decimal in round(x) -> round(x, 0)
    if (diag.code === 'bml-round-missing-decimal' || (diag.code === 'bml-function-arg-count' && /round/i.test(diag.message || ''))) {
        const m = text.match(/round\s*\(\s*([^,)]+)\s*\)/i);
        if (m) {
            addFix(`Supply 0 decimal places: 'round(${m[1].trim()}, 0)'`, `round(${m[1].trim()}, 0)`, true);
            addFix(`Supply 2 decimal places: 'round(${m[1].trim()}, 2)'`, `round(${m[1].trim()}, 2)`);
        }
        return fixes;
    }

    return fixes;
}

module.exports = { getDictJsonDateFixes };
