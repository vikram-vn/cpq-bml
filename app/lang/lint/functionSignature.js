// Parses a fullSignature string (e.g. "String substring(String str, Integer
// start, [Integer end])") into { min, max, params }. Handles both
// individually-bracketed optionals and Oracle's cascading nested-optional
// tail ("datetostr(Date date [, String dateFormat [, String timeZone]])").
// Signatures with a "(or" polymorphic-union type, or an unbalanced paren
// (put's doc text), are deliberately left unparsed - { params: null } -
// rather than guessing a wrong shape.

function findOuterParamsText(signature) {
    const closeIdx = signature.lastIndexOf(')');
    if (closeIdx === -1) return null;

    let depth = 0;
    for (let i = closeIdx; i >= 0; i--) {
        const ch = signature[i];
        if (ch === ')') depth++;
        else if (ch === '(') {
            depth--;
            if (depth === 0) return signature.slice(i + 1, closeIdx);
        }
    }
    return null; // unbalanced - caller treats as unparseable
}

const TYPE_NAME_PATTERN = '([A-Za-z_]\\w*(?:\\s*\\[\\s*\\])*)\\s+([A-Za-z_]\\w*)';

// Returns null for a bare untyped parameter (e.g. "configurationKey") - these accept any type.
function extractTypeAndName(chunkText) {
    const match = chunkText.match(new RegExp(TYPE_NAME_PATTERN));
    if (!match) return null;
    return { type: match[1].replace(/\s+/g, ''), name: match[2] };
}

// Some variadic functions (e.g. sbappend) describe a repeating group using a cascading bracket
// missing the comma a well-formed optional tail has, so a single chunk ends up containing two
// "Type name" pairs - a reliable signal to skip validation rather than enforce a wrong shape.
function hasGluedParameterPairs(paramsText) {
    const globalMatcher = new RegExp(TYPE_NAME_PATTERN, 'g');
    return paramsText.split(',').some((chunk) => {
        const matches = chunk.match(globalMatcher);
        return matches && matches.length > 1;
    });
}

function parseParameterSignature(fullSignature) {
    if (!fullSignature || !fullSignature.includes('(') || fullSignature.includes('(or')) {
        return { min: 0, max: Infinity, params: null };
    }

    const paramsText = findOuterParamsText(fullSignature);
    if (paramsText === null) {
        return { min: 0, max: Infinity, params: null };
    }
    if (!paramsText.trim()) {
        return { min: 0, max: 0, params: [] };
    }
    if (hasGluedParameterPairs(paramsText)) {
        return { min: 0, max: Infinity, params: null };
    }

    const chunks = paramsText.split(',');
    const params = [];
    let depth = 0;

    for (const chunk of chunks) {
        const depthBeforeChunk = depth;
        for (const ch of chunk) {
            if (ch === '[') depth++;
            else if (ch === ']') depth = Math.max(0, depth - 1);
        }

        const trimmed = chunk.trim();
        const opensOwnOptionalGroup = /^\[(?!\])/.test(trimmed);
        const optional = depthBeforeChunk > 0 || opensOwnOptionalGroup;

        const typeAndName = extractTypeAndName(chunk);
        params.push({ type: typeAndName ? typeAndName.type : null, optional });
    }

    const min = params.filter((p) => !p.optional).length;
    const max = params.length;
    return { min, max, params };
}

// Same traversal rules as functions.js's countArguments, but returns the argument slices themselves.
function splitArgumentsList(argsText) {
    if (!argsText.trim()) return [];

    const parts = [];
    let start = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < argsText.length; i++) {
        const char = argsText[i];

        if (char === '\\') {
            if (i + 1 < argsText.length) i++;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
            else if (char === '[') bracketDepth++;
            else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
            else if (char === '{') braceDepth++;
            else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
            else if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
                parts.push(argsText.slice(start, i));
                start = i + 1;
            }
        }
    }
    parts.push(argsText.slice(start));
    return parts.map((p) => p.trim());
}

module.exports = { parseParameterSignature, splitArgumentsList, findOuterParamsText };
