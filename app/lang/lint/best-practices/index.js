const { checkDeprecatedApi } = require('./deprecatedApi');
const { checkBmqlSafety } = require('./bmqlSafety');
const { checkCodeQuality } = require('./codeQuality');
const { checkCommercePractices } = require('./commercePractices');
const { checkDataSafety } = require('./dataSafety');
const { checkSecurity } = require('./security');
const { checkSyntaxRules } = require('./syntaxRules');

/**
 * Runs every best-practice sub-check and combines their diagnostics.
 * Each sub-check lives in its own file, grouped by concern - see the doc
 * comment at the top of each for its codes.
 */
function checkBestPractices(cleanText, noStringsText, doc) {
    return [
        ...checkDeprecatedApi(cleanText, noStringsText, doc),
        ...checkBmqlSafety(cleanText, noStringsText, doc),
        ...checkCodeQuality(cleanText, noStringsText, doc),
        ...checkCommercePractices(cleanText, noStringsText, doc),
        ...checkDataSafety(cleanText, noStringsText, doc),
        ...checkSecurity(cleanText, noStringsText, doc),
        ...checkSyntaxRules(cleanText, noStringsText, doc),
    ];
}

module.exports = { checkBestPractices };
