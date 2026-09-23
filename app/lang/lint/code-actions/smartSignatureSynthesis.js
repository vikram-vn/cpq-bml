const vscode = require('vscode');
const { splitArgumentsList } = require('@/lang/lint/rules/functionSignature');
const { loadJson } = require('@/lang/intellisense/apiDataLoader');
const { DELIMITERS } = require('@/lang/intellisense/paramCompletions/delimiters');
const { HTTP_METHODS, CONTENT_TYPES } = require('@/lang/intellisense/paramCompletions/httpAndWeb');
const { SORT_ORDERS, SORT_TYPES } = require('@/lang/intellisense/paramCompletions/arrayParams');
const { DICT_TYPES } = require('@/lang/intellisense/paramCompletions/dictParams');
const { TIMEZONES } = require('@/lang/intellisense/paramCompletions/timezones');
const { DATE_FORMATS } = require('@/lang/intellisense/paramCompletions/dateParams');
const { CURRENCY_CODES } = require('@/lang/intellisense/paramCompletions/currencies');

let _bmlFunctionsCache = null;
function getBmlFunctions() {
    if (_bmlFunctionsCache) return _bmlFunctionsCache;
    try {
        const data = loadJson('bml-functions-api-usage');
        if (data) {
            _bmlFunctionsCache = Object.create(null);
            for (const [k, v] of Object.entries(data)) {
                _bmlFunctionsCache[k.toLowerCase()] = Object.assign({ name: k }, v);
            }
        }
    } catch (_) {}
    return _bmlFunctionsCache || {};
}

let _customSnippetsCache = null;
function getCustomSnippets() {
    if (_customSnippetsCache) return _customSnippetsCache;
    try {
        _customSnippetsCache = loadJson('custom-snippets') || {};
    } catch (_) {
        _customSnippetsCache = {};
    }
    return _customSnippetsCache;
}

function getWorkspaceFunctionInfo(fullNameLower) {
    try {
        const { getWorkspaceFunctionsCached } = require('@/lang/lint/rules/workspaceFunctions');
        const wsMap = getWorkspaceFunctionsCached ? getWorkspaceFunctionsCached() : null;
        if (wsMap) {
            return wsMap.get(fullNameLower) ||
                wsMap.get(`util.${fullNameLower}`) ||
                wsMap.get(`commerce.${fullNameLower}`);
        }
    } catch (_) {}
    return null;
}

function inferLhsExpectedType(document, lineIdx, callStartChar) {
    const lineText = document.lineAt(lineIdx).text;
    const beforeCall = lineText.substring(0, callStartChar);
    const assignMatch = beforeCall.match(/\b([a-zA-Z_]\w*)\s*=(?!=)\s*$/);
    if (!assignMatch) return null;

    const rawName = assignMatch[1];
    const tokens = rawName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_]+/);
    const hasToken = (regex) => tokens.some(t => regex.test(t));

    if (hasToken(/^(is|has|can|flag|enabled|active|valid|checked)$/)) return 'boolean';
    if (hasToken(/^(price|cost|total|amount|rate|tax|margin|discount|fee|subtotal|balance|unit)$/)) return 'float';
    if (hasToken(/^(count|qty|quantity|idx|index|num|id|size|length|line)$/)) return 'integer';
    if (hasToken(/^(json|obj|payload|body|node)$/)) return 'json';
    if (hasToken(/^(array|list|items|lines)$/)) return 'jsonarray';
    if (hasToken(/^(date|time|timestamp|day|month|year)$/)) return 'date';
    return 'string';
}

function findPredominantDateFormat(document) {
    const text = document.getText();
    const formats = ['"yyyy-MM-dd HH:mm:ss"', '"yyyy-MM-dd"', '"MM/dd/yyyy"', '"dd/MM/yyyy"'];
    for (const fmt of formats) {
        if (text.includes(fmt)) return fmt;
    }
    return '"yyyy-MM-dd"';
}

function findInScopeVariables(document, paramName, paramType) {
    const candidates = [];
    const text = document.getText();
    const cleanParam = paramName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const varRegex = /\b([a-zA-Z_]\w*)\s*=\s*([^;]+);/g;
    let m;
    const seen = new Set();
    while ((m = varRegex.exec(text)) !== null) {
        const vName = m[1];
        const vLower = vName.toLowerCase();
        if (seen.has(vLower)) continue;

        if (vLower === cleanParam || vLower.includes(cleanParam) || cleanParam.includes(vLower)) {
            candidates.push(vName);
            seen.add(vLower);
            if (candidates.length >= 3) break;
        }
    }
    return candidates;
}

function getParamDocSection(paramDef, funcDocs) {
    let text = (paramDef && paramDef.description) || '';
    if (funcDocs && paramDef && paramDef.name) {
        const cleanName = paramDef.name.replace(/_/g, '');
        const nameRegex = new RegExp(`-\\s*\\*\\*Parameter:\\*\\*\\s*(?:\\[)?(?:[a-zA-Z0-9_]*${cleanName}[a-zA-Z0-9_]*)(?:\\])?[\\s\\S]*?(?=-\\s*\\*\\*Parameter:\\*\\*|\\*\\*Return Type|$)`, 'i');
        const match = funcDocs.match(nameRegex);
        if (match) {
            text += ' ' + match[0];
        }
    }
    return text;
}

function extractEnumOptionsFromDoc(paramDef, funcDocs) {
    const text = getParamDocSection(paramDef, funcDocs);
    const results = [];
    const seen = new Set();

    // 1. Bullet list: Valid values are: * SHA256 (Default) * SHA384 ...
    const bulletMatch = text.match(/valid values are:\s*([\s\S]*?)(?:::|\n\n|\.\s|$|>)/i);
    if (bulletMatch) {
        const bullets = bulletMatch[1].match(/\*\s*([A-Za-z0-9_-]+)(?:\s*\((Default)\))?/gi);
        if (bullets) {
            for (const b of bullets) {
                const m = b.match(/\*\s*([A-Za-z0-9_-]+)(?:\s*\((Default)\))?/i);
                if (m && !seen.has(m[1].toLowerCase())) {
                    const val = m[1];
                    if (val.toLowerCase() !== 'note' && val.toLowerCase() !== 'values') {
                        seen.add(val.toLowerCase());
                        results.push({
                            value: val,
                            isDefault: !!m[2]
                        });
                    }
                }
            }
        }
    }

    // 2. 'Takes the string values "asc" (ascending) or "desc" (descending)'
    const takesMatch = text.match(/takes the string values\s+([^.]+)/i);
    if (takesMatch) {
        const quoted = takesMatch[1].match(/["']([^"']+)["']/g);
        if (quoted) {
            for (const q of quoted) {
                const val = q.replace(/["']/g, '');
                if (!seen.has(val.toLowerCase())) {
                    seen.add(val.toLowerCase());
                    results.push({
                        value: val,
                        isDefault: text.toLowerCase().includes('default is ' + val.toLowerCase()) ||
                                   text.toLowerCase().includes('default is "' + val.toLowerCase() + '"')
                    });
                }
            }
        }
    }

    // 3. Supported methods: GET, DELETE, PATCH, POST, or PUT
    const methodsMatch = text.match(/supported methods:\s*([^\n.]+)/i);
    if (methodsMatch) {
        const words = methodsMatch[1].match(/[A-Z]{3,6}/g);
        if (words) {
            for (const w of words) {
                if (w !== 'OR' && w !== 'AND' && !seen.has(w.toLowerCase())) {
                    seen.add(w.toLowerCase());
                    results.push({ value: w, isDefault: w === 'GET' });
                }
            }
        }
    }

    return results;
}

const extractSemanticOptions = extractEnumOptionsFromDoc;

function synthesizeSmartParameterValues(paramDef, paramIndex, actualArgs, lhsType, document, funcName, funcMeta) {
    const results = [];
    const paramName = (paramDef.name || '').toLowerCase();
    const paramType = (paramDef.type || 'String').toLowerCase();

    // 1. Doc-extracted Enums from BML Knowledge Base
    const docEnums = extractEnumOptionsFromDoc(paramDef, funcMeta ? funcMeta.docs : null);
    if (docEnums.length > 0) {
        docEnums.forEach(item => {
            const lit = `"${item.value}"`;
            results.push({
                text: lit,
                title: `Use ${lit} (${paramDef.name})`,
                preferred: item.isDefault || false
            });
        });
        if (!results.some(r => r.preferred) && results.length > 0) {
            results[0].preferred = true;
        }
        return results;
    }

    if (/valuetype|returntype|type/i.test(paramName) && (funcName === 'get' || funcName === 'jsonget' || funcName === 'jsonpathgetsingle' || funcName === 'jsonarrayget')) {
        const types = ['float', 'integer', 'boolean', 'string', 'json', 'jsonarray', 'string[]', 'integer[]', 'float[]'];
        const ranked = [];
        if (lhsType) {
            const target = lhsType.toLowerCase();
            const idx = types.indexOf(target);
            if (idx !== -1) {
                ranked.push(target);
                types.splice(idx, 1);
            }
        }
        ranked.push(...types);
        ranked.slice(0, 4).forEach((t, idx) => {
            results.push({
                text: `"${t}"`,
                title: `Retrieve value as "${t}"`,
                preferred: idx === 0
            });
        });
        return results;
    }

    if (/delim|delimiter|separator|sep/i.test(paramName)) {
        DELIMITERS.slice(0, 4).forEach((d, idx) => {
            const isComma = d.name === ',';
            results.push({
                text: `"${d.name}"`,
                title: isComma ? `Split/Join with comma: '","'` : (d.detail ? `${d.detail}: '"${d.name}"'` : `Use delimiter ${d.description || d.name}`),
                preferred: idx === 0
            });
        });
        return results;
    }

    if (/method|httpmethod/i.test(paramName) || (funcName === 'urldata' && paramIndex === 1)) {
        HTTP_METHODS.slice(0, 3).forEach((m, idx) => {
            results.push({
                text: `"${m.name}"`,
                title: `HTTP ${m.name}`,
                preferred: m.name === 'GET' || idx === 0
            });
        });
        return results;
    }

    if (/algorithm|algo|hash/i.test(paramName) || (funcName === 'generatehmacmessage' && paramIndex === 2)) {
        const algos = ['HmacSHA256', 'HmacSHA1', 'HmacMD5'];
        algos.forEach((a, idx) => {
            results.push({
                text: `"${a}"`,
                title: `Algorithm "${a}"`,
                preferred: idx === 0
            });
        });
        return results;
    }

    if (/order|sortorder/i.test(paramName) || (funcName === 'sort' && paramIndex === 1)) {
        SORT_ORDERS.forEach((o, idx) => {
            results.push({
                text: `"${o.name}"`,
                title: `Sort order "${o.name}" (${o.description})`,
                preferred: o.name === 'asc'
            });
        });
        return results;
    }

    if (/sorttype/i.test(paramName) || (funcName === 'sort' && paramIndex === 2)) {
        SORT_TYPES.forEach((t, idx) => {
            results.push({
                text: `"${t.name}"`,
                title: `Sort type "${t.name}"`,
                preferred: idx === 0
            });
        });
        return results;
    }

    if (/dicttype/i.test(paramName)) {
        DICT_TYPES.slice(0, 4).forEach((dt, idx) => {
            results.push({
                text: `"${dt.name}"`,
                title: `Dictionary type "${dt.name}"`,
                preferred: idx === 0
            });
        });
        return results;
    }

    if (/dateformat|format/i.test(paramName) && !paramName.includes('currency')) {
        const fmt = findPredominantDateFormat(document);
        results.push({ text: fmt, title: `Format date with ${fmt}`, preferred: true });
        DATE_FORMATS.slice(0, 3).forEach(df => {
            const val = `"${df.name}"`;
            if (val !== fmt) {
                results.push({ text: val, title: `Format date with ${val}`, preferred: false });
            }
        });
        return results;
    }

    if (/timezone|tz/i.test(paramName)) {
        results.push({ text: '"UTC"', title: 'Timezone "UTC"', preferred: true });
        results.push({ text: '"America/New_York"', title: 'Timezone "America/New_York"', preferred: false });
        return results;
    }

    if (/currency/i.test(paramName)) {
        CURRENCY_CODES.slice(0, 4).forEach((c, idx) => {
            results.push({
                text: `"${c.name}"`,
                title: `Currency ${c.name}`,
                preferred: idx === 0
            });
        });
        return results;
    }

    if (/timeout|millis/i.test(paramName)) {
        results.push({ text: '10000', title: '10 second timeout (10000ms)', preferred: true });
        results.push({ text: '5000', title: '5 second timeout (5000ms)', preferred: false });
        return results;
    }

    if (/headers/i.test(paramName)) {
        const inScopeVars = findInScopeVariables(document, 'headers', 'dict');
        if (inScopeVars.length > 0) {
            results.push({ text: inScopeVars[0], title: `Use '${inScopeVars[0]}' headers variable`, preferred: true });
        }
        results.push({ text: 'dict("string")', title: 'Empty headers dictionary: dict("string")', preferred: inScopeVars.length === 0 });
        return results;
    }

    if (/error|errordict/i.test(paramName)) {
        const inScopeVars = findInScopeVariables(document, 'error', 'dict');
        if (inScopeVars.length > 0) {
            results.push({ text: inScopeVars[0], title: `Use '${inScopeVars[0]}' variable`, preferred: true });
        }
        results.push({ text: 'dict("string")', title: 'dict("string") error placeholder', preferred: inScopeVars.length === 0 });
        results.push({ text: '"Error"', title: 'Error string: "Error"', preferred: false });
        return results;
    }

    if (/^y$|decimal|precision/i.test(paramName)) {
        const isPrice = /price|cost|amount|total|tax|discount|fee|margin/i.test(actualArgs[0] || '');
        results.push({ text: '2', title: '2 decimal places (currency)', preferred: isPrice });
        results.push({ text: '0', title: '0 decimal places (integer)', preferred: !isPrice });
        return results;
    }

    if (/end|endindex/i.test(paramName)) {
        const target = actualArgs[0] || 'str';
        results.push({ text: `len(${target})`, title: `Extract through end of string: 'len(${target})'`, preferred: true });
        return results;
    }

    if (/defaultvalue|def|fallback/i.test(paramName)) {
        let expectedValType = lhsType;
        if (actualArgs && actualArgs.length > 0) {
            for (const arg of actualArgs) {
                const clean = (arg || '').replace(/['"]/g, '').toLowerCase().trim();
                if (['integer', 'float', 'boolean', 'json', 'jsonarray', 'string'].includes(clean)) {
                    expectedValType = clean;
                    break;
                }
            }
        }
        if (expectedValType === 'integer') results.push({ text: '0', title: 'Default integer 0', preferred: true });
        else if (expectedValType === 'float') results.push({ text: '0.0', title: 'Default float 0.0', preferred: true });
        else if (expectedValType === 'boolean') results.push({ text: 'false', title: 'Default boolean false', preferred: true });
        else if (expectedValType === 'json') results.push({ text: 'json("{}")', title: 'Default empty JSON', preferred: true });
        else if (expectedValType === 'jsonarray') results.push({ text: 'jsonarray("[]")', title: 'Default empty JSON array', preferred: true });
        else results.push({ text: '""', title: 'Default empty string ""', preferred: true });
        return results;
    }

    const matchedVars = findInScopeVariables(document, paramName, paramType);
    if (matchedVars.length > 0) {
        results.push({ text: matchedVars[0], title: `Use '${matchedVars[0]}' for ${paramDef.name}`, preferred: true });
    }

    if (paramType.includes('string') && !paramType.includes('[]')) {
        results.push({ text: '""', title: `Supply empty string for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('integer') && !paramType.includes('[]')) {
        results.push({ text: '0', title: `Supply integer 0 for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('float') && !paramType.includes('[]')) {
        results.push({ text: '0.0', title: `Supply float 0.0 for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('boolean') && !paramType.includes('[]')) {
        results.push({ text: 'true', title: `Supply boolean true for '${paramDef.name}'`, preferred: results.length === 0 });
        results.push({ text: 'false', title: `Supply boolean false for '${paramDef.name}'`, preferred: false });
    } else if (paramType.includes('date') && !paramType.includes('[]')) {
        results.push({ text: 'getdate()', title: `Supply current date: getdate() for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('dict')) {
        results.push({ text: 'dict("string")', title: `Supply dictionary dict("string") for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('jsonarray')) {
        results.push({ text: 'jsonarray("[]")', title: `Supply empty jsonarray("[]") for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('json')) {
        results.push({ text: 'json("{}")', title: `Supply empty json("{}") for '${paramDef.name}'`, preferred: results.length === 0 });
    } else if (paramType.includes('[]')) {
        results.push({ text: 'String[]{}', title: `Supply array literal for '${paramDef.name}'`, preferred: results.length === 0 });
    } else {
        results.push({ text: 'null', title: `Supply null for '${paramDef.name}'`, preferred: results.length === 0 });
    }

    return results;
}

function synthesizeCanonicalCallCompletions(funcMeta, args, document) {
    const results = [];
    if (!funcMeta) return results;

    const baseName = (funcMeta.name || '').toLowerCase();
    const snippets = getCustomSnippets();

    for (const [sKey, sVal] of Object.entries(snippets)) {
        if (!sVal || !sVal.syntax) continue;
        const keyParts = sKey.toLowerCase().split(/[-_]/);
        if (!keyParts.includes(baseName)) continue;

        const callPattern = new RegExp(`\\b${baseName}\\s*\\(([^)]*)\\)`);
        const match = sVal.syntax.match(callPattern);
        if (match) {
            const rawArgs = match[1];
            const cleanArgs = rawArgs.replace(/\$\{\d+(?::([^|}]+)(?:\|[^}]+)?)?\}/g, '$1').replace(/\\"/g, '"');
            const snippetParts = splitArgumentsList(cleanArgs);
            if (snippetParts.length > args.length) {
                const blended = [...args];
                for (let i = args.length; i < snippetParts.length; i++) {
                    const argVal = snippetParts[i].toLowerCase() === '"get"' ? '"get"' : snippetParts[i];
                    blended.push(argVal);
                }
                const text = blended.join(', ');
                const isHttpGet = /"get"/i.test(text);
                const title = isHttpGet
                    ? `Use GET method with headers: '${baseName}(${text})'`
                    : (sVal.notes || `Complete '${baseName}' from snippet`);
                results.push({
                    text,
                    title,
                    preferred: isHttpGet || results.length === 0
                });

                if (isHttpGet) {
                    results.push({
                        text: `${args[0]}, "get", dict("string")`,
                        title: `Use GET method with empty dict: '${baseName}(${args[0]}, "get", dict("string"))'`,
                        preferred: false
                    });
                }
            }
        }
    }

    if (funcMeta.examples && Array.isArray(funcMeta.examples)) {
        for (const ex of funcMeta.examples) {
            const exRegex = new RegExp(`\\b${baseName}\\s*\\(([^)]*)\\)`, 'gi');
            let m;
            while ((m = exRegex.exec(ex)) !== null) {
                const exArgs = splitArgumentsList(m[1]);
                if (exArgs.length > args.length) {
                    const blended = [...args];
                    for (let i = args.length; i < exArgs.length; i++) {
                        blended.push(exArgs[i].trim());
                    }
                    const text = blended.join(', ');
                    if (!results.some(r => r.text === text)) {
                        results.push({
                            text,
                            title: `Complete with documentation example: '${baseName}(${text})'`,
                            preferred: false
                        });
                    }
                }
            }
        }
    }

    return results;
}

module.exports = {
    getBmlFunctions,
    getCustomSnippets,
    getWorkspaceFunctionInfo,
    inferLhsExpectedType,
    findPredominantDateFormat,
    findInScopeVariables,
    extractSemanticOptions,
    extractEnumOptionsFromDoc: extractSemanticOptions,
    synthesizeSmartParameterValues,
    synthesizeCanonicalCallCompletions
};
