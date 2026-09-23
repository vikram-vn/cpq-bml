const {
    TYPE_CONSTRUCTORS,
    FUNCTION_RETURN_TYPES,
    getFunctionReturnTypes
} = require('@/lang/lint/rules/typeCheckOperands');

// Bails out (returns null) on a newline at depth 0 with no semicolon yet, rather than
// guessing across what might be two separate statements.
function getAssignmentRhsText(text, startIndex) {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    const len = text.length;

    for (let i = startIndex; i < len; i++) {
        const ch = text.charCodeAt(i);

        if (ch === 92) { // '\\'
            i++;
            continue;
        }
        if (ch === 39 && !inDoubleQuote) { // "'"
            inSingleQuote = !inSingleQuote;
        } else if (ch === 34 && !inSingleQuote) { // '"'
            inDoubleQuote = !inDoubleQuote;
        }
        if (inSingleQuote || inDoubleQuote) continue;

        if (ch === 123 || ch === 40 || ch === 91) { // '{', '(', '['
            depth++;
        } else if (ch === 125 || ch === 41 || ch === 93) { // '}', ')', ']'
            depth = Math.max(0, depth - 1);
        } else if (ch === 59 && depth === 0) { // ';'
            return { text: text.slice(startIndex, i), endIndex: i };
        } else if (ch === 10 && depth === 0) { // '\n'
            return null;
        }
    }
    return null;
}

// Only returns a type when the RHS is unambiguously a single literal/constructed value;
// anything else (calls, concatenation, variable refs) returns null rather than guess.
function inferLiteralType(rhsText) {
    const trimmed = rhsText.trim();
    if (!trimmed) return null;
    const first = trimmed.charCodeAt(0);

    // Fast-path string literal check
    if (first === 34 || first === 39) { // '"' or "'"
        const last = trimmed.charCodeAt(trimmed.length - 1);
        if (last === first && trimmed.length >= 2) {
            if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(trimmed)) return 'String';
        }
        return null;
    }

    // Fast-path boolean literals
    if (/^(true|false)$/i.test(trimmed)) return 'Boolean';

    // Fast-path numbers: digits or '-'
    if ((first >= 48 && first <= 57) || first === 45) {
        if (/^-?\d+\.\d+$/.test(trimmed)) return 'Float';
        if (/^-?\d+$/.test(trimmed)) return 'Integer';
    }

    // Typed array literal or bare declaration: string[]{"a","b"}, integer[][]{...}, float[5], date[], dict[], json[], etc.
    if (trimmed.includes('[')) {
        const arrayMatch = trimmed.match(/^(string|integer|float|boolean|date|dict|dictionary|json|jsonarray|bytearray|record)((?:\[\s*\d*\s*\])+)\s*(?:\{[\s\S]*\})?$/i);
        if (arrayMatch) {
            const dims = arrayMatch[2].replace(/\d+/g, '').replace(/\s+/g, '');
            return `${arrayMatch[1].toLowerCase()}${dims}`;
        }
    }

    // Type-named constructor call: dict(...), json(...), jsonarray(...), etc.
    if (trimmed.endsWith(')')) {
        const ctorMatch = trimmed.match(/^([a-zA-Z]+)\s*\(([^()]*)\)$/);
        if (ctorMatch) {
            const ctorType = TYPE_CONSTRUCTORS[ctorMatch[1].toLowerCase()];
            if (ctorType) return ctorType;
        }
    }

    return null;
}

let _bmlAttributesCache = null;
function getBmlAttributes(extensionPath) {
    if (_bmlAttributesCache) return _bmlAttributesCache;
    _bmlAttributesCache = new Map();
    try {
        const { loadJson } = require('@/lang/intellisense/apiDataLoader');
        const attrs = loadJson('bml-attributes-api-usage', extensionPath);
        const vars = loadJson('bml-variables-api-usage', extensionPath);
        const utils = loadJson('bml-util-attributes-api-usage', extensionPath);

        function register(obj) {
            if (!obj) return;
            for (const [k, v] of Object.entries(obj)) {
                if (v && v.dataType) {
                    const dt = v.dataType.toLowerCase();
                    let canonical = 'String';
                    if (dt.includes('2-d') || dt.includes('2d')) canonical = 'String[][]';
                    else if (dt.includes('array set')) canonical = 'Array';
                    else if (dt.includes('float') || dt.includes('currency') || dt.includes('numeric')) canonical = 'Float';
                    else if (dt.includes('integer') || dt.includes('int')) canonical = 'Integer';
                    else if (dt.includes('bool')) canonical = 'Boolean';
                    else if (dt.includes('date')) canonical = 'Date';
                    else canonical = 'String';
                    _bmlAttributesCache.set(k.toLowerCase(), canonical);
                }
            }
        }
        register(attrs);
        register(vars);
        register(utils);
    } catch (_) {}
    return _bmlAttributesCache;
}

function splitArguments(argString) {
    const args = [];
    let current = '';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < argString.length; i++) {
        const ch = argString[i];
        if (ch === '\\') {
            current += ch;
            if (i + 1 < argString.length) {
                current += argString[++i];
            }
            continue;
        }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
            else if (ch === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
                continue;
            }
        }
        current += ch;
    }
    if (current.trim().length > 0) {
        args.push(current.trim());
    }
    return args;
}

function normalizeBmlValueType(typeStr) {
    if (!typeStr) return null;
    const clean = typeStr.trim().replace(/^["']|["']$/g, '').toLowerCase();
    switch (clean) {
        case 'string': return 'String';
        case 'integer':
        case 'int': return 'Integer';
        case 'float':
        case 'double':
        case 'number': return 'Float';
        case 'boolean':
        case 'bool': return 'Boolean';
        case 'date': return 'Date';
        case 'json': return 'Json';
        case 'jsonarray': return 'JsonArray';
        case 'dict':
        case 'dictionary': return 'Dictionary';
        case 'string[]': return 'String[]';
        case 'integer[]':
        case 'int[]': return 'Integer[]';
        case 'float[]':
        case 'double[]': return 'Float[]';
        case 'boolean[]':
        case 'bool[]': return 'Boolean[]';
        case 'date[]': return 'Date[]';
        case 'json[]': return 'Json[]';
        default:
            if (clean.endsWith('[]')) {
                const base = clean.slice(0, -2);
                const normBase = normalizeBmlValueType(base);
                return normBase ? `${normBase}[]` : null;
            }
            return null;
    }
}

function inferExpressionType(rhsText, extensionPath, preloadedReturnTypes, varTypes) {
    const literalType = inferLiteralType(rhsText);
    if (literalType) return literalType;

    const trimmed = rhsText.trim();
    if (!trimmed) return null;

    const returnTypes = preloadedReturnTypes || getFunctionReturnTypes(extensionPath);

    // 1. Direct or namespaced function/constructor call: func(...) or util.folder.func(...)
    if (trimmed.endsWith(')')) {
        const callMatch = trimmed.match(/^((?:[a-zA-Z_]\w*\.)*[a-zA-Z_]\w*)\s*\(([\s\S]*)\)$/);
        if (callMatch) {
            const fullName = callMatch[1];
            const fullNameLower = fullName.toLowerCase();
            const parts = fullNameLower.split('.');
            const baseNameLower = parts[parts.length - 1];

            if (baseNameLower === 'bmql') return null;
            const ctorType = TYPE_CONSTRUCTORS[baseNameLower];
            if (ctorType) return ctorType;

            // Propagate array element type from first argument if available
            const ARRAY_TRANSFORMERS = new Set(['sort', 'reverse', 'insert', 'remove', 'append', 'slice']);
            if (ARRAY_TRANSFORMERS.has(baseNameLower) && callMatch[2]) {
                const arg0 = callMatch[2].split(',')[0].trim();
                let arg0Type = null;
                if (varTypes && /^[a-zA-Z_]\w*$/.test(arg0)) {
                    const entry = varTypes.get ? (varTypes.get(arg0.toLowerCase()) || varTypes.get(arg0)) : varTypes[arg0.toLowerCase()];
                    arg0Type = entry ? (entry.type || entry) : null;
                } else if (arg0.includes('(')) {
                    arg0Type = inferExpressionType(arg0, extensionPath, returnTypes, varTypes);
                }
                if (arg0Type && arg0Type.endsWith('[]')) {
                    return arg0Type;
                }
            }

            // Dynamic typing: get(dict, key, [valueType])
            if (baseNameLower === 'get' && callMatch[2]) {
                const args = splitArguments(callMatch[2]);
                if (args.length >= 3) {
                    const vt = normalizeBmlValueType(args[2]);
                    if (vt) return vt;
                } else if (args.length >= 1 && varTypes) {
                    const dictVar = args[0].trim();
                    const entry = varTypes.get ? (varTypes.get(dictVar.toLowerCase()) || varTypes.get(dictVar)) : varTypes[dictVar.toLowerCase()];
                    if (entry && entry.elementType) {
                        const vt = normalizeBmlValueType(entry.elementType);
                        if (vt) return vt;
                        return entry.elementType;
                    }
                }
            }

            // Dynamic typing: jsonget(json, key, [valueType])
            if (baseNameLower === 'jsonget' && callMatch[2]) {
                const args = splitArguments(callMatch[2]);
                if (args.length >= 3) {
                    const vt = normalizeBmlValueType(args[2]);
                    if (vt) return vt;
                }
                return 'String';
            }

            // Dynamic typing: jsonarrayget(arr, idx, [valueType])
            if (baseNameLower === 'jsonarrayget' && callMatch[2]) {
                const args = splitArguments(callMatch[2]);
                if (args.length >= 3) {
                    const vt = normalizeBmlValueType(args[2]);
                    if (vt) return vt;
                }
                return 'String';
            }

            // Dynamic typing: jsonpathgetsingle(json, path, [valueType])
            if (baseNameLower === 'jsonpathgetsingle' && callMatch[2]) {
                const args = splitArguments(callMatch[2]);
                if (args.length >= 3) {
                    const vt = normalizeBmlValueType(args[2]);
                    if (vt) return vt;
                }
                return 'String';
            }

            // Dynamic typing: usersessionget(key, [valueType])
            if (baseNameLower === 'usersessionget' && callMatch[2]) {
                const args = splitArguments(callMatch[2]);
                if (args.length >= 2) {
                    const vt = normalizeBmlValueType(args[1]);
                    if (vt) return vt;
                }
                return 'String';
            }

            // Dynamic typing: max(arr) / min(arr) -> returns base element type of arr
            if ((baseNameLower === 'max' || baseNameLower === 'min') && callMatch[2]) {
                const args = splitArguments(callMatch[2]);
                const arg0 = args[0] ? args[0].trim() : '';
                let arg0Type = null;
                if (varTypes && /^[a-zA-Z_]\w*$/.test(arg0)) {
                    const entry = varTypes.get ? (varTypes.get(arg0.toLowerCase()) || varTypes.get(arg0)) : varTypes[arg0.toLowerCase()];
                    arg0Type = entry ? (entry.type || entry) : null;
                } else if (arg0.includes('(')) {
                    arg0Type = inferExpressionType(arg0, extensionPath, returnTypes, varTypes);
                }
                if (arg0Type && typeof arg0Type === 'string' && arg0Type.endsWith('[]')) {
                    const elem = arg0Type.slice(0, -2);
                    return normalizeBmlValueType(elem) || elem;
                }
            }

            const returnType = returnTypes[fullNameLower] || returnTypes[baseNameLower] ||
                FUNCTION_RETURN_TYPES[fullNameLower] || FUNCTION_RETURN_TYPES[baseNameLower];
            if (returnType) return returnType;

            // Check workspace function return types
            try {
                const { getWorkspaceFunctionsCached } = require('@/lang/lint/rules/workspaceFunctions');
                const wsMap = getWorkspaceFunctionsCached ? getWorkspaceFunctionsCached() : null;
                if (wsMap) {
                    const wsEntry = wsMap.get(fullNameLower) ||
                        wsMap.get(`util.${baseNameLower}`) ||
                        wsMap.get(`commerce.${baseNameLower}`);
                    if (wsEntry && wsEntry.returnType) return wsEntry.returnType;
                }
            } catch (_) {}
        }
    }

    // 2. Array index access: e.g. arr[0], lines[i], mat[0][1]
    if (varTypes && /^([a-zA-Z_]\w*)\s*((?:\[[^\]]+\])+)$/.test(trimmed)) {
        const idxMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*((?:\[[^\]]+\])+)$/);
        if (idxMatch) {
            const arrVar = idxMatch[1];
            const brackets = idxMatch[2].match(/\[[^\]]+\]/g) || [];
            const numIndices = brackets.length;
            const entry = varTypes.get ? (varTypes.get(arrVar.toLowerCase()) || varTypes.get(arrVar)) : varTypes[arrVar.toLowerCase()];
            const arrType = entry ? (entry.type || entry) : null;
            if (arrType && typeof arrType === 'string') {
                let current = arrType;
                for (let k = 0; k < numIndices; k++) {
                    if (current.endsWith('[]')) {
                        current = current.slice(0, -2);
                    } else {
                        break;
                    }
                }
                if (current !== arrType) {
                    return normalizeBmlValueType(current) || current;
                }
            }
        }
    }

    // 3. Binary expressions: e.g. atoi(...) - 1, count + 1, price * 1.5
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let lastOpIndex = -1;
    let lastOp = null;

    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '\\') { i++; continue; }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (!inSingle && !inDouble) {
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
            else if (depth === 0 && (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%')) {
                lastOpIndex = i;
                lastOp = ch;
            }
        }
    }

    if (lastOpIndex > 0 && lastOpIndex < trimmed.length - 1) {
        const leftExpr = trimmed.slice(0, lastOpIndex).trim();
        const rightExpr = trimmed.slice(lastOpIndex + 1).trim();
        const leftType = inferExpressionType(leftExpr, extensionPath, returnTypes, varTypes);
        const rightType = inferExpressionType(rightExpr, extensionPath, returnTypes, varTypes);

        if (lastOp === '-' || lastOp === '*' || lastOp === '/' || lastOp === '%') {
            if (leftType === 'Float' || rightType === 'Float') return 'Float';
            if (leftType === 'Integer' && rightType === 'Integer') return 'Integer';
            if (leftType === 'Integer' || rightType === 'Integer') return 'Integer';
            if (leftType || rightType) return 'Float';
        } else if (lastOp === '+') {
            if (leftType === 'String' || rightType === 'String') return 'String';
            if (leftType === 'Float' || rightType === 'Float') return 'Float';
            if (leftType === 'Integer' && rightType === 'Integer') return 'Integer';
        }
    }

    // 4. Variable lookup if varTypes is available
    if (varTypes && /^[a-zA-Z_]\w*$/.test(trimmed)) {
        const v = varTypes.get ? (varTypes.get(trimmed.toLowerCase()) || varTypes.get(trimmed)) : varTypes[trimmed.toLowerCase()];
        if (v && (v.type || typeof v === 'string')) return v.type || v;
    }

    // 5. Attribute or System Variable lookup (e.g. _site_url, line._document_number, _transaction_document_number)
    const attrMatch = trimmed.match(/^(?:[a-zA-Z_]\w*\.)?(_[a-zA-Z0-9_]+)$/);
    if (attrMatch) {
        const attrKey = attrMatch[1].toLowerCase();
        const attrMap = getBmlAttributes(extensionPath);
        if (attrMap && attrMap.has(attrKey)) {
            return attrMap.get(attrKey);
        }
    }

    return null;
}

function isTypeReassignmentMismatch(priorType, literalType) {
    if (!priorType || !literalType) return false;
    if (priorType === literalType) return false;
    const priorLower = priorType.toLowerCase();
    const literalLower = literalType.toLowerCase();
    if (priorLower === literalLower) return false;
    // Numeric widening / compatibility: Float, Number, Double, Currency, Percent accept Integer and Float literals
    if (['float', 'number', 'numeric', 'double', 'currency', 'percent'].includes(priorLower) &&
        (literalLower === 'integer' || literalLower === 'float')) {
        return false;
    }
    return true;
}

module.exports = {
    getAssignmentRhsText,
    inferLiteralType,
    inferExpressionType,
    isTypeReassignmentMismatch
};
