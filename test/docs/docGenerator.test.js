const assert = require('assert');
const { DocSiteGenerator } = require('../../app/lang/docs/docSiteGenerator');

suite('Documentation Site Generator - Unit Tests', () => {
  test('parses BML docblock with parameters, return type, and example', () => {
    const docComment = `
      Calculate net total after discount
      @param {Float} basePrice Initial price
      @param {Integer} qty Number of units
      @return {Float} Calculated net line total
      @example calculateNet(100.0, 5)
    `;

    const parsed = DocSiteGenerator.parseDocBlock(docComment);
    assert.strictEqual(parsed.description, 'Calculate net total after discount');
    assert.strictEqual(parsed.params.length, 2);
    assert.strictEqual(parsed.params[0].name, 'basePrice');
    assert.strictEqual(parsed.params[0].type, 'Float');
    assert.strictEqual(parsed.returns.type, 'Float');
    assert.strictEqual(parsed.example, 'calculateNet(100.0, 5)');
  });

  test('parses BML function signature properly', () => {
    const code = `
      // Header comment
      Float calculateNet(Float basePrice, Integer qty) {
        return basePrice * qty;
      }
    `;

    const sig = DocSiteGenerator.parseFunctionSignature(code);
    assert.ok(sig !== null);
    assert.strictEqual(sig.name, 'calculateNet');
    assert.strictEqual(sig.returnType, 'Float');
    assert.strictEqual(sig.params.length, 2);
    assert.strictEqual(sig.params[0].name, 'basePrice');
    assert.strictEqual(sig.params[1].name, 'qty');
  });

  test('generates HTML with searchable data structure', () => {
    const generator = new DocSiteGenerator('/fake');
    generator.functions.push({
      name: 'testFunc',
      category: 'util',
      relPath: 'util/testFunc.bml',
      returnType: 'String',
      params: [{ name: 'arg1', type: 'String', desc: 'test arg' }],
      description: 'Test description',
      example: 'testFunc("hello")',
      hasDoc: true
    });

    const html = generator.generateHtml();
    assert.ok(html.includes('CPQ BML Workspace Documentation'));
    assert.ok(html.includes('testFunc'));
    assert.ok(html.includes('util/testFunc.bml'));
  });

  test('generates Markdown API reference with tables and signatures', () => {
    const generator = new DocSiteGenerator('/fake');
    generator.functions.push({
      name: 'formatCurrency',
      category: 'util',
      relPath: 'util/formatCurrency.bml',
      returnType: 'String',
      params: [{ name: 'amount', type: 'Float', desc: 'Amount to format' }],
      description: 'Formats floating point as currency',
      example: 'formatCurrency(19.99)',
      hasDoc: true
    });

    const md = generator.generateMarkdown();
    assert.ok(md.includes('# CPQ BML Workspace API Reference'));
    assert.ok(md.includes('formatCurrency'));
    assert.ok(md.includes('`String formatCurrency(Float amount)`'));
  });
});
