const {
    TYPE_CONSTRUCTORS,
    FUNCTION_RETURN_TYPES,
    getFunctionReturnTypes
} = require('./typeCheckOperands');

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

function inferExpressionType(rhsText, extensionPath, preloadedReturnTypes) {
    const literalType = inferLiteralType(rhsText);
    if (literalType) return literalType;

    const trimmed = rhsText.trim();
    if (trimmed.endsWith(')')) {
        const ctorMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*\(([^()]*)\)$/);
        if (ctorMatch) {
            const nameLower = ctorMatch[1].toLowerCase();
            if (nameLower === 'bmql') return null;
            const ctorType = TYPE_CONSTRUCTORS[nameLower];
            if (ctorType) return ctorType;
            const returnTypes = preloadedReturnTypes || getFunctionReturnTypes(extensionPath);
            const returnType = returnTypes[nameLower] || FUNCTION_RETURN_TYPES[nameLower];
            if (returnType) return returnType;
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
