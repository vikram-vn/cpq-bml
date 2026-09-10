const { checkBmqlSafety } = require('@/lang/lint/categories/best-practices/bmqlSafety');
const { checkCodeQuality } = require('@/lang/lint/categories/best-practices/codeQuality');
const { checkCommercePractices } = require('@/lang/lint/categories/best-practices/commercePractices');
const { checkDataSafety } = require('@/lang/lint/categories/best-practices/dataSafety');
const { checkSecurity } = require('@/lang/lint/categories/best-practices/security');
const { checkSyntaxRules } = require('@/lang/lint/categories/best-practices/syntaxRules');
const { checkSelfReference } = require('@/lang/lint/categories/best-practices/selfReference');

const { checkArray } = require('@/lang/lint/categories/array/array');
const { checkBmql } = require('@/lang/lint/categories/bmql/bmql');
const { checkDate } = require('@/lang/lint/categories/date/date');
const { checkDictionary } = require('@/lang/lint/categories/dictionary/dictionary');
const { checkJson } = require('@/lang/lint/categories/json/json');
const { checkMath } = require('@/lang/lint/categories/math/math');
const { checkOthers } = require('@/lang/lint/categories/others/others');
const { checkString } = require('@/lang/lint/categories/string/string');
const { checkUrlAccess } = require('@/lang/lint/categories/url-access/urlAccess');
const { checkXml } = require('@/lang/lint/categories/xml/xml');

function checkBestPractices(cleanText, noStringsText, doc, firstTypeByVar) {
    const diagnostics = [];

    const hasArray = cleanText.includes('[') || cleanText.includes('array') || cleanText.includes('Array') || cleanText.includes('append');
    if (hasArray) {
        diagnostics.push(...checkArray(cleanText, noStringsText, doc, firstTypeByVar));
    }

    const hasBmql = cleanText.includes('bmql') || cleanText.includes('SELECT') || cleanText.includes('select') || cleanText.includes('gettabledata') || cleanText.includes('getpartsdata');
    if (hasBmql) {
        diagnostics.push(...checkBmql(cleanText, noStringsText, doc));
        diagnostics.push(...checkBmqlSafety(cleanText, noStringsText, doc));
    }

    const hasDate = cleanText.includes('date') || cleanText.includes('Date') || cleanText.includes('time') || cleanText.includes('day');
    if (hasDate) {
        diagnostics.push(...checkDate(cleanText, noStringsText, doc, firstTypeByVar));
    }

    const hasDict = cleanText.includes('dict') || cleanText.includes('Dict');
    if (hasDict) {
        diagnostics.push(...checkDictionary(cleanText, noStringsText, doc, firstTypeByVar));
    }

    const hasJson = cleanText.includes('json') || cleanText.includes('Json') || cleanText.includes('JSON');
    if (hasJson) {
        diagnostics.push(...checkJson(cleanText, noStringsText, doc, firstTypeByVar));
    }

    diagnostics.push(...checkMath(cleanText, noStringsText, doc, firstTypeByVar));
    diagnostics.push(...checkOthers(cleanText, noStringsText, doc, firstTypeByVar));
    diagnostics.push(...checkString(cleanText, noStringsText, doc, firstTypeByVar));

    const hasUrl = cleanText.includes('url') || cleanText.includes('URL') || cleanText.includes('http') || cleanText.includes('HTTP');
    if (hasUrl) {
        diagnostics.push(...checkUrlAccess(cleanText, noStringsText, doc, firstTypeByVar));
    }

    const hasXml = cleanText.includes('xml') || cleanText.includes('XML');
    if (hasXml) {
        diagnostics.push(...checkXml(cleanText, noStringsText, doc, firstTypeByVar));
    }

    diagnostics.push(...checkCodeQuality(cleanText, noStringsText, doc));

    const hasCommerce = cleanText.includes('commerce') || cleanText.includes('line') || cleanText.includes('transaction') || cleanText.includes('_l') || cleanText.includes('_t');
    if (hasCommerce) {
        diagnostics.push(...checkCommercePractices(cleanText, noStringsText, doc));
    }

    diagnostics.push(...checkDataSafety(cleanText, noStringsText, doc));
    diagnostics.push(...checkSecurity(cleanText, noStringsText, doc));
    diagnostics.push(...checkSyntaxRules(cleanText, noStringsText, doc));

    if (cleanText.includes('return') || cleanText.includes('=')) {
        diagnostics.push(...checkSelfReference(cleanText, noStringsText, doc));
    }

    return diagnostics;
}

module.exports = { checkBestPractices };
