const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  createCloudExplorer,
  deployFunctionCommand,
  debugFunctionCommand,
  debugConfigureFunctionCommand,
  viewFunctionMetadataCommand,
  filterExplorerCommand,
  clearFilterCommand,
  searchExplorerCommand,
  registerCloudExplorer
} = require('@/lang/cloud/cloudExplorer');
const { createCloudMockVscode } = require('@/test/cloud/cloudTestMocks');

suite('Cloud Explorer - Search & Filter Tests', () => {
  test('filter state, context setting, and collapsible auto-expansion', async () => {
    const mockVscode = createCloudMockVscode({
      EventEmitter: function () {
        this.event = () => ({ dispose: () => {} });
        this.fire = () => {};
      }
    });

    const explorer = createCloudExplorer(mockVscode, {});
    assert.strictEqual(explorer.getFilter(), '');

    explorer.setFilter('calc');
    assert.strictEqual(explorer.getFilter(), 'calc');
    assert.strictEqual(mockVscode.getContext('cpqBml.cloudExplorerFiltered'), true);

    const filterNode = { type: 'filterInfo', query: 'calc', totalMatches: 3 };
    const filterItem = explorer.getTreeItem(filterNode);
    assert.ok(filterItem.label.includes('Filter: "calc"'));
    assert.ok(filterItem.label.includes('3 matches'));
    assert.strictEqual(filterItem.iconPath.id, 'filter');
    assert.strictEqual(filterItem.command.command, 'cpqBml.cloud.clearFilter');

    const catNode = {
      type: 'category',
      category: 'util',
      label: 'Util Libraries (2 matches)',
      count: 2,
      isFiltered: true
    };
    const catItem = explorer.getTreeItem(catNode);
    assert.strictEqual(catItem.collapsibleState, 2);
    assert.strictEqual(catItem.label, 'Util Libraries (2 matches)');

    const folderNode = {
      type: 'folder',
      folderName: 'finance',
      count: 2
    };
    const folderItem = explorer.getTreeItem(folderNode);
    assert.strictEqual(folderItem.collapsibleState, 2);

    explorer.clearFilter();
    assert.strictEqual(explorer.getFilter(), '');
    assert.strictEqual(mockVscode.getContext('cpqBml.cloudExplorerFiltered'), false);

    const catNodeUnfiltered = {
      type: 'category',
      category: 'util',
      label: 'Util Libraries',
      count: 5
    };
    const catItemUnfiltered = explorer.getTreeItem(catNodeUnfiltered);
    assert.strictEqual(catItemUnfiltered.collapsibleState, 1);
    assert.strictEqual(catItemUnfiltered.label, 'Util Libraries (5)');
  });

  test('getChildren correctly filters util, commerce, and actions', async () => {
    const api = require('@/lang/rest/api');
    const origListUtil = api.listLibraryFunctions;
    const origListActions = api.listCommerceActions;

    api.listLibraryFunctions = async function (context, vscodeInstance, opts, transport, metadata) {
      if (metadata && metadata.commerceProcess) {
        if (metadata.commerceDocument === 'transaction') {
          return {
            statusCode: 200,
            body: {
              items: [
                { variableName: 'calcCommerceTax', name: 'Commerce Tax', returnType: 'Float', folderName: 'tax', commerceProcess: 'oraclecpqo', commerceDocument: 'transaction' },
                { variableName: 'validateOrder', name: 'Validate Order', returnType: 'Boolean', folderName: 'validation', commerceProcess: 'oraclecpqo', commerceDocument: 'transaction' }
              ]
            }
          };
        }
        return { statusCode: 200, body: { items: [] } };
      }
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'calcDiscount', name: 'Calculate Discount', returnType: 'Float', folderName: 'pricing' },
            { variableName: 'concatNames', name: 'Concat Names', returnType: 'String', folderName: 'stringUtils' }
          ]
        }
      };
    };

    api.listCommerceActions = async function (context, vscodeInstance, opts) {
      if (opts && opts.document === 'transaction') {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'calcTotals_t', name: 'Calculate Totals', actionType: 'Modify', commerceProcess: 'oraclecpqo', commerceDocument: 'transaction' },
              { variableName: 'submitOrder_t', name: 'Submit Order', actionType: 'Submit', commerceProcess: 'oraclecpqo', commerceDocument: 'transaction' }
            ]
          }
        };
      }
      return { statusCode: 200, body: { items: [] } };
    };

    const mockVscode = createCloudMockVscode({
      EventEmitter: function () {
        this.event = () => ({ dispose: () => {} });
        this.fire = () => {};
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
      }
    });

    try {
      const explorer = createCloudExplorer(mockVscode, {});

      const rootUnfiltered = await explorer.getChildren();
      assert.strictEqual(rootUnfiltered.length, 2);
      assert.strictEqual(rootUnfiltered[0].folderName, 'pricing');
      assert.strictEqual(rootUnfiltered[1].folderName, 'stringUtils');

      explorer.setFilter('calc');
      const rootFiltered = await explorer.getChildren();
      assert.strictEqual(rootFiltered.length, 2);
      assert.strictEqual(rootFiltered[0].type, 'filterInfo');
      assert.strictEqual(rootFiltered[0].totalMatches, 1);
      assert.strictEqual(rootFiltered[1].type, 'folder');
      assert.strictEqual(rootFiltered[1].folderName, 'pricing');

      const utilFuncs = await explorer.getChildren(rootFiltered[1]);
      assert.strictEqual(utilFuncs.length, 1);
      assert.strictEqual(utilFuncs[0].data.variableName, 'calcDiscount');

      explorer.setFilter('xyzNonExistent999');
      const emptyRoot = await explorer.getChildren();
      assert.strictEqual(emptyRoot.length, 2);
      assert.strictEqual(emptyRoot[0].type, 'filterInfo');
      assert.strictEqual(emptyRoot[0].totalMatches, 0);
      assert.strictEqual(emptyRoot[1].type, 'empty');
      assert.ok(emptyRoot[1].label.includes('No util functions match'));
      assert.strictEqual(emptyRoot[1].command.command, 'cpqBml.cloud.clearFilter');

      explorer.clearFilter();
      const restoredRoot = await explorer.getChildren();
      assert.strictEqual(restoredRoot.length, 2);
    } finally {
      api.listLibraryFunctions = origListUtil;
      api.listCommerceActions = origListActions;
    }
  });

  test('filterExplorerCommand and clearFilterCommand operate on tree filter', async () => {
    let inputBoxValue = 'discount';
    const mockVscode = createCloudMockVscode({
      EventEmitter: function () {
        this.event = () => ({ dispose: () => {} });
        this.fire = () => {};
      },
      window: {
        showInputBox: async () => inputBoxValue
      }
    });

    const explorer = createCloudExplorer(mockVscode, {});

    await filterExplorerCommand(explorer, mockVscode);
    assert.strictEqual(explorer.getFilter(), 'discount');

    clearFilterCommand(explorer, mockVscode);
    assert.strictEqual(explorer.getFilter(), '');

    inputBoxValue = '   ';
    explorer.setFilter('test');
    await filterExplorerCommand(explorer, mockVscode);
    assert.strictEqual(explorer.getFilter(), '');

    explorer.setFilter('activeFilter');
    inputBoxValue = undefined;
    await filterExplorerCommand(explorer, mockVscode);
    assert.strictEqual(explorer.getFilter(), 'activeFilter');
  });

  test('searchExplorerCommand shows QuickPick and handles selection', async () => {
    const api = require('@/lang/rest/api');
    const origListUtil = api.listLibraryFunctions;
    const origListActions = api.listCommerceActions;
    const origGetLib = api.getLibraryFunction;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-search-test-'));

    api.listLibraryFunctions = async function (context, vscodeInstance, opts, transport, metadata) {
      if (metadata && metadata.commerceProcess) {
        return { statusCode: 200, body: { items: [] } };
      }
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'atoisafe', name: 'atoisafe', returnType: 'Integer', folderName: 'util' }
          ]
        }
      };
    };

    api.listCommerceActions = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'cleanSave_t', name: 'Clean Save', actionType: 'Modify', commerceProcess: 'oraclecpqo', commerceDocument: 'transaction' }
          ]
        }
      };
    };

    api.getLibraryFunction = async function () {
      return {
        statusCode: 200,
        body: {
          name: 'atoisafe',
          variableName: 'atoisafe',
          scriptText: 'return 0;\n'
        }
      };
    };

    let quickPickPicks = null;
    let selectedPick = null;
    let openedFile = null;

    const mockVscode = createCloudMockVscode({
      EventEmitter: function () {
        this.event = () => ({ dispose: () => {} });
        this.fire = () => {};
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({ get: () => '' }),
        openTextDocument: async (uri) => {
          openedFile = uri;
          return { uri };
        }
      },
      window: {
        showQuickPick: async (items) => {
          quickPickPicks = items;
          return selectedPick;
        },
        showTextDocument: async () => {},
        withProgress: async (opt, task) => task({ report: () => {} })
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file' })
      }
    });

    try {
      const explorer = createCloudExplorer(mockVscode, {});

      await searchExplorerCommand(explorer, mockVscode, {});
      assert.ok(quickPickPicks);
      assert.ok(quickPickPicks.length >= 2);
      assert.ok(quickPickPicks[0].label.includes('Filter Cloud Explorer Tree View'));
      assert.ok(quickPickPicks.some(p => p.data && p.data.variableName === 'atoisafe'));

      const atoisafePick = quickPickPicks.find(p => p.data && p.data.variableName === 'atoisafe');
      selectedPick = atoisafePick;
      await searchExplorerCommand(explorer, mockVscode, {});
      assert.ok(openedFile);

      selectedPick = quickPickPicks[0];
      mockVscode.window.showInputBox = async () => 'testSearch';
      await searchExplorerCommand(explorer, mockVscode, {});
      assert.strictEqual(explorer.getFilter(), 'testSearch');
    } finally {
      api.listLibraryFunctions = origListUtil;
      api.listCommerceActions = origListActions;
      api.getLibraryFunction = origGetLib;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('registerCloudExplorer registers search, filter, and clearFilter commands', () => {
    const registeredCmds = [];
    const mockContext = { subscriptions: [] };
    const mockVscode = createCloudMockVscode({
      EventEmitter: function () {
        this.event = () => ({ dispose: () => {} });
        this.fire = () => {};
      },
      commands: {
        registerCommand: (id) => {
          registeredCmds.push(id);
          return { dispose: () => {} };
        }
      }
    });

    registerCloudExplorer(mockContext, mockVscode);

    assert.ok(registeredCmds.includes('cpqBml.cloud.searchExplorer'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.filterExplorer'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.clearFilter'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.pullFunction'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.diffFunction'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.deployFunction'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.debugFunction'));
    assert.ok(registeredCmds.includes('cpqBml.cloud.debugConfigureFunction'));
  });
});
