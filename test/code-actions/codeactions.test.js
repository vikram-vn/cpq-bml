const { runSyntaxCodeActionTests } = require('@/test/code-actions/syntax.test');
const { runQualityCodeActionTests } = require('@/test/code-actions/quality.test');
const { runPerformanceCodeActionTests } = require('@/test/code-actions/performance.test');
const { runBmqlCodeActionTests } = require('@/test/code-actions/bmql.test');
const { runApiCodeActionTests } = require('@/test/code-actions/api.test');
const { runUnreachableCodeActionTests } = require('@/test/code-actions/unreachable.test');
const { runStyleCodeActionTests } = require('@/test/code-actions/style.test');
const { runSuppressionCodeActionTests } = require('@/test/code-actions/suppression.test');

suite('BML Code Actions Quick Fix Master Suite', () => {
    runSyntaxCodeActionTests();
    runQualityCodeActionTests();
    runPerformanceCodeActionTests();
    runBmqlCodeActionTests();
    runApiCodeActionTests();
    runUnreachableCodeActionTests();
    runStyleCodeActionTests();
    runSuppressionCodeActionTests();
});
