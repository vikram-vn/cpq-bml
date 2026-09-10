const assert = require('assert');
const {
  createCloudDataTablesProvider
} = require('../../app/lang/cloud/cloudDataTables');

suite('CPQ Cloud Data Tables - Unit Tests', () => {
  const mockVscode = {
    TreeItem: function (label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: function () {
      this.event = (l) => { this._l = l; return { dispose: () => {} }; };
      this.fire = () => { if (this._l) this._l(); };
    },
    ThemeIcon: function (id, color) {
      this.id = id;
      this.color = color;
    },
    ThemeColor: function (id) {
      this.id = id;
    },
    workspace: {
      workspaceFolders: []
    }
  };

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
});
