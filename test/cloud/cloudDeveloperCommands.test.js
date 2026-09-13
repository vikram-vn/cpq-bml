const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  insertOrCopyAttributeCommand,
  copyVariableNameCommand,
  copyTableNameCommand,
  generateBmqlQueryCommand,
  openActionBmlCommand,
  openRuleBmlCommand,
  createTestFixtureCommand,
} = require('@/lang/cloud/cloudExplorerCommands');

suite('Cloud Explorer Developer Commands', () => {
  test('insertOrCopyAttributeCommand extracts variable name and delegates to insertTextAtActiveCursor', async () => {
    let inserted = '';
    const mockVscode = {
      window: {
        activeTextEditor: {
          document: {},
          selection: { isEmpty: true, active: {} },
          edit: async (cb) => {
            cb({ insert: (_p, t) => { inserted = t; } });
          },
        },
        setStatusBarMessage: () => {},
      },
      env: { clipboard: { writeText: () => {} } },
    };

    await insertOrCopyAttributeCommand({ data: { variableName: 'custom_discount_percent' } }, mockVscode);
    assert.strictEqual(inserted, 'custom_discount_percent');
  });

  test('copyVariableNameCommand and copyTableNameCommand copy values to clipboard', async () => {
    let copiedVar = '';
    let copiedTable = '';
    const mockVscode = {
      window: { showInformationMessage: () => {} },
      env: {
        clipboard: {
          writeText: async (t) => {
            if (t.startsWith('var_')) copiedVar = t;
            else copiedTable = t;
          },
        },
      },
    };

    await copyVariableNameCommand({ data: { variableName: 'var_price' } }, mockVscode);
    await copyTableNameCommand({ data: { name: 'parts_pricing' } }, mockVscode);

    assert.strictEqual(copiedVar, 'var_price');
    assert.strictEqual(copiedTable, 'parts_pricing');
  });

  test('generateBmqlQueryCommand generates and inserts BMQL query at cursor', async () => {
    let insertedQuery = '';
    const mockVscode = {
      window: {
        activeTextEditor: {
          document: {},
          selection: { isEmpty: true, active: {} },
          edit: async (cb) => {
            cb({ insert: (_p, t) => { insertedQuery = t; } });
          },
        },
        setStatusBarMessage: () => {},
      },
      env: { clipboard: { writeText: () => {} } },
    };

    const tableItem = {
      data: {
        name: 'shipping_rates',
        columns: [
          { name: 'zone_code', type: 'String', isPrimaryKey: true },
          { name: 'rate', type: 'Float' },
        ],
      },
    };

    await generateBmqlQueryCommand(tableItem, mockVscode);
    assert.ok(insertedQuery.includes('SELECT zone_code, rate FROM shipping_rates'));
    assert.ok(insertedQuery.includes('WHERE zone_code = $zone_code_param'));
  });

  test('openActionBmlCommand extracts embedded BML script and saves to cpq/commerce/process/actions', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-cmd-test-'));
    let openedUri = null;

    const mockVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        openTextDocument: async (uri) => {
          openedUri = uri;
          return { uri };
        },
      },
      window: {
        withProgress: async (_opts, task) => task(),
        showTextDocument: async () => {},
        showInformationMessage: () => {},
        showErrorMessage: () => {},
      },
    };

    const actionItem = {
      data: {
        variableName: 'cleanSave',
        commerceProcess: 'oraclecpqo',
        commerceDocument: 'transaction',
        scriptText: 'print("Running clean save BML script");\nreturn "";\n',
      },
    };

    await openActionBmlCommand(actionItem, mockVscode, {});

    const expectedPath = path.join(tempDir, 'cpq', 'commerce', 'oraclecpqo', 'actions', 'cleanSave.bml');
    assert.ok(fs.existsSync(expectedPath));
    const content = fs.readFileSync(expectedPath, 'utf8');
    assert.ok(content.includes('Running clean save BML script'));
    assert.strictEqual(openedUri.fsPath.toLowerCase(), expectedPath.toLowerCase());

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('createTestFixtureCommand captures transaction JSON and generates runnable test harness', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-fixture-test-'));

    const mockVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        openTextDocument: async (uri) => ({ uri }),
      },
      window: {
        withProgress: async (_opts, task) => task(),
        showTextDocument: async () => {},
        showInformationMessage: async () => 'Open Fixture JSON',
        showErrorMessage: () => {},
      },
    };

    const txItem = {
      data: {
        _id: '12345',
        transactionID_t: 'CPQ-TX-12345',
        status_t: 'Approved',
        customer_t: 'Acme Corp',
        totalAmount_t: 50000,
      },
    };

    await createTestFixtureCommand(txItem, mockVscode, {});

    const fixtureJson = path.join(tempDir, 'test', 'fixtures', 'transaction_12345.json');
    const testHarness = path.join(tempDir, 'test', 'fixtures', 'transaction_12345.test.bml');

    assert.ok(fs.existsSync(fixtureJson), 'Fixture JSON should exist');
    assert.ok(fs.existsSync(testHarness), 'Test harness BML should exist');

    const jsonContent = JSON.parse(fs.readFileSync(fixtureJson, 'utf8'));
    assert.strictEqual(jsonContent.transactionID_t, 'CPQ-TX-12345');
    assert.strictEqual(jsonContent.customer_t, 'Acme Corp');

    const harnessContent = fs.readFileSync(testHarness, 'utf8');
    assert.ok(harnessContent.includes('transactionId = "12345"'));
    assert.ok(harnessContent.includes('status = "Approved"'));

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
