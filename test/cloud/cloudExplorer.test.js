const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  groupFunctionsByFolder,
  findLocalFunctionFile,
  createCloudExplorer,
  pullFunctionCommand,
  openCommerceActionCommand
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
    assert.strictEqual(fnItem.label, 'Non Existent Cloud Func');
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
    assert.strictEqual(actionItem.label, 'Clean Save');
    assert.strictEqual(actionItem.description, '[Modify] cleanSave_t');
    assert.strictEqual(actionItem.contextValue, 'cpqCloudCommerceAction');
    assert.strictEqual(actionItem.iconPath.id, 'zap');

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
    assert.strictEqual(commerceFnItem.label, 'Calculate Discounts');
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

      const expectedBmlPath = path.join(tempDir, 'cpq-10234', 'util-libraries', 'finance', 'calcBonus', 'calcBonus.bml');
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
      const expectedCommercePath = path.join(tempDir, 'cpq', 'commerce-libraries', 'oraclecpqo', 'transaction', 'libraries', 'calcCommerceBonus', 'calcCommerceBonus.bml');
      assert.ok(fs.existsSync(expectedCommercePath), 'Expected commerce .bml file to be written to cpq/commerce-libraries');
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
});
