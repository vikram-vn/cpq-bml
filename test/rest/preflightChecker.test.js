const assert = require('assert');
const path = require('path');
const {
  checkComplexityAndThreats,
  analyzeWorkspaceImpact,
  formatPreflightSummary
} = require('@/lang/rest/preflightChecker');

suite('Pre-Flight Safety Checker & Impact Analysis - Unit Tests', () => {
  test('checkComplexityAndThreats flags timeout threat when BMQL is in a loop', () => {
    const dangerousCode = `
      for item in lineItems {
        res = bmql("SELECT price FROM Pricing WHERE part = $item");
      }
    `;

    const result = checkComplexityAndThreats(dangerousCode);
    assert.strictEqual(result.passed, false);
    assert.ok(result.warnings.some(w => w.includes('CRITICAL: Detected BMQL query executed inside a loop')));
  });

  test('checkComplexityAndThreats passes on clean modular BML code', () => {
    const cleanCode = `
      // Clean function
      res = bmql("SELECT price, part FROM Pricing");
      dict = dict("string");
      for r in res {
        put(dict, get(r, "part"), get(r, "price"));
      }
      return dict;
    `;

    const result = checkComplexityAndThreats(cleanCode);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.metrics.timeoutThreat, false);
    assert.ok(result.metrics.maintainabilityIndex > 50);
  });

  test('analyzeWorkspaceImpact searches for caller references across workspace', () => {
    const wsRoot = path.join(__dirname, '..', '..');
    const impact = analyzeWorkspaceImpact('atoisafe', wsRoot);

    assert.strictEqual(typeof impact.callersCount, 'number');
    assert.ok(Array.isArray(impact.callers));
  });

  test('formatPreflightSummary generates readable multi-stage audit report', () => {
    const mockReport = {
      functionName: 'calculateTax',
      server: { passed: true, message: 'Syntax verified on CPQ Cloud (120ms).' },
      complexity: {
        passed: true,
        metrics: { cyclomaticComplexity: 4, maintainabilityIndex: 82.5 }
      },
      impact: {
        callersCount: 2,
        callers: [
          { file: 'commerce/pricingRule.bml', line: 15 },
          { file: 'library/util/taxHelper.bml', line: 42 }
        ]
      },
      warnings: ['Maintainability is good']
    };

    const summary = formatPreflightSummary(mockReport);
    assert.ok(summary.includes('Pre-Flight Safety Report: calculateTax'));
    assert.ok(summary.includes('Server Validation: PASSED [OK]'));
    assert.ok(summary.includes('Complexity & Maintainability: HEALTHY'));
    assert.ok(summary.includes('Referenced in 2 other file(s)'));
    assert.ok(summary.includes('commerce/pricingRule.bml (Line 15)'));
  });
});
