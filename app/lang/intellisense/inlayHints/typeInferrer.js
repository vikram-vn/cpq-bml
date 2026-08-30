const { getWorkspaceIndex } = require('../workspaceIndex');
const { loadFunctionReturnTypesJson, loadBuiltInFunctionsJson } = require('../apiDataLoader');

let cachedReturnTypes = null;

function getReturnTypesMap() {
    if (!cachedReturnTypes || Object.keys(cachedReturnTypes).length === 0) {
        const dyn = loadFunctionReturnTypesJson();
        const fns = loadBuiltInFunctionsJson();
        cachedReturnTypes = Object.assign({}, dyn);
        if (fns) {
            for (const [k, v] of Object.entries(fns)) {
                const kLower = k.toLowerCase();
                if (!cachedReturnTypes[kLower] && v && v.returnType) {
                    cachedReturnTypes[kLower] = v.returnType;
                }
            }
        }
    }
    return cachedReturnTypes;
}

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

    // 2-D Arrays: string[][], integer[][], float[][], date[][], boolean[][], anytype[][]
    const arr2dMatch = trimmed.match(/^(string|integer|float|date|boolean|anytype)\[\]\[\](?:\s*;|$)/i);
    if (arr2dMatch) {
        const base = arr2dMatch[1].charAt(0).toUpperCase() + arr2dMatch[1].slice(1).toLowerCase();
        return `${base}[][]`;
    }

    // 1-D Arrays: string[], integer[], float[], date[], boolean[], anytype[]
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
        const returnTypes = getReturnTypesMap();

        if (returnTypes && returnTypes[fnName]) {
            return returnTypes[fnName];
        }

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
    getReturnTypesMap,
    BUILTIN_RETURNS: new Proxy({}, {
        get: (_, prop) => {
            const map = getReturnTypesMap();
            return typeof prop === 'string' ? map[prop.toLowerCase()] : undefined;
        }
    })
};
