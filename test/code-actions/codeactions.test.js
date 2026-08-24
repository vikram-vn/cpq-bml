const { runSyntaxCodeActionTests } = require('./syntax.test');
const { runQualityCodeActionTests } = require('./quality.test');
const { runPerformanceCodeActionTests } = require('./performance.test');
const { runBmqlCodeActionTests } = require('./bmql.test');
const { runApiCodeActionTests } = require('./api.test');
const { runUnreachableCodeActionTests } = require('./unreachable.test');
const { runStyleCodeActionTests } = require('./style.test');
const { runSuppressionCodeActionTests } = require('./suppression.test');

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
