const vscode = require('vscode');
const { parseParameters } = require('./signatureHelp');
const { getWorkspaceIndex } = require('./workspaceIndex');
const { loadJson } = require('./apiDataLoader');

function extractParamName(label) {
    if (!label) return '';
    const parts = label.trim().replace(/[\[\]]/g, '').split(/\s+/);
    return parts[parts.length - 1];
}

function shouldSuppressHint(paramName, argText, suppressWhenMatch) {
    if (!suppressWhenMatch || !paramName || !argText) return false;
    const cleanParam = paramName.trim().toLowerCase().replace(/^[_\$]+|[_\$]+$/g, '');
    const cleanArg = argText.trim().replace(/^['"]|['"]$/g, '').toLowerCase().replace(/^[_\$]+|[_\$]+$/g, '');
    if (!cleanParam || !cleanArg) return false;
    return cleanParam === cleanArg;
}

/**
 * Curated, idiomatic BML parameter names for built-in functions.
 * Handles variadic / overloaded signatures dynamically.
 */
const BML_CURATED_PARAMS = {
    // Strings
    'replace': ['str', 'oldValue', 'newValue', 'maxCount'],
    'split': ['str', 'separator'],
    'substring': ['str', 'startIndex', 'endIndex'],
    'find': ['str', 'substring', 'startIndex', 'endIndex'],
    'startswith': ['str', 'prefix'],
    'endswith': ['str', 'suffix'],
    'join': ['stringArray', 'delimiter'],
    'len': ['str'],
    'lower': ['str'],
    'upper': ['str'],
    'trim': ['str'],
    'html': ['str'],
    'encodebase64': ['str'],
    'decodebase64': ['str'],
    'atof': ['str'],
    'atoi': ['str'],
    'isnumber': ['str'],
    'formatascurrency': ['amount', 'currencyCode'],
    'getcurrencyvalue': ['currencyStr', 'currencyCode'],

    // String Builder
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
    'sbtostring': ['stringBuilder'],

    // Arrays & Collections
    'append': ['array', 'element'],
    'remove': ['array', 'index'],
    'findinarray': ['array', 'element'],
    'indexof': ['array', 'element'],
    'sizeofarray': ['array'],
    'reverse': ['array'],
    'sort': ['array', 'ascending'],
    'slice': ['array', 'startIndex', 'endIndex'],
    'range': (count) => {
        if (count === 1) return ['end'];
        if (count === 2) return ['start', 'end'];
        return ['start', 'end', 'step'];
    },
    'isempty': ['collection'],
    'isnull': ['value'],

    // Math
    'fmod': ['dividend', 'divisor'],
    'pow': ['base', 'exponent'],
    'hypot': ['a', 'b'],
    'round': ['number', 'decimals'],
    'abs': ['number'],
    'fabs': ['number'],
    'ceil': ['number'],
    'floor': ['number'],
    'sqrt': ['number'],
    'exp': ['number'],
    'ln': ['number'],
    'log': ['number'],
    'sin': ['radians'],
    'cos': ['radians'],
    'tan': ['radians'],
    'asin': ['value'],
    'acos': ['value'],
    'atan': ['value'],
    'sinh': ['value'],
    'cosh': ['value'],
    'tanh': ['value'],
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

    // Dictionaries & JSON
    'dict': ['dataType'],
    'put': ['dict', 'key', 'value'],
    'get': ['dict', 'key', 'returnType'],
    'keys': ['dict'],
    'values': ['dict'],
    'containskey': ['dict', 'key'],
    'json': ['jsonString'],
    'jsonput': ['json', 'key', 'value'],
    'jsonget': ['json', 'key', 'returnType'],
    'jsonkeys': ['json'],
    'jsonremove': ['json', 'key'],
    'jsontostr': ['json'],
    'jsoncopy': ['json'],
    'isjsonnull': ['json', 'key'],
    'jsonpathgetsingle': ['json', 'jsonPath', 'returnType'],
    'jsonpathgetmultiple': ['json', 'jsonPath', 'returnType'],
    'jsonpathset': ['json', 'jsonPath', 'value', 'returnType'],
    'jsonpathremove': ['json', 'jsonPath'],
    'jsonpathcheck': ['json', 'jsonPath'],
    'jsonarray': ['jsonString'],
    'jsonarrayget': ['jsonArray', 'index', 'returnType'],
    'jsonarrayappend': ['jsonArray', 'element'],
    'jsonarrayput': ['jsonArray', 'index', 'element'],
    'jsonarrayremove': ['jsonArray', 'index'],
    'jsonarraysize': ['jsonArray'],
    'jsonarraytostr': ['jsonArray'],
    'jsonarraycopy': ['jsonArray'],

    // Database & BMQL & Data Tables
    'getfloat': ['record', 'fieldName'],
    'getstr': ['record', 'fieldName'],
    'getint': ['record', 'fieldName'],
    'getboolean': ['record', 'fieldName'],
    'getdate': ['record', 'fieldName'],
    'getpartsdata': ['selectFields', 'partNumbers', 'currencyCode'],
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
    'getattachmentdata': ['attachmentId', 'asBytes'],
    'getconfigattrvalue': ['documentNumber', 'attrVarName'],
    'getoldvalue': ['attributeVarName'],
    'getsystemdata': ['dataField'],
    'getsystemattrvalues': ['jsonPath'],
    'getsystemmultipleattrvalues': ['jsonPathsDict'],

    // Date & Time
    'addmonths': ['date', 'months'],
    'adddays': ['date', 'days'],
    'minusdays': ['date', 'days'],
    'getdiffindays': ['startDate', 'endDate'],
    'datetostr': ['date', 'format', 'timezone'],
    'strtodate': ['dateStr', 'format', 'timezone'],
    'strtojavadate': ['dateStr', 'format', 'timezone'],
    'formatdate': ['date', 'format', 'timezone'],
    'comparedates': ['date1', 'date2'],
    'isleap': ['year'],
    'isweekend': ['date'],
    'getstrdate': ['date'],

    // Web Services & REST
    'urldata': ['url', 'method', 'headers', 'payload'],
    'urldatabyget': ['url', 'parameters', 'defaultValue'],
    'urldatabypost': ['url', 'parameters', 'defaultValue'],
    'urldatabypostasync': ['url', 'parameters', 'defaultValue'],
    'urlmultipartbypost': ['url', 'payload'],
    'makeurlparam': ['paramDict'],
    'generatehmacmessage': ['message', 'key', 'algorithm'],
    'bytearray': ['content', 'charset'],

    // Commerce & BOM
    'applybom': ['baseBom', 'bomToApply'],
    'calculateconfiguration': ['baseConfigKey', 'linesToApply'],
    'calculatedeltabom': ['priorBom', 'currentBom', 'inputBom'],
    'savebom': ['bsId', 'bomJson'],
    'saveconfigbom': ['configBomJson', 'instanceAttributes'],
    'getbom': ['bsId', 'lineNumber'],
    'getconfigurationbom': ['documentNumber'],
    'convertbomtoflat': ['bomDict'],
    'convertbomtohier': ['bomDict'],
    'addpartstotransaction': ['parts', 'priceBookVarName'],
    'addtotransaction': ['items', 'priceBookVarName'],
    'validatequoteforagreement': ['transactionId'],
    'setattributevalue': ['docNumber', 'attrVarName', 'value'],

    // Session & Global Storage
    'usersessionset': ['key', 'value'],
    'usersessionget': ['key'],
    'usersessionremove': ['key'],
    'globaldictset': ['key', 'value'],
    'globaldictget': ['key'],
    'globaldictremove': ['key'],

    // XML
    'readxmlsingle': ['xml', 'xpath'],
    'readxmlmultiple': ['xml', 'xpath'],
    'transformxml': ['xml', 'xslt'],
    'applytemplate': ['templateName', 'dataDict']
};

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
    const info = bmlApiData ? bmlApiData[funcLower] : null;
    if (info && (info.fullSignature || info.syntax)) {
        const parsed = parseParameters(info.fullSignature || info.syntax);
        paramNames = parsed.map(p => extractParamName(typeof p.label === 'string' ? p.label : p.label[0]));
    } else {
        const wsIndex = getWorkspaceIndex();
        const wsInfo = wsIndex ? wsIndex.get(funcLower) : null;
        if (wsInfo && wsInfo.parameters) {
            paramNames = wsInfo.parameters.map(p => p.name);
        }
    }

    if (paramNamesCache.size < 2000) {
        paramNamesCache.set(funcLower, paramNames);
    }
    return paramNames;
}

function isInsideCommentOrString(fullText, targetOffset) {
    let inLineComment = false;
    let inBlockComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < targetOffset; i++) {
        const ch = fullText[i];
        const next = i + 1 < fullText.length ? fullText[i + 1] : '';

        if (inLineComment) {
            if (ch === '\n') {
                inLineComment = false;
            }
        } else if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
        } else if (inString) {
            if (ch === stringChar && fullText[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (ch === '/' && next === '/') {
                inLineComment = true;
                i++;
            } else if (ch === '/' && next === '*') {
                inBlockComment = true;
                i++;
            } else if (ch === '"' || charIsSingleQuote(ch)) {
                inString = true;
                stringChar = ch;
            }
        }
    }

    return inLineComment || inBlockComment || inString;
}

function charIsSingleQuote(ch) {
    return ch === "'";
}

/**
 * Provides inline parameter name labels for BML function calls.
 */
function registerInlayHintsProvider(context) {
    return vscode.languages.registerInlayHintsProvider('bml', {
        provideInlayHints(document, range) {
            const config = vscode.workspace.getConfiguration('cpqBml');
            if (!config.get('features.intellisense', true)) {
                return [];
            }
            if (!config.get('inlayHints.enabled', true)) {
                return [];
            }

            const suppressWhenArgumentMatchesName = config.get('inlayHints.suppressWhenArgumentMatchesName', true);
            const minParams = Math.max(1, config.get('inlayHints.minimumParameters', 2));

            const bmlApiData = loadJson('bml-functions-api-usage', context.extensionPath);
            const hints = [];
            const text = document.getText(range);
            const startOffset = document.offsetAt(range.start);
            const fullText = document.getText();

            const callRegex = /\b([a-zA-Z_][\w.]*)\s*\(/g;
            let match;

            while ((match = callRegex.exec(text)) !== null) {
                const callStartOffset = startOffset + match.index;
                if (isInsideCommentOrString(fullText, callStartOffset)) {
                    continue;
                }

                const funcName = match[1];
                const funcLower = funcName.toLowerCase();

                if (['if', 'elif', 'else', 'for', 'while', 'return'].includes(funcLower)) {
                    continue;
                }

                const openParenOffset = startOffset + match.index + match[0].length;

                let i = openParenOffset;
                let parenDepth = 1;
                let inString = false;
                let stringChar = '';
                const argStarts = [openParenOffset];
                const argEnds = [];
                const maxLookahead = Math.min(fullText.length, openParenOffset + 2000);

                while (i < maxLookahead && parenDepth > 0) {
                    const char = fullText[i];

                    if (inString) {
                        if (char === stringChar && fullText[i - 1] !== '\\') {
                            inString = false;
                        }
                    } else if (char === '"' || char === "'") {
                        inString = true;
                        stringChar = char;
                    } else if (char === '(') {
                        parenDepth++;
                    } else if (char === ')') {
                        parenDepth--;
                        if (parenDepth === 0) {
                            argEnds.push(i);
                        }
                    } else if (char === ',' && parenDepth === 1) {
                        argEnds.push(i);
                        let nextStart = i + 1;
                        while (nextStart < maxLookahead && /\s/.test(fullText[nextStart])) {
                            nextStart++;
                        }
                        argStarts.push(nextStart);
                    }
                    i++;
                }

                const paramNames = resolveParamNames(funcLower, argStarts.length, bmlApiData);
                if (!paramNames || paramNames.length < minParams) continue;

                if (argStarts.length >= minParams) {
                    argStarts.forEach((argOffset, idx) => {
                        if (idx < paramNames.length && paramNames[idx]) {
                            const paramName = paramNames[idx];
                            const argEnd = argEnds[idx] !== undefined ? argEnds[idx] : argOffset;
                            const argText = fullText.slice(argOffset, argEnd).trim();

                            if (shouldSuppressHint(paramName, argText, suppressWhenArgumentMatchesName)) {
                                return;
                            }

                            const pos = document.positionAt(argOffset);
                            if (pos.line >= range.start.line && pos.line <= range.end.line) {
                                const hint = new vscode.InlayHint(
                                    pos,
                                    `${paramName}: `,
                                    vscode.InlayHintKind.Parameter
                                );
                                hint.paddingRight = true;
                                hints.push(hint);
                            }
                        }
                    });
                }
            }

            return hints;
        }
    });
}

module.exports = { registerInlayHintsProvider, extractParamName, shouldSuppressHint, resolveParamNames, isInsideCommentOrString, BML_CURATED_PARAMS };
