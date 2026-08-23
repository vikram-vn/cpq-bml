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

/**
 * Runs every best-practice sub-check and combines their diagnostics.
 * Each sub-check lives in its own file, grouped by concern - see the doc
 * comment at the top of each for its codes.
 */
function checkBestPractices(cleanText, noStringsText, doc, firstTypeByVar) {
    return [
        ...checkArray(cleanText, noStringsText, doc, firstTypeByVar),
        ...checkBmql(cleanText, noStringsText, doc),
        ...checkDate(cleanText, noStringsText, doc),
        ...checkDictionary(cleanText, noStringsText, doc),
        ...checkJson(cleanText, noStringsText, doc),
        ...checkMath(cleanText, noStringsText, doc),
        ...checkOthers(cleanText, noStringsText, doc),
        ...checkString(cleanText, noStringsText, doc),
        ...checkUrlAccess(cleanText, noStringsText, doc),
        ...checkXml(cleanText, noStringsText, doc),

        ...checkBmqlSafety(cleanText, noStringsText, doc),
        ...checkCodeQuality(cleanText, noStringsText, doc),
        ...checkCommercePractices(cleanText, noStringsText, doc),
        ...checkDataSafety(cleanText, noStringsText, doc),
        ...checkSecurity(cleanText, noStringsText, doc),
        ...checkSyntaxRules(cleanText, noStringsText, doc),
        ...checkSelfReference(cleanText, noStringsText, doc),
    ];
}

module.exports = { checkBestPractices };
