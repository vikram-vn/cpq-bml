// Constructor calls whose function name IS the type they build.
const TYPE_CONSTRUCTORS = {
    dict: 'Dictionary',
    json: 'Json',
    jsonarray: 'JsonArray',
    jsonnull: 'JsonNull',
    bytearray: 'ByteArray',
    stringbuilder: 'StringBuilder',
    recordset: 'RecordSet',
};

const FUNCTION_RETURN_TYPES = {
    getdate: 'Date',
    adddays: 'Date',
    addmonths: 'Date',
    minusdays: 'Date',
    strtodate: 'Date',
    strtojavadate: 'Date',
    date: 'Date',

    urldata: 'Dictionary',
    urlmultipartbypost: 'Dictionary',
    readxmlsingle: 'Dictionary',
    readxmlmultiple: 'Dictionary',
    getsystemmultipleattrvalues: 'Dictionary',
    getattachmentdata: 'Dictionary',

    jsoncopy: 'Json',
    jsonarraycopy: 'JsonArray',
    jsonpathgetmultiple: 'JsonArray',
    applybom: 'Json',
    calculatedeltabom: 'Json',
    convertbomtoflat: 'Json',
    getsystemdata: 'Json',
    addtotransaction: 'JsonArray',

    trim: 'String',
    upper: 'String',
    lower: 'String',
    substring: 'String',
    replace: 'String',
    join: 'String',
    html: 'String',
    encodebase64: 'String',
    decodebase64: 'String',
    datetostr: 'String',
    makeurlparam: 'String',
    getstrdate: 'String',
    getmessage: 'String',
    gettransaction: 'String',
    getoldvalue: 'String',
    globaldictget: 'String',
    urldatabyget: 'String',
    urldatabypost: 'String',
    urldatabypostasync: 'String',
    transformxml: 'String',
    applytemplate: 'String',
    sbtostring: 'String',
    jsontostr: 'String',
    jsonarraytostr: 'String',
    jsonarrayrefid: 'String',
    string: 'String',

    len: 'Integer',
    find: 'Integer',
    atoi: 'Integer',
    append: 'Integer',
    findinarray: 'Integer',
    remove: 'Integer',
    sizeofarray: 'Integer',
    comparedates: 'Integer',
    getcurrenttimeinmillis: 'Integer',
    getreasonstatus: 'Integer',
    savebom: 'Integer',
    saveconfigbom: 'Integer',
    jsonarrayremove: 'Integer',
    jsonarraysize: 'Integer',
    getint: 'Integer',
    integer: 'Integer',

    atof: 'Float',
    getfloat: 'Float',
    acos: 'Float',
    asin: 'Float',
    atan: 'Float',
    ceil: 'Float',
    cos: 'Float',
    cosh: 'Float',
    exp: 'Float',
    fabs: 'Float',
    fmod: 'Float',
    hypot: 'Float',
    ln: 'Float',
    log: 'Float',
    pow: 'Float',
    sin: 'Float',
    sinh: 'Float',
    sqrt: 'Float',
    tan: 'Float',
    tanh: 'Float',
    round: 'Float',
    getcurrencyvalue: 'Float',
    float: 'Float',

    endswith: 'Boolean',
    isnumber: 'Boolean',
    startswith: 'Boolean',
    isempty: 'Boolean',
    containskey: 'Boolean',
    jsonremove: 'Boolean',
    isjsonnull: 'Boolean',
    jsonpathcheck: 'Boolean',
    jsonpathremove: 'Boolean',
    getboolean: 'Boolean',
    haserror: 'Boolean',
    isnull: 'Boolean',
    isleap: 'Boolean',
    isweekend: 'Boolean',
    usersessionremove: 'Boolean',
    globaldictremove: 'Boolean',
    boolean: 'Boolean',
};

// bml-functions-api-usage.json is generated from the real CPQ REST API
// (app/lookups/bml/common.json) and already carries a "returnType" per
// function, including the type-constructor calls (dict/json/jsonarray/...) -
// a strict superset of, and more authoritative than, the hardcoded
// FUNCTION_RETURN_TYPES map above. Diffed all 81 hardcoded entries against
// it: only 3 gaps (date/float/boolean cast functions aren't in common.json's
// dump), kept here as a fallback for those.
const { loadBuiltInFunctionsJson } = require('../intellisense/apiDataLoader');

function getFunctionReturnTypes(extensionPath) {
    const map = Object.create(null);
    try {
        const data = loadBuiltInFunctionsJson(extensionPath);
        for (const [name, info] of Object.entries(data)) {
            if (info && info.returnType) {
                map[name.toLowerCase()] = info.returnType;
            }
        }
    } catch (e) {
        // fall through to just the hardcoded fallback below
    }
    for (const [name, type] of Object.entries(FUNCTION_RETURN_TYPES)) {
        if (!map[name]) map[name] = type;
    }
    return map;
}

// Given `text` ending in ")" right at `parenCloseIndex", balances parens
// backward to find the matching "(", then reads the identifier immediately
// before it as a function name. Returns its known return type from
// `returnTypes` (see getFunctionReturnTypes), or null if the name is
// unknown/not a real call.
function getFunctionCallReturnTypeEndingAt(text, parenCloseIndex, returnTypes) {
    if (text[parenCloseIndex] !== ')') return null;

    let depth = 1;
    let i = parenCloseIndex - 1;
    while (i >= 0 && depth > 0) {
        if (text[i] === ')') depth++;
        else if (text[i] === '(') depth--;
        i--;
    }
    if (depth !== 0) return null;

    const nameEnd = i + 1;
    let nameStart = nameEnd;
    while (nameStart > 0 && /[a-zA-Z0-9_]/.test(text[nameStart - 1])) {
        nameStart--;
    }
    const name = text.slice(nameStart, nameEnd);
    if (!name) return null;
    return returnTypes[name.toLowerCase()] || null;
}

// Given `text` starting at `nameStart` reading like "funcName(...)", checks
// for a "(" right after the identifier and balances parens forward. Returns
// the function's known return type, or null if it's not a recognized call
// (e.g. a bare variable reference with no following "(").
function getFunctionCallReturnTypeStartingAt(text, nameStart, nameEnd, returnTypes) {
    let i = nameEnd;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== '(') return null;

    let depth = 1;
    i++;
    while (i < text.length && depth > 0) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;
        i++;
    }
    if (depth !== 0) return null;

    const name = text.slice(nameStart, nameEnd);
    return returnTypes[name.toLowerCase()] || null;
}

function getElementTypeOfArray(type) {
    if (!type || typeof type !== 'string') return null;
    if (type.endsWith('[]')) {
        const inner = type.slice(0, -2);
        const lower = inner.toLowerCase();
        if (lower === 'string') return 'String';
        if (lower === 'integer') return 'Integer';
        if (lower === 'float') return 'Float';
        if (lower === 'boolean') return 'Boolean';
        if (lower === 'date') return 'Date';
        if (lower === 'string[]') return 'String[]';
        if (lower === 'integer[]') return 'Integer[]';
        if (lower === 'float[]') return 'Float[]';
        if (lower === 'date[]') return 'Date[]';
        if (lower === 'boolean[]') return 'Boolean[]';
        return inner.charAt(0).toUpperCase() + inner.slice(1);
    }
    return null;
}

// BML variables are statically typed by their first assignment; CPQ rejects reassigning
// to a different type later. declaredTypes optionally seeds a variable's type from its
// function-parameter declaration instead of waiting for the first in-body assignment.
function getLeftOperandType(text, index, varTypes, returnTypes) {
    let i = index - 1;
    while (i >= 0 && /\s/.test(text[i])) {
        i--;
    }
    if (i < 0) return null;

    let bracketCount = 0;
    while (i >= 0 && text[i] === ']') {
        let depth = 1;
        i--;
        while (i >= 0 && depth > 0) {
            if (text[i] === ']') depth++;
            else if (text[i] === '[') depth--;
            i--;
        }
        if (depth !== 0) return null;
        bracketCount++;
        while (i >= 0 && /\s/.test(text[i])) {
            i--;
        }
    }

    if (i < 0) return null;

    let baseType = null;

    if (text[i] === '"' || text[i] === "'") {
        const quote = text[i];
        let j = i - 1;
        while (j >= 0) {
            if (text[j] === quote && (j === 0 || text[j-1] !== '\\')) {
                baseType = 'String';
                break;
            }
            j--;
        }
        if (!baseType) baseType = 'String';
    } else if (text[i] === ')') {
        baseType = getFunctionCallReturnTypeEndingAt(text, i, returnTypes);
    } else {
        let start = i;
        while (start >= 0 && /[a-zA-Z0-9_.]/.test(text[start])) {
            start--;
        }
        const token = text.slice(start + 1, i + 1);
        if (/^\d+\.\d+$/.test(token)) baseType = 'Float';
        else if (/^\d+$/.test(token)) baseType = 'Integer';
        else if (/^(?:true|false)$/i.test(token)) baseType = 'Boolean';
        else if (token === 'null') baseType = 'Null';
        else if (/^[a-zA-Z_]\w*$/.test(token)) {
            const typeInfo = varTypes.get(token) || varTypes.get(token.toLowerCase());
            if (typeInfo) baseType = typeInfo.type;
        }
    }

    let currentType = baseType;
    for (let b = 0; b < bracketCount; b++) {
        if (!currentType) break;
        currentType = getElementTypeOfArray(currentType);
    }

    return currentType;
}

function getRightOperandType(text, index, varTypes, returnTypes) {
    let i = index + 1;
    while (i < text.length && /\s/.test(text[i])) {
        i++;
    }
    if (i >= text.length) return null;

    if (text[i] === '"' || text[i] === "'") {
        const quote = text[i];
        let j = i + 1;
        while (j < text.length) {
            if (text[j] === quote && text[j-1] !== '\\') {
                return 'String';
            }
            j++;
        }
        return 'String';
    }

    let end = i;
    while (end < text.length && /[a-zA-Z0-9_.]/.test(text[end])) {
        end++;
    }
    const token = text.slice(i, end);
    if (/^\d+\.\d+$/.test(token)) return 'Float';
    if (/^\d+$/.test(token)) return 'Integer';
    if (/^(?:true|false)$/i.test(token)) return 'Boolean';
    if (token === 'null') return 'Null';

    if (/^[a-zA-Z_]\w*$/.test(token)) {
        const callType = getFunctionCallReturnTypeStartingAt(text, i, end, returnTypes);
        let type = callType;
        if (!type) {
            const typeInfo = varTypes.get(token) || varTypes.get(token.toLowerCase());
            if (typeInfo) type = typeInfo.type;
        }

        if (type) {
            let nextIndex = end;
            if (callType) {
                let depth = 0;
                let k = end;
                while (k < text.length && /\s/.test(text[k])) k++;
                if (text[k] === '(') {
                    depth = 1;
                    k++;
                    while (k < text.length && depth > 0) {
                        if (text[k] === '(') depth++;
                        else if (text[k] === ')') depth--;
                        k++;
                    }
                    nextIndex = k;
                }
            }

            while (nextIndex < text.length && /\s/.test(text[nextIndex])) nextIndex++;

            while (type && nextIndex < text.length && text[nextIndex] === '[') {
                let depth = 1;
                let j = nextIndex + 1;
                while (j < text.length && depth > 0) {
                    if (text[j] === '[') depth++;
                    else if (text[j] === ']') depth--;
                    j++;
                }
                if (depth === 0) {
                    type = getElementTypeOfArray(type);
                    nextIndex = j;
                    while (nextIndex < text.length && /\s/.test(text[nextIndex])) nextIndex++;
                } else {
                    break;
                }
            }
        }
        return type;
    }
    return null;
}

module.exports = {
    TYPE_CONSTRUCTORS,
    FUNCTION_RETURN_TYPES,
    getFunctionReturnTypes,
    getLeftOperandType,
    getRightOperandType,
    getElementTypeOfArray,
};

