const assert = require('assert');
const { BmqlConsolePanel } = require('../../app/lang/bmql/bmqlConsolePanel');

suite('BMQL Live Console - Unit Tests', () => {
  test('substitutes string parameters with escaped single quotes', () => {
    const query = 'SELECT part_number FROM Pricing WHERE currency = $curr AND note = $note';
    const params = [
      { name: 'curr', type: 'String', value: 'USD' },
      { name: 'note', type: 'String', value: "John's Deal" }
    ];

    const result = BmqlConsolePanel.substituteParameters(query, params);
    assert.strictEqual(
      result,
      "SELECT part_number FROM Pricing WHERE currency = 'USD' AND note = 'John''s Deal'"
    );
  });

  test('substitutes boolean parameters as true / false literals', () => {
    const query = 'SELECT item FROM Parts WHERE active = $active';
    const params = [{ name: 'active', type: 'Boolean', value: 'True' }];

    const result = BmqlConsolePanel.substituteParameters(query, params);
    assert.strictEqual(result, 'SELECT item FROM Parts WHERE active = true');
  });

  test('parses projected column names accurately from SELECT clause', () => {
    const query = 'SELECT p.part_num, price, description as desc_text FROM Parts';
    const cols = BmqlConsolePanel.parseColumns(query);

    assert.deepStrictEqual(cols, ['part_num', 'price', 'desc_text']);
  });

  test('parses target data table name accurately from FROM clause', () => {
    const query = 'SELECT id FROM CPQ_Custom_Pricing WHERE discount > 10';
    const table = BmqlConsolePanel.parseTableName(query);

    assert.strictEqual(table, 'CPQ_Custom_Pricing');
  });

  test('handles queries with no parameters without modification', () => {
    const query = 'SELECT id, name FROM Users';
    const result = BmqlConsolePanel.substituteParameters(query, []);
    assert.strictEqual(result, query);
  });
});
