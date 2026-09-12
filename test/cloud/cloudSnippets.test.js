const assert = require('assert');
const {
  insertTextAtActiveCursor,
  generateBmqlQuerySnippet,
  generateAttributeSnippet,
} = require('@/lang/cloud/cloudSnippets');

suite('Cloud Explorer Developer Snippets', () => {
  test('generateBmqlQuerySnippet builds type-safe query with primary key and loop', () => {
    const columns = [
      { name: 'part_id', type: 'Integer', isPrimaryKey: true },
      { name: 'part_number', type: 'String' },
      { name: 'unit_price', type: 'Float' },
    ];

    const snippet = generateBmqlQuerySnippet('parts_catalog', columns);
    assert.ok(snippet.includes('SELECT part_id, part_number, unit_price FROM parts_catalog'));
    assert.ok(snippet.includes('WHERE part_id = $part_id_param'));
    assert.ok(snippet.includes('for row in results {'));
    assert.ok(snippet.includes('Integer part_idVal = get(row, "part_id");'));
    assert.ok(snippet.includes('String part_numberVal = get(row, "part_number");'));
  });

  test('generateBmqlQuerySnippet falls back gracefully when columns are empty', () => {
    const snippet = generateBmqlQuerySnippet('simple_table', []);
    assert.ok(snippet.includes('SELECT * FROM simple_table WHERE id = $id_param'));
    assert.ok(snippet.includes('for row in results {'));
  });

  test('generateAttributeSnippet produces domain-specific CPQ syntax', () => {
    assert.strictEqual(
      generateAttributeSnippet({ variableName: 'ram_size' }, 'config'),
      'getconfigattr("ram_size")'
    );
    assert.strictEqual(
      generateAttributeSnippet({ variableName: 'price_each' }, 'line'),
      'docNum + "|price_each|" + price_eachVal + "|"'
    );
    assert.strictEqual(
      generateAttributeSnippet({ variableName: 'quote_status' }, 'commerce'),
      'get(transaction, "quote_status")'
    );
  });

  test('insertTextAtActiveCursor inserts at selection when editor is active', async () => {
    let replacedText = '';
    let copiedText = '';
    let statusBarMsg = '';

    const mockEditor = {
      document: { uri: { fsPath: '/test/file.bml' } },
      selection: { isEmpty: true, active: { line: 0, character: 0 } },
      edit: async (cb) => {
        cb({
          insert: (_pos, text) => { replacedText = text; },
          replace: (_range, text) => { replacedText = text; },
        });
      },
    };

    const mockVscode = {
      window: {
        activeTextEditor: mockEditor,
        setStatusBarMessage: (msg) => { statusBarMsg = msg; },
      },
      env: {
        clipboard: {
          writeText: async (t) => { copiedText = t; },
        },
      },
    };

    await insertTextAtActiveCursor('_document_number', mockVscode);
    assert.strictEqual(replacedText, '_document_number');
    assert.strictEqual(copiedText, '_document_number');
    assert.ok(statusBarMsg.includes('_document_number'));
  });

  test('insertTextAtActiveCursor copies to clipboard and shows toast when no editor is open', async () => {
    let copiedText = '';
    let infoMsg = '';

    const mockVscode = {
      window: {
        activeTextEditor: null,
        showInformationMessage: (msg) => { infoMsg = msg; },
      },
      env: {
        clipboard: {
          writeText: async (t) => { copiedText = t; },
        },
      },
    };

    await insertTextAtActiveCursor('_customer_id', mockVscode);
    assert.strictEqual(copiedText, '_customer_id');
    assert.ok(infoMsg.includes('_customer_id'));
  });
});
