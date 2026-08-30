const { getWorkspaceIndex } = require('../workspaceIndex');
const { loadCuratedParamsJson } = require('../apiDataLoader');

let staticCurated = {};
try {
    staticCurated = loadCuratedParamsJson();
} catch {
    try {
        staticCurated = require('../curated-params.json');
    } catch {}
}

function extractParamName(label) {
    if (!label) return '';
    const parts = label.trim().replace(/[\[\]]/g, '').split(/\s+/);
    return parts[parts.length - 1];
}

function extractParamNamesFromSignature(sig) {
    if (!sig) return [];
    const match = sig.match(/\(([^)]*)\)/);
    if (!match) return [];
    const inner = match[1].trim();
    if (!inner) return [];
    return inner.split(',').map(part => {
        const clean = part.replace(/[\[\]]/g, '').trim();
        const snip = clean.match(/\$\{\d+:([^}]+)\}/);
        if (snip) return snip[1];
        const tokens = clean.split(/\s+/);
        return tokens[tokens.length - 1];
    }).filter(Boolean);
}

function shouldSuppressHint(paramName, argText, suppressWhenMatch) {
    if (!suppressWhenMatch || !paramName || !argText) return false;
    const cleanParam = paramName.trim().toLowerCase().replace(/^[_\$]+|[_\$]+$/g, '');
    const cleanArg = argText.trim().replace(/^['"]|['"]$/g, '').toLowerCase().replace(/^[_\$]+|[_\$]+$/g, '');
    if (!cleanParam || !cleanArg) return false;
    return cleanParam === cleanArg;
}

/**
 * Dynamic parameter generators for variadic and overloaded signatures.
 */
const DYNAMIC_CURATED_PARAMS = {
    'find': (count) => count === 2 ? ['str', 'substring'] : ['str', 'substring', 'startIndex'],
    'sbappend': (count) => {
        const names = ['stringBuilder'];
        for (let i = 1; i < count; i++) {
            names.push(count === 2 ? 'value' : `value${i}`);
        }
        return names;
    },
    'stringbuilder': (count) => {
        const names = [];
        for (let i = 0; i < count; i++) {
            names.push(count === 1 ? 'value' : `value${i + 1}`);
        }
        return names;
    },
    'sort': (count) => {
        if (count === 1) return ['array'];
        if (count === 2) return ['array', 'sortOrder'];
        return ['array', 'sortOrder', 'sortType'];
    },
    'range': (count) => {
        if (count === 1) return ['end'];
        if (count === 2) return ['start', 'end'];
        return ['start', 'end', 'step'];
    },
    'min': (count) => {
        if (count <= 1) return ['array'];
        if (count === 2) return ['a', 'b'];
        const names = [];
        for (let i = 0; i < count; i++) names.push(`val${i + 1}`);
        return names;
    },
    'max': (count) => {
        if (count <= 1) return ['array'];
        if (count === 2) return ['a', 'b'];
        const names = [];
        for (let i = 0; i < count; i++) names.push(`val${i + 1}`);
        return names;
    },
    'getdate': (count) => count === 1 ? ['includeTime'] : ['record', 'fieldName'],
    'gettransaction': (count) => count === 1 ? ['bsId'] : (count === 2 ? ['bsId', 'filterCriteria'] : ['bsId', 'filterCriteria', 'includeRuleData']),
    'getpartsdata': (count) => count === 2 ? ['selectFields', 'partNumbers'] : ['selectFields', 'partNumbers', 'currencyCode'],
    'gettabledata': (count) => {
        const names = ['tableName', 'selectColumns'];
        let pair = 1;
        for (let i = 2; i < count; i += 2) {
            names.push(count > 4 ? `whereColumn${pair}` : 'whereColumn');
            if (i + 1 < count) {
                names.push(count > 4 ? `whereValue${pair}` : 'whereValue');
            }
            pair++;
        }
        return names;
    },
    'datetostr': (count) => count === 1 ? ['date'] : (count === 2 ? ['date', 'format'] : ['date', 'format', 'timeZone']),
    'strtodate': (count) => count === 2 ? ['dateStr', 'format'] : ['dateStr', 'format', 'timeZone'],
    'strtojavadate': (count) => count === 2 ? ['dateStr', 'format'] : ['dateStr', 'format', 'timeZone'],
    'formatdate': (count) => count === 2 ? ['date', 'format'] : ['date', 'format', 'timeZone'],
    'urldata': (count) => {
        const names = ['url', 'httpMethod', 'headers', 'parameters', 'timeout', 'formData', 'enableLoopback'];
        return names.slice(0, count);
    },
    'urldatabypostasync': (count) => {
        const names = ['url', 'parameters', 'defaultValue', 'callbackActionVarName', 'headers', 'returnErrorResponse', 'timeout', 'enableLoopback'];
        return names.slice(0, count);
    },
    'urlmultipartbypost': (count) => {
        const names = ['url', 'payload', 'headers', 'attachments', 'timeout', 'enableLoopback'];
        return names.slice(0, count);
    },
    'generatehmacmessage': (count) => count === 2 ? ['message', 'key'] : ['message', 'key', 'algorithm'],
    'bytearray': (count) => count === 1 ? ['content'] : ['content', 'charset'],
    'applybom': (count) => count === 2 ? ['baseBom', 'bomToApply'] : ['baseBom', 'bomToApply', 'setting'],
    'calculatedeltabom': (count) => count === 3 ? ['priorBom', 'currentBom', 'inputBom'] : ['priorBom', 'currentBom', 'inputBom', 'setting'],
    'savebom': (count) => count === 2 ? ['bsId', 'bomJson'] : ['bsId', 'bomJson', 'configurationKey'],
    'saveconfigbom': (count) => count === 2 ? ['configBomJson', 'instanceAttributes'] : ['configBomJson', 'instanceAttributes', 'configurationKey'],
    'getconfigurationbom': (count) => count === 1 ? ['configId'] : ['configId', 'flattenChildProducts'],
    'getconfigbom': (count) => count === 1 ? ['documentNumber'] : ['documentNumber', 'flattenChildProducts'],
    'addpartstotransaction': (count) => {
        const names = ['parts', 'priceBookVarName', 'resultAttributeArray', 'pricingTriggerPoint'];
        return names.slice(0, count);
    },
    'addtotransaction': (count) => {
        const names = ['items', 'priceBookVarName', 'resultAttributeArray', 'pricingTriggerPoint'];
        return names.slice(0, count);
    },
    'getuuid': (count) => count === 1 ? ['count'] : [],
    'throwerror': (count) => count === 1 ? ['message'] : ['message', 'category'],
    'usersessionget': (count) => count === 1 ? ['key'] : ['key', 'valueType'],
    'globaldictset': (count) => {
        const names = ['key', 'value', 'minTimeToLive', 'isolate'];
        return names.slice(0, count);
    },
    'format': (count) => {
        const names = ['pattern'];
        for (let i = 1; i < count; i++) {
            names.push(count === 2 ? 'value' : `value${i}`);
        }
        return names;
    },
    'date': (count) => count === 1 ? ['dateStr'] : ['dateStr', 'format'],
    'cpqjs.getattributeval': (count) => count === 1 ? ['attributeVarName'] : ['attributeVarName', 'index'],
    'cpqjs.openpopup': (count) => count === 1 ? ['content'] : ['content', 'title'],
    'cpqjs.setattributestate': (count) => count === 2 ? ['attributeVarName', 'state'] : ['attributeVarName', 'state', 'index'],
    'cpqjs.setattributeval': (count) => count === 2 ? ['attributeVarName', 'value'] : ['attributeVarName', 'value', 'index']
};

const BML_CURATED_PARAMS = Object.assign({}, staticCurated, DYNAMIC_CURATED_PARAMS);

/**
 * Resolves parameter names for built-in or workspace functions.
 */
const paramNamesCache = new Map();

function resolveParamNames(funcLower, argCount, bmlApiData) {
    if (BML_CURATED_PARAMS[funcLower]) {
        const entry = BML_CURATED_PARAMS[funcLower];
        if (typeof entry === 'function') {
            return entry(argCount);
        }
        return entry;
    }

    if (paramNamesCache.has(funcLower)) {
        return paramNamesCache.get(funcLower);
    }

    let paramNames = [];
    const cleanName = funcLower.replace(/^(?:util|commerce)\./, '');
    const info = bmlApiData ? (bmlApiData[funcLower] || bmlApiData[cleanName]) : null;

    if (info) {
        if (info.parameters && Array.isArray(info.parameters) && info.parameters.length > 0) {
            paramNames = info.parameters.map(p => p.name);
        } else if (info.fullSignature || info.syntax) {
            paramNames = extractParamNamesFromSignature(info.fullSignature || info.syntax);
        }
    }

    if (!paramNames.length) {
        try {
            const wsIndex = getWorkspaceIndex();
            if (wsIndex) {
                const wsInfo = wsIndex.get(funcLower) ||
                               wsIndex.get(`util.${cleanName}`) ||
                               wsIndex.get(`commerce.${cleanName}`);
                if (wsInfo && wsInfo.parameters) {
                    paramNames = wsInfo.parameters.map(p => p.name);
                }
            }
        } catch {
            // Workspace index may not be initialized in headless test runs
        }
    }

    if (paramNamesCache.size < 2000) {
        paramNamesCache.set(funcLower, paramNames);
    }
    return paramNames;
}

module.exports = {
    extractParamName,
    extractParamNamesFromSignature,
    shouldSuppressHint,
    resolveParamNames,
    BML_CURATED_PARAMS
};
