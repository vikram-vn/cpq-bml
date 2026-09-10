const vscode = require('vscode');
const { getDomainMemberFixes } = require('@/lang/lint/code-actions/domainMemberFixes');

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
 * - Math.min/max/round/fabs/ceil/pow/sqrt -> min/max/round/fabs/ceil/pow/sqrt (BML does not support abs, only fabs)
 * - console.log(...) / System.out.println(...) -> print(...)
 */

function getMemberAccessFixes(document, diag, editRange) {
    const fixes = [];
    if (!diag || diag.code !== 'bml-invalid-member-access') return fixes;

    const fullLine = document.lineAt(editRange.start.line).text;
    const lineSub = fullLine.substring(editRange.start.character);

    // 1. Check for multi-segment calls first: e.g. System.out.println(args)
    const multiMatch = lineSub.match(/^([a-zA-Z_]\w*\.[a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\s*\(([^)]*)\))?/);
    if (multiMatch) {
        const targetVar = multiMatch[1];
        const memberName = multiMatch[2];
        const argsText = multiMatch[3] !== undefined ? multiMatch[3].trim() : null;
        const hasParens = multiMatch[0].endsWith(')') || lineSub.startsWith(`${targetVar}.${memberName}(`);
        const callRange = new vscode.Range(
            editRange.start.line,
            editRange.start.character,
            editRange.start.line,
            editRange.start.character + multiMatch[0].length
        );
        const multiFixes = buildMemberFixes(document, callRange, targetVar, memberName, argsText, hasParens, diag);
        if (multiFixes.length > 0) return multiFixes;
    }

    // 2. Standard single-segment call: target.member(args) or target.property
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
    const targetLower = targetVar.toLowerCase();

    function addFix(title, replacement, isPreferred = false) {
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, range, replacement);
        if (diag) action.diagnostics = [diag];
        if (isPreferred) action.isPreferred = true;
        fixes.push(action);
    }

    // 1. Math methods: Math.abs(x), Math.round(x), Math.min(a, b), etc.
    // NOTE: Oracle CPQ BML does NOT support 'abs', ONLY 'fabs'.
    if (targetLower === 'math') {
        const mathMethods = ['abs', 'fabs', 'round', 'floor', 'ceil', 'sqrt', 'pow', 'min', 'max', 'log', 'ln', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'hypot', 'fmod', 'exp'];
        if (mathMethods.includes(memberLower)) {
            if (memberLower === 'abs' || memberLower === 'fabs') {
                addFix(`Use BML 'fabs(${argsText || ''})'`, `fabs(${argsText || ''})`, true);
                return fixes;
            }
            if (memberLower === 'log') {
                addFix(`Use BML natural log 'ln(${argsText || ''})'`, `ln(${argsText || ''})`, true);
                addFix(`Use BML base-10 log 'log(${argsText || ''})'`, `log(${argsText || ''})`);
                return fixes;
            }
            if (memberLower === 'floor') {
                addFix(`Convert floor using 'atoi(string(${argsText || ''}))'`, `atoi(string(${argsText || ''}))`, true);
                addFix(`Convert floor using 'round(${argsText || ''} - 0.5, 0)'`, `round(${argsText || ''} - 0.5, 0)`);
                return fixes;
            }
            addFix(`Use BML '${memberLower}(${argsText || ''})'`, `${memberLower}(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 2. Logging: console.log(...) or System.out.println(...)
    if (targetLower === 'console' && (memberLower === 'log' || memberLower === 'error' || memberLower === 'warn' || memberLower === 'info')) {
        addFix(`Convert to 'print(${argsText || ''})'`, `print(${argsText || ''})`, true);
        return fixes;
    }
    if ((targetLower === 'system.out' || targetLower === 'system.err' || targetLower === 'system') &&
        (memberLower === 'println' || memberLower === 'print' || memberLower === 'out')) {
        addFix(`Convert to 'print(${argsText || ''})'`, `print(${argsText || ''})`, true);
        return fixes;
    }

    // 3. Enterprise CPQ Domain methods: Session, Global, Context, BOM, Commerce, XML
    const domainFixes = getDomainMemberFixes(document, range, targetVar, memberName, argsText, diag);
    if (domainFixes.length > 0) return domainFixes;

    // 4. UUID Generation: UUID.randomUUID(), uuid.generate()
    if (targetLower === 'uuid' || memberLower === 'randomuuid' || memberLower === 'generateuuid') {
        addFix(`Convert to 'generateuuid()'`, `generateuuid()`, true);
        addFix(`Convert to 'getuuid()'`, `getuuid()`);
        return fixes;
    }

    // 5. Base64: Base64.encode(s), Base64.decode(s)
    if (targetLower === 'base64') {
        if (memberLower === 'encode' || memberLower === 'encodetostring') {
            addFix(`Convert to 'encodebase64(${argsText || ''})'`, `encodebase64(${argsText || ''})`, true);
            return fixes;
        }
        if (memberLower === 'decode') {
            addFix(`Convert to 'decodebase64(${argsText || ''})'`, `decodebase64(${argsText || ''})`, true);
            return fixes;
        }
    }

    // 6. URL parameter encoding: URLEncoder.encode(s), url.encode(s)
    if ((targetLower === 'urlencoder' || targetLower === 'url') && (memberLower === 'encode' || memberLower === 'encodeurl')) {
        addFix(`Convert to 'makeurlparam(${argsText || ''})'`, `makeurlparam(${argsText || ''})`, true);
        return fixes;
    }

    // 7. String formatting: String.format(...)
    if (targetLower === 'string' && memberLower === 'format') {
        addFix(`Convert to 'format(${argsText || ''})'`, `format(${argsText || ''})`, true);
        return fixes;
    }

    // 8. Static Parsing & JSON Helpers: Integer.parseInt, Float.parseFloat, JSON.parse, JSON.stringify
    if (targetLower === 'integer' && memberLower === 'parseint') {
        addFix(`Convert to 'atoi(${argsText || '""'})'`, `atoi(${argsText || '""'})`, true);
        return fixes;
    }
    if ((targetLower === 'float' || targetLower === 'double') &&
        (memberLower === 'parsefloat' || memberLower === 'parsedouble')) {
        addFix(`Convert to 'atof(${argsText || '""'})'`, `atof(${argsText || '""'})`, true);
        return fixes;
    }
    if (targetLower === 'json' && memberLower === 'parse') {
        addFix(`Convert to 'json(${argsText || '""'})'`, `json(${argsText || '""'})`, true);
        return fixes;
    }
    if (targetLower === 'json' && memberLower === 'stringify') {
        addFix(`Convert to 'jsontostr(${argsText || '""'})'`, `jsontostr(${argsText || '""'})`, true);
        return fixes;
    }

    // ==========================================
    // GENERIC MEMBER CALLS ON INSTANCE VARIABLES
    // ==========================================

    // 9. Length / Size properties and methods: .length, .size, .size()
    if (memberLower === 'length' || memberLower === 'size') {
        addFix(`Convert to 'sizeofarray(${targetVar})' (for arrays)`, `sizeofarray(${targetVar})`, true);
        addFix(`Convert to 'len(${targetVar})' (for strings)`, `len(${targetVar})`);
        addFix(`Convert to 'jsonarraysize(${targetVar})' (for JSON arrays)`, `jsonarraysize(${targetVar})`);
        addFix(`Convert to 'size(${targetVar})' (for dictionaries)`, `size(${targetVar})`);
        return fixes;
    }

    // 10. Case conversions: .toLowerCase(), .toUpperCase()
    if (memberLower === 'tolowercase' || memberLower === 'lower') {
        addFix(`Convert to 'lower(${targetVar})'`, `lower(${targetVar})`, true);
        return fixes;
    }
    if (memberLower === 'touppercase' || memberLower === 'upper') {
        addFix(`Convert to 'upper(${targetVar})'`, `upper(${targetVar})`, true);
        return fixes;
    }

    // 11. String trimming: .trim(), .strip()
    if (memberLower === 'trim' || memberLower === 'strip' || memberLower === 'trimleft' || memberLower === 'trimstart' || memberLower === 'trimright' || memberLower === 'trimend') {
        addFix(`Convert to 'trim(${targetVar})'`, `trim(${targetVar})`, true);
        return fixes;
    }

    // 12. Substring: .substring(start, end) or .substr(...)
    if (memberLower === 'substring' || memberLower === 'substr') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'substring(${argsStr})'`, `substring(${argsStr})`, true);
        return fixes;
    }

    // 13. Searching: .indexOf(arg), .includes(arg), .contains(arg)
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

    // 14. Starts/Ends with: .startsWith(arg), .endsWith(arg)
    if (memberLower === 'startswith') {
        addFix(`Convert to 'startswith(${targetVar}, ${argsText || ''})'`, `startswith(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }
    if (memberLower === 'endswith') {
        addFix(`Convert to 'endswith(${targetVar}, ${argsText || ''})'`, `endswith(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    // 15. Replace: .replace(old, new) or .replaceAll(old, new)
    if (memberLower === 'replace' || memberLower === 'replaceall') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'replace(${argsStr})'`, `replace(${argsStr})`, true);
        return fixes;
    }

    // 16. Split: .split(delim)
    if (memberLower === 'split') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'split(${argsStr})'`, `split(${argsStr})`, true);
        return fixes;
    }

    // 17. Dictionary / JSON Get: .get(key)
    if (memberLower === 'get') {
        addFix(`Convert to 'jsonget(${targetVar}, ${argsText || ''})' (for JSON objects)`, `jsonget(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'get(${targetVar}, ${argsText || ''})' (for dictionaries)`, `get(${targetVar}, ${argsText || ''})`);
        addFix(`Convert to 'jsonarrayget(${targetVar}, ${argsText || ''})' (for JSON arrays)`, `jsonarrayget(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 18. Dictionary / JSON Put: .put(key, val) or .set(key, val)
    if (memberLower === 'put' || memberLower === 'set') {
        addFix(`Convert to 'jsonput(${targetVar}, ${argsText || ''})' (for JSON objects)`, `jsonput(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'put(${targetVar}, ${argsText || ''})' (for dictionaries)`, `put(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 19. Dictionary / JSON Remove: .remove(key) or .delete(key)
    if (memberLower === 'remove' || memberLower === 'delete') {
        addFix(`Convert to 'jsonremove(${targetVar}, ${argsText || ''})' (for JSON objects)`, `jsonremove(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'remove(${targetVar}, ${argsText || ''})' (for dictionaries)`, `remove(${targetVar}, ${argsText || ''})`);
        addFix(`Convert to 'jsonarrayremove(${targetVar}, ${argsText || ''})' (for JSON arrays)`, `jsonarrayremove(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 20. Dictionary / JSON Keys: .keys(), .keySet()
    if (memberLower === 'keys' || memberLower === 'keyset') {
        addFix(`Convert to 'jsonkeys(${targetVar})' (for JSON objects)`, `jsonkeys(${targetVar})`, true);
        addFix(`Convert to 'keys(${targetVar})' (for dictionaries)`, `keys(${targetVar})`);
        return fixes;
    }

    // 21. Dictionary / JSON Values: .values()
    if (memberLower === 'values') {
        addFix(`Convert to 'values(${targetVar})' (for dictionaries)`, `values(${targetVar})`, true);
        addFix(`Convert to 'jsonvalues(${targetVar})' (for JSON objects)`, `jsonvalues(${targetVar})`);
        return fixes;
    }

    // 22. Array Append / Push: .push(elem), .append(elem), .add(elem)
    if (memberLower === 'push' || memberLower === 'append' || memberLower === 'add') {
        addFix(`Convert to '${targetVar} = append(${targetVar}, ${argsText || ''})' (for arrays)`, `${targetVar} = append(${targetVar}, ${argsText || ''})`, true);
        addFix(`Convert to 'jsonarrayappend(${targetVar}, ${argsText || ''})' (for JSON arrays)`, `jsonarrayappend(${targetVar}, ${argsText || ''})`);
        return fixes;
    }

    // 23. Array Insert: .insert(idx, elem)
    if (memberLower === 'insert') {
        addFix(`Convert to '${targetVar} = insert(${targetVar}, ${argsText || ''})'`, `${targetVar} = insert(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    // 24. Array Sort: .sort()
    if (memberLower === 'sort') {
        addFix(`Convert to '${targetVar} = sort(${targetVar}, "asc")'`, `${targetVar} = sort(${targetVar}, "asc")`, true);
        addFix(`Convert to '${targetVar} = sort(${targetVar}, "desc")'`, `${targetVar} = sort(${targetVar}, "desc")`);
        return fixes;
    }

    // 25. Array Reverse: .reverse()
    if (memberLower === 'reverse') {
        addFix(`Convert to '${targetVar} = reverse(${targetVar})'`, `${targetVar} = reverse(${targetVar})`, true);
        return fixes;
    }

    // 26. Array Slice: .slice(start, end)
    if (memberLower === 'slice') {
        const argsStr = argsText ? `${targetVar}, ${argsText}` : targetVar;
        addFix(`Convert to 'slice(${argsStr})'`, `slice(${argsStr})`, true);
        return fixes;
    }

    // 27. Array Join: .join(delim)
    if (memberLower === 'join') {
        addFix(`Convert to 'join(${targetVar}, ${argsText || '", "'})'`, `join(${targetVar}, ${argsText || '", "'})`, true);
        return fixes;
    }

    // 28. StringBuilder / String concatenation: .append(...)
    if (memberLower === 'sbappend') {
        addFix(`Convert to 'sbappend(${targetVar}, ${argsText || ''})'`, `sbappend(${targetVar}, ${argsText || ''})`, true);
        return fixes;
    }

    // 29. Clear dictionary: .clear()
    if (memberLower === 'clear') {
        addFix(`Convert to 'clear(${targetVar})'`, `clear(${targetVar})`, true);
        return fixes;
    }

    // 30. Date operations: .addDays(n), .minusDays(n), .addMonths(n), .getTime(), .isLeap(), .isWeekend(), .format(...)
    if (memberLower === 'adddays') {
        addFix(`Convert to 'adddays(${targetVar}, ${argsText || '1'})'`, `adddays(${targetVar}, ${argsText || '1'})`, true);
        return fixes;
    }
    if (memberLower === 'minusdays') {
        addFix(`Convert to 'minusdays(${targetVar}, ${argsText || '1'})'`, `minusdays(${targetVar}, ${argsText || '1'})`, true);
        return fixes;
    }
    if (memberLower === 'addmonths') {
        addFix(`Convert to 'addmonths(${targetVar}, ${argsText || '1'})'`, `addmonths(${targetVar}, ${argsText || '1'})`, true);
        return fixes;
    }
    if (memberLower === 'gettime' || memberLower === 'getmilliseconds') {
        addFix(`Convert to 'getcurrenttimeinmillis()'`, `getcurrenttimeinmillis()`, true);
        return fixes;
    }
    if (memberLower === 'isleap') {
        addFix(`Convert to 'isleap(${targetVar})'`, `isleap(${targetVar})`, true);
        return fixes;
    }
    if (memberLower === 'isweekend') {
        addFix(`Convert to 'isweekend(${targetVar})'`, `isweekend(${targetVar})`, true);
        return fixes;
    }
    if (memberLower === 'format') {
        addFix(`Convert to 'datetostr(${targetVar}, ${argsText || '"MM/dd/yyyy"'})'`, `datetostr(${targetVar}, ${argsText || '"MM/dd/yyyy"'})`, true);
        return fixes;
    }

    // 31. String helpers: .charAt()
    if (memberLower === 'charat') {
        const start = argsText || '0';
        addFix(`Convert to 'substring(${targetVar}, ${start}, ${start} + 1)'`, `substring(${targetVar}, ${start}, ${start} + 1)`, true);
        return fixes;
    }

    // 32. Array helpers: .isEmpty(), .pop(), .shift()
    if (memberLower === 'isempty') {
        addFix(`Convert to 'isempty(${targetVar})'`, `isempty(${targetVar})`, true);
        return fixes;
    }
    if (memberLower === 'pop') {
        addFix(`Convert to '${targetVar} = remove(${targetVar}, sizeofarray(${targetVar}) - 1)'`, `${targetVar} = remove(${targetVar}, sizeofarray(${targetVar}) - 1)`, true);
        return fixes;
    }
    if (memberLower === 'shift') {
        addFix(`Convert to '${targetVar} = remove(${targetVar}, 0)'`, `${targetVar} = remove(${targetVar}, 0)`, true);
        return fixes;
    }

    // 33. Clone / Copy: .clone(), .copy()
    if (memberLower === 'clone' || memberLower === 'copy') {
        addFix(`Convert to 'jsoncopy(${targetVar})' (for JSON objects)`, `jsoncopy(${targetVar})`, true);
        addFix(`Convert to 'jsonarraycopy(${targetVar})' (for JSON arrays)`, `jsonarraycopy(${targetVar})`);
        return fixes;
    }

    // 34. Currency formatting: num.formatAsCurrency()
    if (memberLower === 'formatascurrency' || memberLower === 'formatcurrency') {
        addFix(`Convert to 'formatascurrency(${targetVar})'`, `formatascurrency(${targetVar})`, true);
        return fixes;
    }

    // 35. String serialization: .toString()
    if (memberLower === 'tostring') {
        addFix(`Convert to 'string(${targetVar})'`, `string(${targetVar})`, true);
        addFix(`Convert to 'jsontostr(${targetVar})' (for JSON objects)`, `jsontostr(${targetVar})`);
        addFix(`Convert to 'jsonarraytostr(${targetVar})' (for JSON arrays)`, `jsonarraytostr(${targetVar})`);
        addFix(`Convert to 'sbtostring(${targetVar})' (for stringbuilder)`, `sbtostring(${targetVar})`);
        return fixes;
    }

    return fixes;
}

module.exports = { getMemberAccessFixes };
