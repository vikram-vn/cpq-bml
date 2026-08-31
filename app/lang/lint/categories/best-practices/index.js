const { checkBmqlSafety } = require('./bmqlSafety');
const { checkCodeQuality } = require('./codeQuality');
const { checkCommercePractices } = require('./commercePractices');
const { checkDataSafety } = require('./dataSafety');
const { checkSecurity } = require('./security');
const { checkSyntaxRules } = require('./syntaxRules');
const { checkSelfReference } = require('./selfReference');

const { checkArray } = require('../array/array');
const { checkBmql } = require('../bmql/bmql');
const { checkDate } = require('../date/date');
const { checkDictionary } = require('../dictionary/dictionary');
const { checkJson } = require('../json/json');
const { checkMath } = require('../math/math');
const { checkOthers } = require('../others/others');
const { checkString } = require('../string/string');
const { checkUrlAccess } = require('../url-access/urlAccess');
const { checkXml } = require('../xml/xml');

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
