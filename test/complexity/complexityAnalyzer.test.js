const assert = require('assert');
const { ComplexityAnalyzer } = require('../../app/lang/complexity/complexityAnalyzer');

suite('BML Cyclomatic Complexity & Debt Analyzer - Unit Tests', () => {
  test('calculates base cyclomatic complexity with conditional branches', () => {
    const code = `
      res = 0;
      if (price > 100 AND is_valid) {
        res = 1;
      } elif (price > 50 OR is_discount) {
        res = 2;
      } else {
        res = 3;
      }
    `;

    // Base = 1, if (+1), AND (+1), elif (+1), OR (+1) -> Complexity = 5
    const metrics = ComplexityAnalyzer.calculateMetrics(code, 'pricing.bml');
    assert.strictEqual(metrics.complexity, 5);
    assert.strictEqual(metrics.risk, 'LOW');
  });

  test('tracks maximal nesting depth accurately', () => {
    const code = `
      for (item in items) {
        if (item.active) {
          for (part in item.parts) {
            if (part.available) {
              total = total + 1;
            }
          }
        }
      }
    `;

    // 4 nested levels of braces
    const metrics = ComplexityAnalyzer.calculateMetrics(code, 'deep_loops.bml');
    assert.strictEqual(metrics.nestingDepth, 4);
    assert.strictEqual(metrics.risk, 'HIGH'); // Nesting > 3 triggers HIGH risk
  });

  test('flags timeout threat when BMQL query is inside a loop', () => {
    const code = `
      for (id in part_ids) {
        records = bmql("SELECT price FROM Pricing WHERE part_id = $id");
      }
    `;

    const metrics = ComplexityAnalyzer.calculateMetrics(code, 'slow_loop.bml');
    assert.strictEqual(metrics.timeoutThreat, true);
    assert.strictEqual(metrics.risk, 'HIGH');
  });

  test('computes maintainability index between 0 and 100', () => {
    const cleanCode = 'total = 100.0; return total;';
    const cleanMetrics = ComplexityAnalyzer.calculateMetrics(cleanCode, 'simple.bml');
    assert.ok(cleanMetrics.maintainabilityIndex >= 80);

    const complexCode = `
      if (a AND b) { if (c OR d) { if (e) { if (f) { res = 1; } } } }
    `;
    const complexMetrics = ComplexityAnalyzer.calculateMetrics(complexCode, 'complex.bml');
    assert.ok(complexMetrics.maintainabilityIndex < cleanMetrics.maintainabilityIndex);
  });

  test('aggregates workspace dashboard data correctly', () => {
    const analyzer = new ComplexityAnalyzer('/fake');
    analyzer.results.push(
      { loc: 20, complexity: 2, nestingDepth: 1, maintainabilityIndex: 90, risk: 'LOW', hotspotScore: 10, timeoutThreat: false },
      { loc: 50, complexity: 16, nestingDepth: 4, maintainabilityIndex: 45, risk: 'HIGH', hotspotScore: 150, timeoutThreat: true }
    );

    const data = analyzer.getDashboardData();
    assert.strictEqual(data.totalFiles, 2);
    assert.strictEqual(data.totalLoc, 70);
    assert.strictEqual(data.avgComplexity, 9);
    assert.strictEqual(data.riskDistribution.high, 1);
    assert.strictEqual(data.riskDistribution.low, 1);
    assert.strictEqual(data.files[0].risk, 'HIGH'); // Sorted by hotspot score descending
  });
});
