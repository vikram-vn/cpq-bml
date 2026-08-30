const { getWorkspaceIndex } = require('../workspaceIndex');

const BUILTIN_RETURNS = {
    'atof': 'Float', 'atoi': 'Integer', 'isnumber': 'Boolean', 'len': 'Integer',
    'find': 'Integer', 'findinarray': 'Integer', 'sizeofarray': 'Integer',
    'replace': 'String', 'split': 'String[]', 'substring': 'String', 'lower': 'String',
    'upper': 'String', 'trim': 'String', 'html': 'String', 'encodebase64': 'String',
    'decodebase64': 'String', 'join': 'String', 'formatascurrency': 'String',
    'sbtostring': 'String', 'getstr': 'String', 'getcurrencyvalue': 'Float',
    'getfloat': 'Float', 'getint': 'Integer', 'getboolean': 'Boolean',
    'addmonths': 'Date', 'adddays': 'Date', 'minusdays': 'Date', 'getdate': 'Date',
    'datetostr': 'String', 'strtojavadate': 'Date', 'strtodate': 'Date',
    'getdiffindays': 'Integer', 'comparedates': 'Integer', 'urldata': 'String',
    'urldatabyget': 'String', 'urldatabypost': 'String', 'urldatabypostasync': 'String',
    'fmod': 'Float', 'pow': 'Float', 'hypot': 'Float', 'round': 'Float',
    'abs': 'Float', 'ceil': 'Float', 'floor': 'Float', 'sqrt': 'Float',
    'sin': 'Float', 'cos': 'Float', 'tan': 'Float', 'exp': 'Float', 'ln': 'Float', 'log': 'Float',
    'getpartsdata': 'String[]', 'gettabledata': 'String[]', 'getattachmentdata': 'Dictionary',
    'getsystemattrvalues': 'String[]', 'getsystemmultipleattrvalues': 'Dictionary',
    'getsystemdata': 'Json', 'jsonkeys': 'String[]', 'keys': 'String[]', 'values': 'String[]',
    'jsoncopy': 'Json', 'jsonarraycopy': 'JsonArray', 'slice': 'String[]', 'range': 'Integer[]'
};

/**
 * Infers variable type from an assignment RHS expression.
 */
function inferVariableType(rhs, bmlApiData) {
    if (!rhs) return null;
    const trimmed = rhs.trim().replace(/;$/, '').trim();

    // BMQL
    if (/^bmql\s*\(/i.test(trimmed)) return 'RecordSet';

    // Constructors & Core types
    if (/^dict\s*\(/i.test(trimmed)) return 'Dictionary';
    if (/^json\s*\(/i.test(trimmed)) return 'Json';
    if (/^jsonarray\s*\(/i.test(trimmed)) return 'JsonArray';
    if (/^stringbuilder\s*\(/i.test(trimmed) || /^sbappend\s*\(/i.test(trimmed)) return 'StringBuilder';
    if (/^recordset\s*\(/i.test(trimmed)) return 'RecordSet';
    if (/^bytearray\s*\(/i.test(trimmed)) return 'ByteArray';

    // Arrays: string[], integer[], float[], date[], boolean[], anytype[]
    const arrMatch = trimmed.match(/^(string|integer|float|date|boolean|anytype)\[\](?:\s*\{|\s*;|$)/i);
    if (arrMatch) {
        const base = arrMatch[1].charAt(0).toUpperCase() + arrMatch[1].slice(1).toLowerCase();
        return `${base}[]`;
    }

    // Literals
    if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed) || /^'(?:[^'\\]|\\.)*'$/.test(trimmed)) return 'String';
    if (/^(?:true|false)$/i.test(trimmed)) return 'Boolean';
    if (/^-?\d+\.\d+$/.test(trimmed)) return 'Float';
    if (/^-?\d+$/.test(trimmed)) return 'Integer';

    // Function calls
    const fnCall = trimmed.match(/^([a-zA-Z_][\w.]*)\s*\(/);
    if (fnCall) {
        const fnName = fnCall[1].toLowerCase();

        if (BUILTIN_RETURNS[fnName]) return BUILTIN_RETURNS[fnName];

        if (bmlApiData && bmlApiData[fnName] && bmlApiData[fnName].returnType) {
            return bmlApiData[fnName].returnType;
        }

        try {
            const wsIndex = getWorkspaceIndex();
            const wsInfo = wsIndex ? wsIndex.get(fnName) : null;
            if (wsInfo && wsInfo.returnType) {
                return wsInfo.returnType;
            }
        } catch {
            // Workspace index may not be initialized in tests
        }
    }

    return null;
}

module.exports = {
    inferVariableType,
    BUILTIN_RETURNS
};
