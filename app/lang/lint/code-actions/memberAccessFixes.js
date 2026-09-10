const vscode = require('vscode');

/**
 * Member access to canonical BML function Quick Fixes.
 * BML has no methods or member dot-access. Developers coming from JS/Java
 * frequently write:
 * - arr.length / str.length -> sizeofarray(arr) / len(str)
 * - str.toLowerCase() / str.toUpperCase() -> lower(str) / upper(str)
 * - str.trim() -> trim(str)
 * - str.substring(start, end) -> substring(str, start, end)
 * - str.indexOf(sub) -> find(str, sub)
 * - arr.indexOf(elem) -> findinarray(arr, elem)
 * - dict.get(key) / json.get(key) -> get(dict, key) / jsonget(json, key)
 * - dict.put(key, val) / json.put(key, val) -> put(dict, key, val) / jsonput(json, key, val)
 * - dict.remove(key) / json.remove(key) -> remove(dict, key) / jsonremove(json, key)
 * - dict.containsKey(key) -> containskey(dict, key)
 * - dict.keys() / json.keys() -> keys(dict) / jsonkeys(json)
 * - dict.size() / arr.size() -> size(dict) / sizeofarray(arr)
 * - arr.push(elem) / arr.append(elem) -> arr = append(arr, elem)
 * - Math.min/max/round/abs/floor/ceil/pow/sqrt -> min/max/round/abs/floor/ceil/pow/sqrt
 * - console.log(...) / System.out.println(...) -> print(...)
 */

function getMemberAccessFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag || diag.code !== 'bml-invalid-member-access') return fixes;

    const fullLine = document.lineAt(editRange.start.line).text;
    const lineSub = fullLine.substring(editRange.start.character);

    // Look for target.member(args) or target.property
    const callMatch = lineSub.match(/^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\s*\(([^)]*)\))?/);
    if (!callMatch) {
        // Fallback: search in editRange text
        const text = document.getText(editRange);
        const m = text.match(/^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\s*\(([^)]*)\))?/);
        if (m) {
            return buildMemberFixes(document, editRange, m[1], m[2], m[3], m[0].endsWith(')'), diag);
        }
        return fixes;
    }

    const targetVar = callMatch[1];
    const memberName = callMatch[2];
    const argsText = callMatch[3] !== undefined ? callMatch[3].trim() : null;
    const hasParens = callMatch[0].endsWith(')') || lineSub.startsWith(`${targetVar}.${memberName}(`);

    const callRange = new vscode.Range(
        editRange.start.line,
        editRange.start.character,
        editRange.start.line,
        editRange.start.character + callMatch[0].length
    );

    return buildMemberFixes(document, callRange, targetVar, memberName, argsText, hasParens, diag);
}

function buildMemberFixes(document, range, targetVar, memberName, argsText, hasParens, diag) {
    const fixes = [];
    const memberLower = memberName.toLowerCase();

    function addFix(title, replacement, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, range, replacement);
        if (diag) action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    // 1. Math methods: Math.abs(x), Math.round(x), Math.min(a, b), etc.
    if (targetVar.toLowerCase() === 'math') {
        const mathMethods = ['abs', 'round', 'floor', 'ceil', 'sqrt', 'pow', 'min', 'max', 'log', 'sin', 'cos', 'tan'];
        if (mathMethods.includes(memberLower)) {
            addFix(`Use BML '${memberLower}(${argsText || ''})'`, `${memberLower}(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 2. Logging: console.log(...) or System.out.println(...)
    if (targetVar.toLowerCase() === 'console' && memberLower === 'log') {
        addFix(`Convert to 'print(${argsText || ''})'`, `print(${argsText || ''})`, true);
        return fixes;
    }
    if (targetVar.toLowerCase() === 'system' && (memberLower === 'out' || memberLower === 'println')) {
        addFix(`Convert to 'print(${argsText || ''})'`, `print(${argsText || ''})`, true);
        return fixes;
    }

    // 3. Length / Size properties and methods: .length, .size, .size()
    if (memberLower === 'length' || memberLower === 'size') {
        addFix(`Convert to 'sizeofarray(${targetVar})' (for arrays)`, `sizeofarray(${targetVar})`, true);
        addFix(`Convert to 'len(${targetVar})' (for strings)`, `len(${targetVar})`);
        addFix(`Convert to 'jsonarraysize(${targetVar})' (for JSON arrays)`, `jsonarraysize(${targetVar})`);
        addFix(`Convert to 'size(${targetVar})' (for dictionaries)`, `size(${targetVar})`);
        return fixes;
    }

    // 4. Case conversions: .toLowerCase(), .toUpperCase()
    if (memberLower === 'tolowercase' || memberLower === 'lower') {
        addFix(`Convert to 'lower(${targetVar})'`, `lower(${targetVar})`, true);
        return fixes;
    }
    if (memberLower === 'touppercase' || memberLower === 'upper') {
        addFix(`Convert to 'upper(${targetVar})'`, `upper(${targetVar})`, true);
        return fixes;
    }

    // 5. String trimming: .trim()
    if (memberLower === 'trim') {
        addFix(`Convert to 'trim(${targetVar})'`, `trim(${targetVar})`, true);
        return fixes;
    }

    // 6. Substring: .substring(start, end) or .substr(...)
    if (memberLower === 'substring' || memberLower === 'substr') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'substring(${argsStr})'`, `substring(${argsStr})`, true);
        return fixes;
    }

    // 7. Searching: .indexOf(arg), .includes(arg), .contains(arg)
    if (memberLower === 'indexof') {
        addFix(`Convert to 'find(${targetVar}, ${argsText || ''})' (for strings)`, `find(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'findinarray(${targetVar}, ${argsText || ''})' (for arrays)`, `findinarray(${targetVar}, ${argsText || ''})`);
        return fixes;
    }
    if (memberLower === 'contains' || memberLower === 'containskey') {
        addFix(`Convert to 'containskey(${targetVar}, ${argsText || ''})' (for dictionaries)`, `containskey(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'findinarray(${targetVar}, ${argsText || ''}) <> -1' (for arrays)`, `findinarray(${targetVar}, ${argsText || ''}) <> -1`);
        return fixes;
    }

    // 8. Starts/Ends with: .startsWith(arg), .endsWith(arg)
    if (memberLower === 'startswith') {
        addFix(`Convert to 'startswith(${targetVar}, ${argsText || ''})'`, `startswith(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }
    if (memberLower === 'endswith') {
        addFix(`Convert to 'endswith(${targetVar}, ${argsText || ''})'`, `endswith(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    // 9. Replace: .replace(old, new) or .replaceAll(old, new)
    if (memberLower === 'replace' || memberLower === 'replaceall') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'replace(${argsStr})'`, `replace(${argsStr})`, true);
        return fixes;
    }

    // 10. Split: .split(delim)
    if (memberLower === 'split') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'split(${argsStr})'`, `split(${argsStr})`, true);
        return fixes;
    }

    // 11. Dictionary / JSON Get: .get(key)
    if (memberLower === 'get') {
        addFix(`Convert to 'jsonget(${targetVar}, ${argsText || ''})' (for JSON objects)`, `jsonget(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'get(${targetVar}, ${argsText || ''})' (for dictionaries)`, `get(${targetVar}, ${argsText || ''})`);
        addFix(`Convert to 'jsonarrayget(${targetVar}, ${argsText || ''})' (for JSON arrays)`, `jsonarrayget(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 12. Dictionary / JSON Put: .put(key, val) or .set(key, val)
    if (memberLower === 'put' || memberLower === 'set') {
        addFix(`Convert to 'jsonput(${targetVar}, ${argsText || ''})' (for JSON objects)`, `jsonput(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'put(${targetVar}, ${argsText || ''})' (for dictionaries)`, `put(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 13. Dictionary / JSON Remove: .remove(key) or .delete(key)
    if (memberLower === 'remove' || memberLower === 'delete') {
        addFix(`Convert to 'jsonremove(${targetVar}, ${argsText || ''})' (for JSON objects)`, `jsonremove(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'remove(${targetVar}, ${argsText || ''})' (for dictionaries / arrays)`, `remove(${targetVar}, ${argsText || ''})`);
        addFix(`Convert to 'jsonarrayremove(${targetVar}, ${argsText || ''})' (for JSON arrays)`, `jsonarrayremove(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 14. Keys: .keys()
    if (memberLower === 'keys') {
        addFix(`Convert to 'jsonkeys(${targetVar})' (for JSON objects)`, `jsonkeys(${targetVar})`, true);
        addFix(`Convert to 'keys(${targetVar})' (for dictionaries)`, `keys(${targetVar})`);
        return fixes;
    }

    // 15. Values: .values()
    if (memberLower === 'values') {
        addFix(`Convert to 'values(${targetVar})'`, `values(${targetVar})`, true);
        return fixes;
    }

    // 16. Push / Append: .push(elem), .append(elem), .add(elem)
    if (memberLower === 'push' || memberLower === 'append' || memberLower === 'add') {
        addFix(`Convert to '${targetVar} = append(${targetVar}, ${argsText || ''})' (for arrays)`, `${targetVar} = append(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'jsonarrayappend(${targetVar}, ${argsText || ''})' (for JSON arrays)`, `jsonarrayappend(${targetVar}, ${argsText || ''})`);
        addFix(`Convert to 'sbappend(${targetVar}, ${argsText || ''})' (for StringBuilders)`, `sbappend(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 17. Join: .join(delim)
    if (memberLower === 'join') {
        addFix(`Convert to 'join(${targetVar}, ${argsText || ''})'`, `join(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    // 18. Reverse: .reverse()
    if (memberLower === 'reverse') {
        addFix(`Convert to '${targetVar} = reverse(${targetVar})'`, `${targetVar} = reverse(${targetVar})`, true);
        return fixes;
    }

    // 19. Slice: .slice(...)
    if (memberLower === 'slice') {
        addFix(`Convert to 'slice(${targetVar}, ${argsText || ''})'`, `slice(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    // 20. String conversion: .toString()
    if (memberLower === 'tostring') {
        addFix(`Convert to 'string(${targetVar})'`, `string(${targetVar})`, true);
        addFix(`Convert to 'sbtostring(${targetVar})' (for StringBuilders)`, `sbtostring(${targetVar})`);
        addFix(`Convert to 'jsontostr(${targetVar})' (for JSON objects)`, `jsontostr(${targetVar})`);
        addFix(`Convert to 'jsonarraytostr(${targetVar})' (for JSON arrays)`, `jsonarraytostr(${targetVar})`);
        return fixes;
    }

    // 21. Clear: .clear()
    if (memberLower === 'clear') {
        addFix(`Convert to 'clear(${targetVar})'`, `clear(${targetVar})`, true);
        return fixes;
    }

    return fixes;
}

module.exports = { getMemberAccessFixes };
