const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  findBmqlQueryAtPosition,
  parseBmqlCursorContext,
  resolveAvailableTables,
  getRecordFieldCompletions,
  getBmqlIntelligentCompletions
} = require('@/lang/bmql/bmqlIntellisense');

suite('BMQL Intelligent Query Autocomplete - Unit Tests', () => {
  const mockVscode = {
    CompletionItem: function (label, kind) {
      this.label = label;
      this.kind = kind;
    },
    CompletionItemKind: {
      Class: 7,
      Field: 5,
      Operator: 24,
      Variable: 6,
      Keyword: 14,
      Value: 12
    },
    MarkdownString: function (val) {
      this.value = val;
    }
  };

  test('findBmqlQueryAtPosition extracts single-line query and cursor offset', () => {
    const line = 'records = bmql("SELECT part_num FROM Pricing WHERE price > 100");';
    const document = {
      lineAt: () => ({ text: line }),
      languageId: 'bml'
    };

    // Cursor right after "FROM " (position: character 37)
    // "SELECT part_num FROM " length is 21 inside quotes. Quote begins at 16.
    const pos = { line: 0, character: 37 };
    const queryInfo = findBmqlQueryAtPosition(document, pos);

    assert.ok(queryInfo, 'Expected queryInfo to be returned');
    assert.strictEqual(queryInfo.queryText, 'SELECT part_num FROM Pricing WHERE price > 100');
    assert.strictEqual(queryInfo.cursorOffset, 37 - 16);
  });

  test('findBmqlQueryAtPosition returns null when cursor is outside bmql call', () => {
    const line = 'x = 10; print(x);';
    const document = {
      lineAt: () => ({ text: line }),
      languageId: 'bml'
    };
    const queryInfo = findBmqlQueryAtPosition(document, { line: 0, character: 4 });
    assert.strictEqual(queryInfo, null);
  });

  test('parseBmqlCursorContext detects TABLE context after FROM', () => {
    const query = 'SELECT id, price FROM ';
    const context = parseBmqlCursorContext(query, query.length);

    assert.strictEqual(context.type, 'TABLE');
  });

  test('parseBmqlCursorContext detects TABLE context after MODIFY', () => {
    const query = 'MODIFY ';
    const context = parseBmqlCursorContext(query, query.length);

    assert.strictEqual(context.type, 'TABLE');
  });

  test('parseBmqlCursorContext detects COLUMN context in SELECT with existing FROM table', () => {
    const query = 'SELECT  FROM Pricing_Table WHERE active == true';
    // Cursor right after "SELECT "
    const context = parseBmqlCursorContext(query, 7);

    assert.strictEqual(context.type, 'COLUMN');
    assert.strictEqual(context.tableName, 'Pricing_Table');
  });

  test('parseBmqlCursorContext detects OPERATOR context in WHERE clause', () => {
    const query = 'SELECT id FROM Parts WHERE status ';
    const context = parseBmqlCursorContext(query, query.length);

    assert.strictEqual(context.type, 'OPERATOR');
    assert.strictEqual(context.tableName, 'Parts');
  });

  test('parseBmqlCursorContext detects SUBSTITUTION context after $', () => {
    const query = 'SELECT id FROM Parts WHERE status == $';
    const context = parseBmqlCursorContext(query, query.length);

    assert.strictEqual(context.type, 'SUBSTITUTION');
  });

  test('parseBmqlCursorContext detects ORDER_BY context and direction', () => {
    const query = 'SELECT id FROM Parts ORDER BY ';
    const context = parseBmqlCursorContext(query, query.length);
    assert.strictEqual(context.type, 'ORDER_BY');

    const queryWithCol = 'SELECT id FROM Parts ORDER BY price ';
    const dirContext = parseBmqlCursorContext(queryWithCol, queryWithCol.length);
    assert.strictEqual(dirContext.type, 'ORDER_DIRECTION');
  });

  test('resolveAvailableTables scans temporary .dt.json schema', () => {
    const tmpDir = path.join(__dirname, '..', '..', '.tmp_bmql_test_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });

    const dtFile = path.join(tmpDir, 'Vehicle_Parts.dt.json');
    fs.writeFileSync(dtFile, JSON.stringify({
      name: 'Vehicle Parts',
      columns: [
        { name: 'part_id', type: 'Integer', isPrimaryKey: true },
        { name: 'part_name', type: 'String' },
        { name: 'price', type: 'Float' }
      ]
    }));

    try {
      const tables = resolveAvailableTables(tmpDir);
      assert.ok(tables.has('vehicle_parts'));
      const table = tables.get('vehicle_parts');
      assert.strictEqual(table.name, 'Vehicle_Parts');
      assert.strictEqual(table.columns.length, 3);
      assert.strictEqual(table.columns[0].isPrimaryKey, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('getBmqlIntelligentCompletions provides table completions after FROM', () => {
    const tmpDir = path.join(__dirname, '..', '..', '.tmp_bmql_tables_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'Custom_Pricing.dt.json'), JSON.stringify({
      name: 'Custom_Pricing',
      columns: [{ name: 'rule_id', type: 'String', isPrimaryKey: true }]
    }));

    try {
      const line = 'records = bmql("SELECT id FROM ");';
      const document = {
        lineAt: () => ({ text: line }),
        languageId: 'bml'
      };
      // Cursor after "FROM " (char 31)
      const pos = { line: 0, character: 31 };
      const completions = getBmqlIntelligentCompletions(document, pos, tmpDir, mockVscode);

      assert.ok(completions.length > 0);
      assert.ok(completions.some(c => c.label === 'Custom_Pricing'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('getBmqlIntelligentCompletions provides column completions with PK badges', () => {
    const tmpDir = path.join(__dirname, '..', '..', '.tmp_bmql_cols_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'Inventory.dt.json'), JSON.stringify({
      name: 'Inventory',
      columns: [
        { name: 'sku', type: 'String', isPrimaryKey: true },
        { name: 'stock_qty', type: 'Integer' }
      ]
    }));

    try {
      const line = 'records = bmql("SELECT  FROM Inventory");';
      const document = {
        lineAt: () => ({ text: line }),
        languageId: 'bml'
      };
      // Cursor after "SELECT " (char 23)
      const pos = { line: 0, character: 23 };
      const completions = getBmqlIntelligentCompletions(document, pos, tmpDir, mockVscode);

      assert.ok(completions.length >= 2);
      const skuItem = completions.find(c => c.label === 'sku');
      assert.ok(skuItem);
      assert.ok(skuItem.detail.includes('[PK]'));
      assert.strictEqual(skuItem.sortText, '0_sku');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('getBmqlIntelligentCompletions provides operators in WHERE clause', () => {
    const line = 'res = bmql("SELECT sku FROM Inventory WHERE sku ");';
    const document = {
      lineAt: () => ({ text: line }),
      languageId: 'bml'
    };
    // Cursor after "sku " (char 48)
    const pos = { line: 0, character: 48 };
    const completions = getBmqlIntelligentCompletions(document, pos, null, mockVscode);

    assert.ok(completions.some(c => c.label === '=='));
    assert.ok(completions.some(c => c.label === 'LIKE'));
    assert.ok(completions.some(c => c.label === 'IN'));
  });

  test('getRecordFieldCompletions provides projected columns for get(rec, "")', () => {
    const code = [
      'records = bmql("SELECT sku, price FROM Inventory WHERE active == true");',
      'for rec in records {',
      '    p = get(rec, "");',
      '}'
    ].join('\n');

    const document = {
      lineAt: (l) => ({ text: code.split('\n')[l] }),
      getText: () => code,
      languageId: 'bml'
    };

    // Cursor inside get(rec, "")
    const pos = { line: 2, character: 18 };
    const completions = getRecordFieldCompletions(document, pos, new Map(), mockVscode);

    assert.ok(completions.length >= 2);
    assert.ok(completions.some(c => c.label === 'sku'));
    assert.ok(completions.some(c => c.label === 'price'));
  });
});
