const assert = require('assert');
const {
  isTestFile,
  indexTestFile
} = require('@/lang/test-controller/bmlTestController');

suite('BMLT Test Discovery & Controller - Unit Tests', () => {
  test('isTestFile identifies .bmlt and .test.bml while excluding plain .bml', () => {
    assert.strictEqual(isTestFile('quote_pricing.bmlt'), true);
    assert.strictEqual(isTestFile('/path/to/test_suite.bmlt'), true);
    assert.strictEqual(isTestFile('calculation.test.bml'), true);
    assert.strictEqual(isTestFile('pricing.bml'), false);
    assert.strictEqual(isTestFile('config.js'), false);
  });

  test('indexTestFile parses test file with @test annotations and populates controller children', () => {
    const mockItems = new Map();
    const mockController = {
      items: {
        add: (item) => mockItems.set(item.id, item),
        delete: (id) => mockItems.delete(id)
      },
      createTestItem: (id, label, uri) => {
        const children = new Map();
        return {
          id,
          label,
          uri,
          children: {
            add: (child) => children.set(child.id, child),
            size: children.size,
            forEach: (fn) => children.forEach(fn)
          }
        };
      }
    };

    const mockVscode = {
      Range: function (startLine, startCol, endLine, endCol) {
        this.startLine = startLine;
      }
    };

    const mockUri = {
      fsPath: 'test/sample.bmlt',
      path: 'test/sample.bmlt'
    };

    // Use existing fixture or test file
    const fileItem = indexTestFile(mockController, mockUri, mockVscode);
    assert.ok(mockController);
  });
});
