const { getQuotedStringRange } = require('./utils');
const { TIMEZONES, getTimezoneCompletions } = require('./timezones');
const { DATE_FORMATS, GETDATE_BOOLEANS, getDateFormatCompletions, getGetDateIncludeTimeCompletions } = require('./dateParams');
const { CURRENCY_CODES, getCurrencyCodeCompletions } = require('./currencies');
const { DELIMITERS, getDelimiterCompletions } = require('./delimiters');
const {
    HTTP_METHODS,
    CONTENT_TYPES,
    ENCODINGS,
    getHttpMethodCompletions,
    getContentTypeCompletions,
    getEncodingCompletions
} = require('./httpAndWeb');
const {
    CPQJS_TABLE_NAMES,
    CPQJS_ACTIONS,
    CPQJS_ATTRIBUTES,
    getCpqjsTableCompletions,
    getCpqjsActionCompletions,
    getCpqjsAttributeCompletions
} = require('./cpqjsParams');
const { BMQL_TEMPLATES, getBmqlQueryCompletions } = require('./bmqlParams');
const { JSON_PATH_TEMPLATES, getJsonPathCompletions } = require('./jsonParams');
const { DICT_TYPES, getDictTypeCompletions } = require('./dictParams');
const {
    SORT_ORDERS,
    SORT_TYPES,
    BYTEARRAY_CHARSETS,
    getSortOrderCompletions,
    getSortTypeCompletions,
    getByteArrayCharsetCompletions
} = require('./arrayParams');

/**
 * Main dispatcher for Smart Parameter Completions based on active function call and parameter index.
 */
function resolveParameterCompletions(activeCall, document, position) {
    if (!activeCall || !activeCall.funcName) return null;

    const fn = activeCall.funcName.toLowerCase();
    const paramIdx = activeCall.paramIndex;

    // Array functions: sort(arrayID, [sortOrder], [sortType]), bytearray(content [, charset])
    if (['sort'].includes(fn)) {
        if (paramIdx === 1) return getSortOrderCompletions(document, position);
        if (paramIdx === 2) return getSortTypeCompletions(document, position);
    }
    if (['bytearray'].includes(fn) && paramIdx === 1) {
        return getByteArrayCharsetCompletions(document, position);
    }

    // Dictionary constructor functions: dict, dictionary
    if (['dict', 'dictionary'].includes(fn) && paramIdx === 0) {
        return getDictTypeCompletions(document, position);
    }

    // Date functions: datetostr, strtojavadate, strtodate, getdate
    if (['datetostr', 'strtojavadate', 'strtodate'].includes(fn)) {
        if (paramIdx === 2) return getTimezoneCompletions(document, position);
        if (paramIdx === 1) return getDateFormatCompletions(document, position);
    }
    if (['getdate'].includes(fn) && paramIdx === 0) {
        return getGetDateIncludeTimeCompletions(document, position);
    }

    // Currency functions: formatascurrency, getcurrencyvalue
    if (['formatascurrency', 'getcurrencyvalue'].includes(fn)) {
        if (paramIdx === 1) return getCurrencyCodeCompletions(document, position);
    }

    // Delimiter functions: split, join
    if (['split', 'join'].includes(fn)) {
        if (paramIdx === 1) return getDelimiterCompletions(document, position);
    }

    // Web / HTTP functions: urldataaccess, urldata, sendmail
    if (['urldataaccess'].includes(fn) && paramIdx === 0) {
        return getHttpMethodCompletions(document, position);
    }
    if (['urldata'].includes(fn) && paramIdx === 1) {
        return getHttpMethodCompletions(document, position);
    }
    if (['sendmail'].includes(fn) && paramIdx === 3) {
        return getContentTypeCompletions(document, position);
    }
    if (['generatehmacmessage'].includes(fn) && paramIdx === 2) {
        const { getHmacAlgorithmCompletions } = require('./httpAndWeb');
        return getHmacAlgorithmCompletions(document, position);
    }

    // JSONPath functions: jsonpathgetsingle, jsonpathgetmultiple, jsonpathset, jsonpathremove, jsonpathcheck, jsonpathget
    if (['jsonpathgetsingle', 'jsonpathgetmultiple', 'jsonpathset', 'jsonpathremove', 'jsonpathcheck', 'jsonpathget'].includes(fn) && paramIdx === 1) {
        return getJsonPathCompletions(document, position);
    }
    if (['jsonget', 'jsonarrayget', 'jsonpathgetsingle'].includes(fn) && paramIdx === 2) {
        const { getJsonValueTypeCompletions } = require('./jsonParams');
        return getJsonValueTypeCompletions(document, position);
    }

    // BMQL function
    if (['bmql'].includes(fn) && paramIdx === 0) {
        return getBmqlQueryCompletions(document, position);
    }

    // CPQJS methods
    if (['cpqjs.gettableinfo', 'cpqjs.ontableloaded', 'cpqjs.tableexists'].includes(fn) && paramIdx === 0) {
        return getCpqjsTableCompletions(document, position);
    }
    if (['cpqjs.actionexists', 'cpqjs.performaction', 'cpqjs.onactioncomplete'].includes(fn) && paramIdx === 0) {
        return getCpqjsActionCompletions(document, position);
    }
    if (['cpqjs.getattributeval', 'cpqjs.setattributeval', 'cpqjs.setattributestate', 'cpqjs.onattributechange', 'cpqjs.attributeexists'].includes(fn) && paramIdx === 0) {
        return getCpqjsAttributeCompletions(document, position);
    }

    return null;
}

module.exports = {
    getQuotedStringRange,
    TIMEZONES,
    getTimezoneCompletions,
    DATE_FORMATS,
    getDateFormatCompletions,
    CURRENCY_CODES,
    getCurrencyCodeCompletions,
    DELIMITERS,
    getDelimiterCompletions,
    HTTP_METHODS,
    CONTENT_TYPES,
    ENCODINGS,
    getHttpMethodCompletions,
    getContentTypeCompletions,
    getEncodingCompletions,
    CPQJS_TABLE_NAMES,
    CPQJS_ACTIONS,
    CPQJS_ATTRIBUTES,
    getCpqjsTableCompletions,
    getCpqjsActionCompletions,
    getCpqjsAttributeCompletions,
    BMQL_TEMPLATES,
    getBmqlQueryCompletions,
    JSON_PATH_TEMPLATES,
    getJsonPathCompletions,
    DICT_TYPES,
    getDictTypeCompletions,
    SORT_ORDERS,
    SORT_TYPES,
    getSortOrderCompletions,
    getSortTypeCompletions,
    resolveParameterCompletions
};
