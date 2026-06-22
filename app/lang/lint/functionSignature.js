// Parses a built-in function's fullSignature string (from
// bml_functions_api_usage.json, e.g. "String substring(String str, Integer
// start, [Integer end])") into a structured { min, max, params } shape that
// checkFunctionCalls can use for both argument-count and per-position
// argument-type validation.
//
// Oracle's own signature text uses two different optional-parameter
// conventions that both have to be handled:
//   1. Each optional parameter individually bracketed:
//      "find(String str, String substr, [Integer start], [Integer end])"
//   2. A cascading nested-optional tail, where the bracket opens mid-param
//      and every later parameter (down to the matching close) is optional:
//      "datetostr(Date date [, String dateFormat [, String timeZone]])"
// A handful of functions (max, min, put, get, append, ...) additionally use
// a non-standard "Type(or Type2, Type3)" polymorphic-union notation, and one
// (put) has a literally unbalanced paren in Oracle's own doc text. Signatures
// containing "(or" are deliberately NOT parsed - returning
// { min: 0, max: Infinity, params: null } so the caller skips both
// count and type enforcement for them - guessing at a union type's real
// shape risks false positives, and silently disabling validation is far
// safer than getting it wrong for a real BML built-in.

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

// Pulls "Type" and "name" out of a single parameter chunk, tolerating stray
// leading/trailing optional-group bracket punctuation left over from the
// chunk's depth-aware split (e.g. "Date date [", " String timeZone]]",
// "[boolean includeTime]"). Returns null for a bare untyped parameter
// (e.g. "configurationKey", "value") - these accept any type, so there is
// nothing to validate against.
function extractTypeAndName(chunkText) {
    const match = chunkText.match(new RegExp(TYPE_NAME_PATTERN));
    if (!match) return null;
    return { type: match[1].replace(/\s+/g, ''), name: match[2] };
}

// A handful of Oracle's variadic functions (sbappend is the only one found
// in practice) describe "repeat this group 0+ times" using the same
// cascading-bracket notation as a genuinely fixed-arity optional tail, but
// without the comma that every well-formed cascade has right after the
// param name (e.g. sbappend's "stringBuilder[String string[" vs datetostr's
// "date [, String dateFormat ["). That missing comma means a single
// depth-aware chunk ends up containing two complete "Type name" pairs
// glued together - a reliable signal that this isn't really a fixed
// positional parameter list, so it's treated the same as a "(or"
// polymorphic union: skip validation entirely rather than enforce a wrong
// max/type derived from a notation that doesn't fit this function's shape.
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

// Depth/quote-aware split of a call's argument-list text into one substring
// per argument - same traversal rules as functions.js's countArguments
// (parens/brackets/braces nesting, both quote styles, backslash-escapes) but
// returning the slices themselves instead of just a count, so each one can
// be passed to typeCheck.js's inferLiteralType for per-position checking.
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
