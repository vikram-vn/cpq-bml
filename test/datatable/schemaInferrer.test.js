const assert = require('assert');
const { SchemaInferrer } = require('../../app/lang/datatable/schemaInferrer');

suite('Data Table CSV Schema Inferrer - Unit Tests', () => {
  test('parses CSV supporting quotes and embedded commas', () => {
    const csv = [
      'part_number,description,price',
      'SKU-100,"Standard Widget, Blue",19.99',
      'SKU-200,"Heavy Duty ""Pro"" Edition",49.50'
    ].join('\n');

    const rows = SchemaInferrer.parseCsv(csv);
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows[1][1], 'Standard Widget, Blue');
    assert.strictEqual(rows[2][1], 'Heavy Duty "Pro" Edition');
  });

  test('sanitizes column headers into valid CPQ variable identifiers', () => {
    assert.strictEqual(SchemaInferrer.sanitizeColumnName('Part Number #', 0), 'Part_Number');
    assert.strictEqual(SchemaInferrer.sanitizeColumnName('Unit Price ($)', 1), 'Unit_Price');
    assert.strictEqual(SchemaInferrer.sanitizeColumnName('1st_Choice', 2), 'col_1st_Choice');
    assert.strictEqual(SchemaInferrer.sanitizeColumnName('', 3), 'col_4');
  });

  test('infers Integer, Float, Boolean, Date, and String types accurately', () => {
    assert.strictEqual(SchemaInferrer.inferColumnType(['10', '20', '300']), 'Integer');
    assert.strictEqual(SchemaInferrer.inferColumnType(['10.5', '20.0', '99.95']), 'Float');
    assert.strictEqual(SchemaInferrer.inferColumnType(['true', 'false', 'TRUE']), 'Boolean');
    assert.strictEqual(SchemaInferrer.inferColumnType(['2026-09-10', '2026-10-15']), 'Date');
    assert.strictEqual(SchemaInferrer.inferColumnType(['Widget A', 'Widget B']), 'String');
  });

  test('infers full .dt.json schema and typed records from CSV', () => {
    const csv = [
      'part_id,price,in_stock,release_date',
      'P-01,99.50,true,2026-01-15',
      'P-02,149.00,false,2026-02-20'
    ].join('\n');

    const schema = SchemaInferrer.inferFromCsv(csv, 'Product_Catalog');

    assert.strictEqual(schema.name, 'Product_Catalog');
    assert.strictEqual(schema.columns.length, 4);

    assert.strictEqual(schema.columns[0].name, 'part_id');
    assert.strictEqual(schema.columns[0].type, 'String');
    assert.strictEqual(schema.columns[0].isKey, true); // Detected as primary key candidate

    assert.strictEqual(schema.columns[1].name, 'price');
    assert.strictEqual(schema.columns[1].type, 'Float');

    assert.strictEqual(schema.columns[2].name, 'in_stock');
    assert.strictEqual(schema.columns[2].type, 'Boolean');

    assert.strictEqual(schema.columns[3].name, 'release_date');
    assert.strictEqual(schema.columns[3].type, 'Date');

    assert.strictEqual(schema.records.length, 2);
    assert.strictEqual(schema.records[0].price, 99.5);
    assert.strictEqual(schema.records[0].in_stock, true);
    assert.strictEqual(schema.records[1].in_stock, false);
  });
});
