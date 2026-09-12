const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  groupFunctionsByFolder,
  findLocalFunctionFile,
  createCloudExplorer,
  pullFunctionCommand,
  openCommerceActionCommand,
  filterExplorerCommand,
  clearFilterCommand,
  searchExplorerCommand,
  registerCloudExplorer
} = require('@/lang/cloud/cloudExplorer');
const { createCloudMockVscode } = require('./cloudTestMocks');

suite('CPQ Cloud Functions Explorer - Unit Tests', () => {
  const sampleFunctions = [
    { variableName: 'atoisafe', name: 'atoisafe', returnType: 'Integer', folderName: 'util' },
    { variableName: 'concatString', name: 'ConcatString', returnType: 'String', folderName: 'util' },
    { variableName: 'abo_apply', name: 'abo_apply', returnType: 'String', folderName: 'ORCL_ABO' },
    { variableName: 'abo_delta', name: 'abo_delta', returnType: 'String', folderName: 'ORCL_ABO' },
    { variableName: 'globalCalc', name: 'globalCalc', returnType: 'Float', folderName: '' }
  ];

  test('groupFunctionsByFolder groups by folder or namespace and sorts alphabetically', () => {
    const groups = groupFunctionsByFolder(sampleFunctions);

    assert.strictEqual(groups.size, 3);
    assert.ok(groups.has('util'));
    assert.ok(groups.has('ORCL_ABO'));
    assert.ok(groups.has('Global'));

    const utilList = groups.get('util');
    assert.strictEqual(utilList.length, 2);
    assert.strictEqual(utilList[0].variableName, 'atoisafe');
    assert.strictEqual(utilList[1].variableName, 'concatString');

    const aboList = groups.get('ORCL_ABO');
    assert.strictEqual(aboList.length, 2);
    assert.strictEqual(aboList[0].variableName, 'abo_apply');
    assert.strictEqual(aboList[1].variableName, 'abo_delta');

    const globalList = groups.get('Global');
    assert.strictEqual(globalList.length, 1);
    assert.strictEqual(globalList[0].variableName, 'globalCalc');
  });

  test('findLocalFunctionFile resolves existing local bml files and returns null otherwise', () => {
    const wsRoot = path.join(__dirname, '..', '..');

    // atoisafe and concatString were pulled to library/util/
    const foundAtoisafe = findLocalFunctionFile(wsRoot, 'atoisafe', 'util');
    if (foundAtoisafe) {
      assert.ok(fs.existsSync(foundAtoisafe));
      assert.ok(foundAtoisafe.endsWith('atoisafe.bml'));
    }

    const notFound = findLocalFunctionFile(wsRoot, 'nonExistentFunction_XYZ_999', 'util');
    assert.strictEqual(notFound, null);
  });

  test('createCloudExplorer returns functional TreeDataProvider with items, folders, and icons', async () => {
    let fired = false;
    const mockVscode = createCloudMockVscode({
      EventEmitter: function () {
        this.event = (listener) => {
          this._listener = listener;
          return { dispose: () => {} };
        };
        this.fire = () => {
          fired = true;
          if (this._listener) this._listener();
        };
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: path.join(__dirname, '..', '..') } }]
      }
    });

    const mockContext = {};
    const explorer = createCloudExplorer(mockVscode, mockContext);

    assert.strictEqual(typeof explorer.getTreeItem, 'function');
    assert.strictEqual(typeof explorer.getChildren, 'function');
    assert.strictEqual(typeof explorer.refresh, 'function');

    // Test folder tree item
    const folderElement = {
      type: 'folder',
      folderName: 'ORCL_ABO',
      count: 2,
      functions: [sampleFunctions[2], sampleFunctions[3]]
    };
    const folderItem = explorer.getTreeItem(folderElement);
    assert.strictEqual(folderItem.label, 'ORCL_ABO (2)');
    assert.strictEqual(folderItem.collapsibleState, 1);
    assert.strictEqual(folderItem.iconPath.id, 'folder');

    // Test cloud-only function tree item
    const fnElement = {
      type: 'function',
      data: {
        variableName: 'nonExistentCloudFunc',
        name: 'Non Existent Cloud Func',
        returnType: 'String',
        folderName: 'cloud',
        deploymentStatus: 'DEPLOYED'
      }
    };
    const fnItem = explorer.getTreeItem(fnElement);
    assert.strictEqual(fnItem.label, 'Non Existent Cloud Func (nonExistentCloudFunc)');
    assert.ok(fnItem.description.includes('[Deployed]'));
    assert.ok(fnItem.description.includes('☁ Cloud'));
    assert.ok(fnItem.description.includes('-> String'));
    assert.strictEqual(fnItem.contextValue, 'cpqCloudFunctionRemote');
    assert.strictEqual(fnItem.iconPath.id, 'cloud-download');
    assert.strictEqual(fnItem.command.command, 'cpqBml.cloud.pullFunction');
    assert.strictEqual(fnItem.command.title, 'Download and Open Function');

    // Test category tree items (Util, Commerce, and Actions)
    const utilCategory = {
      type: 'category',
      category: 'util',
      label: 'Util Libraries',
      count: 5
    };
    const utilCategoryItem = explorer.getTreeItem(utilCategory);
    assert.strictEqual(utilCategoryItem.label, 'Util Libraries (5)');
    assert.strictEqual(utilCategoryItem.contextValue, 'cpqCloudCategoryUtil');
    assert.strictEqual(utilCategoryItem.iconPath.id, 'library');

    const commerceCategory = {
      type: 'category',
      category: 'commerce',
      label: 'Commerce Libraries (oraclecpqo/transaction)',
      count: 3
    };
    const commerceCategoryItem = explorer.getTreeItem(commerceCategory);
    assert.strictEqual(commerceCategoryItem.label, 'Commerce Libraries (oraclecpqo/transaction) (3)');
    assert.strictEqual(commerceCategoryItem.contextValue, 'cpqCloudCategoryCommerce');
    assert.strictEqual(commerceCategoryItem.iconPath.id, 'briefcase');

    const actionsCategory = {
      type: 'category',
      category: 'actions',
      label: 'Commerce Document Actions (oraclecpqo/transaction)',
      count: 8
    };
    const actionsCategoryItem = explorer.getTreeItem(actionsCategory);
    assert.strictEqual(actionsCategoryItem.contextValue, 'cpqCloudCategoryActions');
    assert.strictEqual(actionsCategoryItem.iconPath.id, 'symbol-event');

    // Test action tree item
    const actionElement = {
      type: 'action',
      data: {
        variableName: 'cleanSave_t',
        name: 'Clean Save',
        actionType: 'Modify',
        description: 'Saves current transaction cleanly',
        commerceProcess: 'oraclecpqo',
        commerceDocument: 'transaction'
      }
    };
    const actionItem = explorer.getTreeItem(actionElement);
    assert.strictEqual(actionItem.label, 'Clean Save (cleanSave_t)');
    assert.strictEqual(actionItem.description, '[Modify]');
    assert.strictEqual(actionItem.contextValue, 'cpqCloudCommerceAction');
    assert.strictEqual(actionItem.iconPath.id, 'zap');

    // Test action tree item where type is an object (CPQ REST API response shape)
    const actionElementWithObjType = {
      type: 'action',
      data: {
        variableName: 'submit_t',
        label: 'Initiate Approval',
        type: { displayValue: 'Modify', value: 'modify' },
        description: 'Submits quote for approval',
        commerceProcess: 'oraclecpqo',
        commerceDocument: 'transaction'
      }
    };
    const actionObjItem = explorer.getTreeItem(actionElementWithObjType);
    assert.strictEqual(actionObjItem.label, 'Initiate Approval (submit_t)');
    assert.strictEqual(actionObjItem.description, '[Modify]');
    assert.ok(!actionObjItem.description.includes('[object Object]'), 'Description must not contain [object Object]');
    assert.ok(actionObjItem.tooltip.includes('Action Type: Modify'));
    assert.ok(!actionObjItem.tooltip.includes('[object Object]'), 'Tooltip must not contain [object Object]');

    // Test action tree item with nested name/lookupVal in type
    const actionElementLookup = {
      type: 'action',
      data: {
        name: 'copyLineItems_t',
        label: 'Copy Line Items',
        type: { lookupVal: 'copy' }
      }
    };
    const actionLookupItem = explorer.getTreeItem(actionElementLookup);
    assert.strictEqual(actionLookupItem.label, 'Copy Line Items (copyLineItems_t)');
    assert.strictEqual(actionLookupItem.description, '[copy]');
    assert.ok(!actionLookupItem.description.includes('[object Object]'));

    // Test staging status badge on function
    const stagingFn = {
      type: 'function',
      data: {
        variableName: 'stagedFunc',
        name: 'Staged Func',
        returnType: 'Boolean',
        deploymentStatus: 'STAGING'
      }
    };
    const stagingItem = explorer.getTreeItem(stagingFn);
    assert.strictEqual(stagingItem.label, 'Staged Func (stagedFunc)');
    assert.ok(stagingItem.description.includes('[Staging]'));
    assert.strictEqual(stagingItem.iconPath.id, 'cloud');

    // Test commerce function tree item
    const commerceFnElement = {
      type: 'function',
      data: {
        variableName: 'calcDiscounts',
        name: 'Calculate Discounts',
        returnType: 'Float',
        folderName: 'pricing',
        isCommerce: true,
        commerceProcess: 'oraclecpqo',
        commerceDocument: 'transaction',
        deploymentStatus: 'DEPLOYED',
        isOverridden: true
      }
    };
    const commerceFnItem = explorer.getTreeItem(commerceFnElement);
    assert.strictEqual(commerceFnItem.label, 'Calculate Discounts (calcDiscounts)');
    assert.ok(commerceFnItem.description.includes('[Deployed]'));
    assert.ok(commerceFnItem.description.includes('[Overridden]'));
    assert.ok(commerceFnItem.description.includes('-> Float'));
    assert.strictEqual(commerceFnItem.contextValue, 'cpqCloudFunctionRemote');
    assert.ok(commerceFnItem.tooltip.includes('Commerce: oraclecpqo/transaction'));

    // Test children under category and folder
    const categoryFolders = await explorer.getChildren({
      type: 'category',
      category: 'commerce',
      commerceProcess: 'oraclecpqo',
      commerceDocument: 'transaction',
      groups: new Map([
        ['pricing', [commerceFnElement.data]]
      ])
    });
    assert.strictEqual(categoryFolders.length, 1);
    assert.strictEqual(categoryFolders[0].folderName, 'pricing');
    assert.strictEqual(categoryFolders[0].isCommerce, true);

    const folderFunctions = await explorer.getChildren(categoryFolders[0]);
    assert.strictEqual(folderFunctions.length, 1);
    assert.strictEqual(folderFunctions[0].data.variableName, 'calcDiscounts');

    // Test action folder tree item (e.g. transactionLine sub-document)
    const actionFolderElement = {
      type: 'actionFolder',
      docName: 'transactionLine',
      commerceProcess: 'oraclecpqo',
      count: 2,
      actions: [
        { variableName: 'deleteLine_t', name: 'Delete Line', type: 'Modify', commerceDocument: 'transactionLine' }
      ]
    };
    const actionFolderItem = explorer.getTreeItem(actionFolderElement);
    assert.ok(actionFolderItem.label.includes('Transaction Line (Sub-document) (2)'));
    assert.strictEqual(actionFolderItem.iconPath.id, 'symbol-event');

    const folderActions = await explorer.getChildren(actionFolderElement);
    assert.strictEqual(folderActions.length, 1);
    assert.strictEqual(folderActions[0].data.variableName, 'deleteLine_t');

    // Test refresh
    explorer.refresh();
    assert.strictEqual(fired, true);
  });

  test('pullFunctionCommand downloads remote function and opens document in editor', async () => {
    const os = require('os');
    const api = require('@/lang/rest/api');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-pull-test-'));

    const origGetFunc = api.getLibraryFunction;
    api.getLibraryFunction = async () => ({
      statusCode: 200,
      body: {
        variableName: 'calcBonus',
        name: 'Calculate Bonus',
        returnType: 'Float',
        scriptText: 'return 100.0;\n'
      }
    });

    let openedUri = null;
    let showedDoc = null;

    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://cpq-10234.bigmachines.com' : ''
        }),
        openTextDocument: async (uri) => {
          openedUri = uri;
          return { uri };
        }
      },
      window: {
        showTextDocument: async (doc) => {
          showedDoc = doc;
        }
      },
      Uri: {
        file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f })
      }
    });

    try {
      const item = {
        data: {
          variableName: 'calcBonus',
          name: 'Calculate Bonus',
          folderName: 'finance'
        }
      };

      await pullFunctionCommand(item, mockVscode, {});

      const expectedBmlPath = path.join(tempDir, 'cpq', 'cpq-10234', 'util-libraries', 'finance', 'calcBonus', 'calcBonus.bml');
      assert.ok(fs.existsSync(expectedBmlPath), 'Expected .bml file to be written locally');
      const content = fs.readFileSync(expectedBmlPath, 'utf8');
      assert.strictEqual(content, 'return 100.0;\n');

      assert.ok(openedUri, 'Expected openTextDocument to be called');
      assert.strictEqual(openedUri.fsPath, expectedBmlPath);
      assert.ok(showedDoc, 'Expected showTextDocument to be called');

      // Test commerce pull lands in cpq/commerce-libraries
      const commerceItem = {
        data: {
          variableName: 'calcCommerceBonus',
          name: 'Commerce Bonus',
          isCommerce: true,
          commerceProcess: 'oraclecpqo',
          commerceDocument: 'transaction'
        }
      };
      await pullFunctionCommand(commerceItem, mockVscode, {});
      const expectedCommercePath = path.join(tempDir, 'cpq', 'cpq-10234', 'oraclecpqo', 'commerce-libraries', 'calcCommerceBonus', 'calcCommerceBonus.bml');
      assert.ok(fs.existsSync(expectedCommercePath), 'Expected commerce .bml file to be written to cpq/cpq-10234/oraclecpqo/commerce-libraries');
    } finally {
      api.getLibraryFunction = origGetFunc;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('openCommerceActionCommand fetches action definition and opens JSON document', async () => {
    const api = require('@/lang/rest/api');
    const origGetAction = api.getCommerceAction;
    api.getCommerceAction = async function (context, vscodeInstance, varName) {
      return {
        statusCode: 200,
        body: {
          variableName: varName,
          name: 'Clean Save',
          actionType: 'Modify',
          rules: ['Rule 1', 'Rule 2']
        }
      };
    };

    let openedDoc = null;
    let showedDoc = null;
    const mockVscode = {
      workspace: {
        workspaceFolders: [{ uri: { fsPath: '/mock' } }],
        openTextDocument: async function (target) {
          openedDoc = target;
          return target;
        }
      },
      window: {
        withProgress: async function (opt, task) {
          return task({ report: function () {} });
        },
        showErrorMessage: function () {},
        showTextDocument: async function (doc) {
          showedDoc = doc;
        }
      }
    };

    try {
      const item = {
        data: {
          variableName: 'cleanSave_t',
          name: 'Clean Save',
          commerceProcess: 'oraclecpqo',
          commerceDocument: 'transaction'
        }
      };
      await openCommerceActionCommand(item, mockVscode, {});
      assert.ok(openedDoc);
      assert.strictEqual(openedDoc.language, 'json');
      assert.ok(openedDoc.content.includes('cleanSave_t'));
      assert.ok(openedDoc.content.includes('Rule 1'));
      assert.ok(showedDoc);
    } finally {
      api.getCommerceAction = origGetAction;
    }
  });

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

      // Set filter
      explorer.setFilter('calc');
      assert.strictEqual(explorer.getFilter(), 'calc');
      assert.strictEqual(mockVscode.getContext('cpqBml.cloudExplorerFiltered'), true);

      // getTreeItem for filterInfo
      const filterNode = { type: 'filterInfo', query: 'calc', totalMatches: 3 };
      const filterItem = explorer.getTreeItem(filterNode);
      assert.ok(filterItem.label.includes('Filter: "calc"'));
      assert.ok(filterItem.label.includes('3 matches'));
      assert.strictEqual(filterItem.iconPath.id, 'filter');
      assert.strictEqual(filterItem.command.command, 'cpqBml.cloud.clearFilter');

      // Category auto-expanded when filtered
      const catNode = {
        type: 'category',
        category: 'util',
        label: 'Util Libraries (2 matches)',
        count: 2,
        isFiltered: true
      };
      const catItem = explorer.getTreeItem(catNode);
      assert.strictEqual(catItem.collapsibleState, 2); // Expanded
      assert.strictEqual(catItem.label, 'Util Libraries (2 matches)');

      // Folder auto-expanded when filtered
      const folderNode = {
        type: 'folder',
        folderName: 'finance',
        count: 2
      };
      const folderItem = explorer.getTreeItem(folderNode);
      assert.strictEqual(folderItem.collapsibleState, 2); // Expanded

      // Clear filter
      explorer.clearFilter();
      assert.strictEqual(explorer.getFilter(), '');
      assert.strictEqual(mockVscode.getContext('cpqBml.cloudExplorerFiltered'), false);

      // Category collapsed when not filtered
      const catNodeUnfiltered = {
        type: 'category',
        category: 'util',
        label: 'Util Libraries',
        count: 5
      };
      const catItemUnfiltered = explorer.getTreeItem(catNodeUnfiltered);
      assert.strictEqual(catItemUnfiltered.collapsibleState, 1); // Collapsed
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

        // Unfiltered root returns util library folders (pricing, stringUtils)
        const rootUnfiltered = await explorer.getChildren();
        assert.strictEqual(rootUnfiltered.length, 2);
        assert.strictEqual(rootUnfiltered[0].folderName, 'pricing');
        assert.strictEqual(rootUnfiltered[1].folderName, 'stringUtils');

        // Filter for "calc" -> matches calcDiscount (util in pricing folder)
        explorer.setFilter('calc');
        const rootFiltered = await explorer.getChildren();
        assert.strictEqual(rootFiltered.length, 2); // filterInfo + pricing folder
        assert.strictEqual(rootFiltered[0].type, 'filterInfo');
        assert.strictEqual(rootFiltered[0].totalMatches, 1);
        assert.strictEqual(rootFiltered[1].type, 'folder');
        assert.strictEqual(rootFiltered[1].folderName, 'pricing');

        // Check children of filtered pricing folder
        const utilFuncs = await explorer.getChildren(rootFiltered[1]);
        assert.strictEqual(utilFuncs.length, 1);
        assert.strictEqual(utilFuncs[0].data.variableName, 'calcDiscount');

        // Filter for something nonexistent -> empty state
        explorer.setFilter('xyzNonExistent999');
        const emptyRoot = await explorer.getChildren();
        assert.strictEqual(emptyRoot.length, 2);
        assert.strictEqual(emptyRoot[0].type, 'filterInfo');
        assert.strictEqual(emptyRoot[0].totalMatches, 0);
        assert.strictEqual(emptyRoot[1].type, 'empty');
        assert.ok(emptyRoot[1].label.includes('No util functions match'));
        assert.strictEqual(emptyRoot[1].command.command, 'cpqBml.cloud.clearFilter');

        // Clearing filter restores full tree
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

      // Running filterExplorerCommand sets filter
      await filterExplorerCommand(explorer, mockVscode);
      assert.strictEqual(explorer.getFilter(), 'discount');

      // Running clearFilterCommand clears filter
      clearFilterCommand(explorer, mockVscode);
      assert.strictEqual(explorer.getFilter(), '');

      // Running filterExplorerCommand with empty input clears filter
      inputBoxValue = '   ';
      explorer.setFilter('test');
      await filterExplorerCommand(explorer, mockVscode);
      assert.strictEqual(explorer.getFilter(), '');

      // Running filterExplorerCommand with cancellation (undefined) leaves filter intact
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

      const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cpq-search-test-'));

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

        // Test opening QuickPick
        await searchExplorerCommand(explorer, mockVscode, {});
        assert.ok(quickPickPicks);
        assert.ok(quickPickPicks.length >= 2); // Filter prompt + atoisafe
        assert.ok(quickPickPicks[0].label.includes('Filter Cloud Explorer Tree View'));
        assert.ok(quickPickPicks.some(p => p.data && p.data.variableName === 'atoisafe'));

        // Test selecting a function item -> pulls and opens file
        const atoisafePick = quickPickPicks.find(p => p.data && p.data.variableName === 'atoisafe');
        selectedPick = atoisafePick;
        await searchExplorerCommand(explorer, mockVscode, {});
        assert.ok(openedFile);

        // Test selecting filterTree action
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
          registerCommand: (id, handler) => {
            registeredCmds.push(id);
            return { dispose: () => {} };
          }
        }
      });

      registerCloudExplorer(mockContext, mockVscode);

      assert.ok(registeredCmds.includes('cpqBml.cloud.searchExplorer'));
      assert.ok(registeredCmds.includes('cpqBml.cloud.filterExplorer'));
      assert.ok(registeredCmds.includes('cpqBml.cloud.clearFilter'));
      assert.ok(registeredCmds.includes('cpqBml.cloud.refresh'));
      assert.ok(registeredCmds.includes('cpqBml.cloud.pullFunction'));
    });
  });
});
