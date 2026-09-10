const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const api = require('@/lang/rest/api');
const {
  createCloudDataTablesProvider,
  exportTableCsvCommand
} = require('@/lang/cloud/cloudDataTables');
const { createCloudMockVscode } = require('./cloudTestMocks');

suite('CPQ Cloud Data Tables - Unit Tests', () => {
  const mockVscode = createCloudMockVscode();

  test('createCloudDataTablesProvider initializes TreeDataProvider and formats table items', () => {
    const provider = createCloudDataTablesProvider(mockVscode, {});

    assert.strictEqual(typeof provider.getTreeItem, 'function');
    assert.strictEqual(typeof provider.getChildren, 'function');
    assert.strictEqual(typeof provider.refresh, 'function');

    const tableElement = {
      type: 'table',
      data: {
        name: 'PricingMatrix',
        label: 'Global Pricing Matrix',
        description: 'Pricing lookup table'
      }
    };

    const tableItem = provider.getTreeItem(tableElement);
    assert.strictEqual(tableItem.label, 'PricingMatrix');
    assert.strictEqual(tableItem.description, 'Global Pricing Matrix');
    assert.strictEqual(tableItem.collapsibleState, 1);
    assert.strictEqual(tableItem.iconPath.id, 'database');
    assert.strictEqual(tableItem.contextValue, 'cpqCloudDataTable');
  });

  test('formats column items with primary key key icon and standard symbol-field icon', () => {
    const provider = createCloudDataTablesProvider(mockVscode, {});

    const pkCol = {
      type: 'column',
      tableName: 'PricingMatrix',
      data: { name: 'matrix_id', type: 'Integer', isPrimaryKey: true }
    };
    const pkItem = provider.getTreeItem(pkCol);
    assert.strictEqual(pkItem.label, 'matrix_id [PK]');
    assert.strictEqual(pkItem.description, 'Integer');
    assert.strictEqual(pkItem.iconPath.id, 'key');

    const stdCol = {
      type: 'column',
      tableName: 'PricingMatrix',
      data: { name: 'list_price', type: 'Float', isPrimaryKey: false }
    };
    const stdItem = provider.getTreeItem(stdCol);
    assert.strictEqual(stdItem.label, 'list_price');
    assert.strictEqual(stdItem.description, 'Float');
    assert.strictEqual(stdItem.iconPath.id, 'symbol-field');
  });

  test('exportTableCsvCommand saves CSV under cpq/datatable folder', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-export-test-'));
    const origList = api.listDataTables;
    const origSchema = api.getDataTableSchema;
    const origGetRows = api.getDataTableRows;
    api.getDataTableRows = async () => ({
      statusCode: 200,
      body: {
        items: [
          { part_number: 'P100', qty: 50 },
          { part_number: 'P200', qty: 25 }
        ]
      }
    });

    let suggestedUri = null;
    const customVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        getConfiguration: () => ({ get: () => '' }),
        fs: {
          writeFile: async (uri, buffer) => {
            fs.writeFileSync(uri.fsPath, buffer);
          }
        }
      },
      window: {
        withProgress: async (opt, task) => task({ report: () => {} }),
        showInformationMessage: () => {},
        showErrorMessage: () => {},
        showSaveDialog: async (options) => {
          suggestedUri = options.defaultUri;
          return options.defaultUri;
        }
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
      }
    };

    try {
      const item = {
        data: { name: 'PartInventory' }
      };

      await exportTableCsvCommand(item, customVscode);

      const expectedDir = path.join(tmpDir, 'cpq', 'datatable');
      const expectedFile = path.join(expectedDir, 'PartInventory.csv');

      assert.ok(suggestedUri, 'showSaveDialog should have been called');
      assert.strictEqual(suggestedUri.fsPath, expectedFile);
      assert.ok(fs.existsSync(expectedFile), 'CSV file should be written to cpq/datatable');

      const content = fs.readFileSync(expectedFile, 'utf8');
      assert.ok(content.includes('part_number,qty'));
      assert.ok(content.includes('"P100",50'));
    } finally {
      api.listDataTables = origList;
      api.getDataTableSchema = origSchema;
      api.getDataTableRows = origGetRows;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
