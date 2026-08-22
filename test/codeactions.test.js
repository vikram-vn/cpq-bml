const { runSyntaxCodeActionTests } = require('./code-actions/syntax.test');
const { runQualityCodeActionTests } = require('./code-actions/quality.test');
const { runPerformanceCodeActionTests } = require('./code-actions/performance.test');
const { runBmqlCodeActionTests } = require('./code-actions/bmql.test');
const { runApiCodeActionTests } = require('./code-actions/api.test');
const { runUnreachableCodeActionTests } = require('./code-actions/unreachable.test');
const { runStyleCodeActionTests } = require('./code-actions/style.test');
const { runSuppressionCodeActionTests } = require('./code-actions/suppression.test');

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
