const assert = require('assert');
const { createCommerceExplorer, registerCommerceExplorer } = require('@/lang/cloud/cloudCommerceExplorer');
const api = require('@/lang/rest/api');
const { createCloudMockVscode } = require('./cloudTestMocks');

suite('CPQ Commerce Explorer - Unit Tests', () => {
  let origListActions, origListAttrs, origGetLibFuncs;

  setup(() => {
    origListActions = api.listCommerceActions;
    origListAttrs = api.listCommerceAttributes;
    origGetLibFuncs = api.listLibraryFunctions;

    api.listCommerceActions = async function (ctx, vsc, { document }) {
      if (document === 'transaction') {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'cleanSave_t', label: 'Clean Save', actionType: 'Modify', description: 'Save quote' },
              { variableName: 'submit_t', label: 'Submit Order', actionType: 'Submit', description: 'Submit order' }
            ]
          }
        };
      }
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: 'deleteLine_t', label: 'Delete Line', actionType: 'Delete', description: 'Remove line item' }
          ]
        }
      };
    };

    api.listCommerceAttributes = async function (ctx, vsc, { document }) {
      if (document === 'transaction') {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: 'transactionID_t', label: 'Transaction ID', dataType: 'String' },
              { variableName: 'customer_t', label: 'Customer', dataType: 'String' }
            ]
          }
        };
      }
      return {
        statusCode: 200,
        body: {
          items: [
            { variableName: '_part_number', label: 'Part Number', dataType: 'String' },
            { variableName: '_price_quantity', label: 'Quantity', dataType: 'Integer' }
          ]
        }
      };
    };

    api.listLibraryFunctions = async function (ctx, vsc, opts, transport, metadata) {
      if (metadata && metadata.commerceDocument) {
        return {
          statusCode: 200,
          body: {
            items: [
              { variableName: '_s_publishQuote', name: 'Publish Quote', returnType: 'String', description: 'Publishes quote' }
            ]
          }
        };
      }
      return { statusCode: 200, body: { items: [] } };
    };
  });

  teardown(() => {
    api.listCommerceActions = origListActions;
    api.listCommerceAttributes = origListAttrs;
    api.listLibraryFunctions = origGetLibFuncs;
  });

  test('createCommerceExplorer builds tree with transaction and transactionLine', async () => {
    const mockVscode = createCloudMockVscode({
      workspace: {
        getConfiguration: () => ({
          get: (k) => {
            if (k === 'connection.siteUrl') return 'https://test.bigmachines.com';
            if (k === 'rest.commerceProcess') return 'oraclecpqo';
            return '';
          }
        })
      }
    });

    const explorer = createCommerceExplorer(mockVscode, {});

    // Root nodes: Process Header, Transaction Document, Transaction Line Document
    const rootNodes = await explorer.getChildren();
    assert.strictEqual(rootNodes.length, 3);
    assert.strictEqual(rootNodes[0].type, 'processHeader');
    assert.strictEqual(rootNodes[0].process, 'oraclecpqo');
    assert.strictEqual(rootNodes[1].type, 'document');
    assert.strictEqual(rootNodes[1].docName, 'transaction');
    assert.strictEqual(rootNodes[2].type, 'document');
    assert.strictEqual(rootNodes[2].docName, 'transactionLine');

    // Process Header TreeItem
    const headerItem = explorer.getTreeItem(rootNodes[0]);
    assert.strictEqual(headerItem.label, 'Process: oraclecpqo');
    assert.strictEqual(headerItem.command.command, 'cpqBml.commerce.switchProcess');

    // Transaction document sections: Actions, Libraries, Attributes (3 sections)
    const txSections = await explorer.getChildren(rootNodes[1]);
    assert.strictEqual(txSections.length, 3);
    assert.strictEqual(txSections[0].section, 'actions');
    assert.strictEqual(txSections[0].count, 2);
    assert.strictEqual(txSections[1].section, 'libraries');
    assert.strictEqual(txSections[1].count, 1);
    assert.strictEqual(txSections[2].section, 'attributes');
    assert.strictEqual(txSections[2].count, 2);

    // Transaction Line document sections: Actions, Attributes (2 sections, NO libraries!)
    const lineSections = await explorer.getChildren(rootNodes[2]);
    assert.strictEqual(lineSections.length, 2);
    assert.strictEqual(lineSections[0].section, 'actions');
    assert.strictEqual(lineSections[1].section, 'attributes');
    assert.ok(!lineSections.some(s => s.section === 'libraries'), 'Transaction Line must NOT have libraries');

    // Inspect Actions in Transaction
    const txActions = await explorer.getChildren(txSections[0]);
    assert.strictEqual(txActions.length, 2);
    assert.strictEqual(txActions[0].data.variableName, 'cleanSave_t');
    const actItem = explorer.getTreeItem(txActions[0]);
    assert.strictEqual(actItem.label, 'Clean Save (cleanSave_t)');
    assert.ok(actItem.description.includes('[Modify]'));
    assert.strictEqual(actItem.command.command, 'cpqBml.cloud.openCommerceAction');

    // Inspect Libraries in Transaction
    const txLibs = await explorer.getChildren(txSections[1]);
    assert.strictEqual(txLibs.length, 1);
    assert.strictEqual(txLibs[0].data.variableName, '_s_publishQuote');
    const libItem = explorer.getTreeItem(txLibs[0]);
    assert.strictEqual(libItem.label, 'Publish Quote (_s_publishQuote)');
    assert.strictEqual(libItem.command.command, 'cpqBml.cloud.pullFunction');

    // Inspect Attributes in Transaction
    const txAttrs = await explorer.getChildren(txSections[2]);
    assert.strictEqual(txAttrs.length, 2);
    assert.strictEqual(txAttrs[0].data.variableName, 'transactionID_t');
    const attrItem = explorer.getTreeItem(txAttrs[0]);
    assert.strictEqual(attrItem.label, 'Transaction ID (transactionID_t)');
    assert.strictEqual(attrItem.description, '(String)');
  });

  test('registerCommerceExplorer registers tree data provider and refresh command', () => {
    const mockContext = { subscriptions: [] };
    const mockVscode = createCloudMockVscode();

    const registered = registerCommerceExplorer(mockContext, mockVscode);
    assert.ok(registered.treeDataProvider);
    assert.ok(registered.treeView);
    assert.strictEqual(mockContext.subscriptions.length, 7);
  });

  test('menu attributes are collapsible, show preview in tooltip, and expand to menuOption nodes', async () => {
    const mockVscode = createCloudMockVscode();
    const explorer = createCommerceExplorer(mockVscode, {});

    const menuAttrNode = {
      type: 'attribute',
      process: 'oraclecpqo',
      docName: 'transactionLine',
      data: {
        variableName: 'status_l',
        label: 'Line Status',
        dataType: 'Menu',
        menuOptions: [
          { value: 'New', displayValue: 'New' },
          { value: 'Pending_VQ', displayValue: 'Pending VQ' }
        ]
      }
    };

    const treeItem = explorer.getTreeItem(menuAttrNode);
    assert.strictEqual(treeItem.collapsibleState, mockVscode.TreeItemCollapsibleState.Collapsed);
    assert.ok(treeItem.tooltip.includes('Menu Options (2)'));
    assert.ok(treeItem.tooltip.includes('Pending VQ'));

    // Expand children
    const children = await explorer.getChildren(menuAttrNode);
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0].type, 'menuOption');
    assert.strictEqual(children[0].data.value, 'New');

    const optItem = explorer.getTreeItem(children[1]);
    assert.strictEqual(optItem.label, 'Pending VQ (Pending_VQ)');
    assert.strictEqual(optItem.command.command, 'cpqBml.cloud.insertOrCopyAttribute');
    assert.strictEqual(optItem.command.arguments[0].data.variableName, '"Pending_VQ"');
  });

  test('offline fallback loads attributes from workspace cache when not configured', async () => {
    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: 'c:\\test-ws' } }],
        getConfiguration: () => ({ get: () => '' }) // Unconfigured
      }
    });

    const commerceAttrs = require('@/lang/rest/commerceAttributes');
    const origLoad = commerceAttrs.loadWorkspaceAttributes;
    commerceAttrs.loadWorkspaceAttributes = () => ({
      varNameToMeta: new Map([
        ['status_t', { variableName: 'status_t', label: 'Status', scope: 'Transaction', dataType: 'Menu' }],
        ['status_l', { variableName: 'status_l', label: 'Line Status', scope: 'Line Item', dataType: 'Menu' }]
      ])
    });

    try {
      const explorer = createCommerceExplorer(mockVscode, {});
      const rootNodes = await explorer.getChildren();
      assert.ok(rootNodes.length >= 3);
      const docNode = rootNodes.find(n => n.type === 'document' && n.docName === 'transaction');
      assert.ok(docNode);
      const sections = await explorer.getChildren(docNode);
      const attrSec = sections.find(s => s.section === 'attributes');
      assert.ok(attrSec);
      assert.strictEqual(attrSec.count, 1);
      const attrs = await explorer.getChildren(attrSec);
      assert.strictEqual(attrs[0].data.variableName, 'status_t');
    } finally {
      commerceAttrs.loadWorkspaceAttributes = origLoad;
    }
  });
});
