const assert = require('assert');
const { AttributeDependencyGraph } = require('../../app/lang/graph/attributeDependencyGraph');

suite('Commerce Execution Pipeline & Attribute Graph - Unit Tests', () => {
  test('categorizes execution phase based on path and annotations', () => {
    assert.strictEqual(
      AttributeDependencyGraph.categorizePhase('rules/validation/validate_discount.bml', 'return "";'),
      'VALIDATION'
    );
    assert.strictEqual(
      AttributeDependencyGraph.categorizePhase('rules/hiding/hide_margin.bml', 'return true;'),
      'HIDING'
    );
    assert.strictEqual(
      AttributeDependencyGraph.categorizePhase('rules/constraint/limit_parts.bml', ''),
      'CONSTRAINT'
    );
    assert.strictEqual(
      AttributeDependencyGraph.categorizePhase('actions/submit_quote.bml', ''),
      'SUBMITTAL'
    );
    assert.strictEqual(
      AttributeDependencyGraph.categorizePhase('formulas/pricing_calc.bml', ''),
      'PRICING'
    );
  });

  test('extracts attribute reads from direct, dictionary, and commerce object patterns', () => {
    const code = `
      val = discount_percent_t;
      flag = get(params, "is_approved_l");
      curr = commerce.currency_code;
    `;
    const reads = AttributeDependencyGraph.extractAttributeReads(code);

    assert.ok(reads.includes('discount_percent_t'));
    assert.ok(reads.includes('is_approved_l'));
    assert.ok(reads.includes('currency_code'));
  });

  test('extracts attribute writes from put() and assignment patterns', () => {
    const code = `
      put(resultDict, "final_price_t", 450.0);
      status_t = "APPROVED";
    `;
    const writes = AttributeDependencyGraph.extractAttributeWrites(code);

    assert.ok(writes.includes('final_price_t'));
    assert.ok(writes.includes('status_t'));
  });

  test('detects circular dependency loops between rules', () => {
    const graph = new AttributeDependencyGraph('/fake');

    // Rule 1: Writes attr_a_t, Reads attr_b_t
    graph.analyzeCode('Rule_1', 'put(d, "attr_a_t", 1); x = attr_b_t;', 'Rule_1.bml');

    // Rule 2: Writes attr_b_t, Reads attr_a_t -> Cyclic loop with Rule 1!
    graph.analyzeCode('Rule_2', 'put(d, "attr_b_t", 2); y = attr_a_t;', 'Rule_2.bml');

    const cycles = graph.detectCycles();
    assert.strictEqual(cycles.length, 1);
    assert.ok(cycles[0].includes('Rule_1'));
    assert.ok(cycles[0].includes('Rule_2'));
  });

  test('generates valid graph model structure with statistics', () => {
    const graph = new AttributeDependencyGraph('/fake');
    graph.analyzeCode('PricingRule', 'put(d, "line_total_t", 100);', 'PricingRule.bml');

    const model = graph.toGraphModel();
    assert.strictEqual(model.stats.rulesCount, 1);
    assert.strictEqual(model.stats.attributesCount, 1);
    assert.strictEqual(model.stats.totalEdges, 1);
    assert.strictEqual(model.stats.cyclesCount, 0);
  });
});
