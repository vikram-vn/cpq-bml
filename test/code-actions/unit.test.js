/**
 * BML Quick Fixes Test Suite Runner.
 * Suites have been modularly split into focused test files (< 400 lines each):
 * - memberAccess.test.js
 * - signaturesAndTypes.test.js
 * - performanceSbappend.test.js
 * - coreBuiltins.test.js
 * - functionsComprehensive.test.js
 * - securityAndBmqlFixes.test.js
 * - syntaxAndQualityRemaining.test.js
 */

require('@/test/code-actions/memberAccessUnit.test');
require('@/test/code-actions/signaturesAndTypes.test');
require('@/test/code-actions/performanceSbappend.test');
require('@/test/code-actions/coreBuiltins.test');
require('@/test/code-actions/functionsComprehensive.test');
require('@/test/code-actions/securityAndBmqlFixes.test');
require('@/test/code-actions/syntaxAndQualityRemaining.test');
