const assert = require('assert');
const {
  formatAttributeDrop,
  createCloudDragAndDropController,
  registerBmlDropEditProvider,
} = require('@/lang/cloud/cloudDragAndDrop');

suite('Cloud Explorer to BML Drag-and-Drop - Unit Tests', () => {
  test('formatAttributeDrop formats correctly per domain', () => {
    assert.strictEqual(formatAttributeDrop('customer_t', 'commerce'), 'get(transaction, "customer_t")');
    assert.strictEqual(formatAttributeDrop('price_l', 'line'), 'docNum + "|price_l|" + price_lVal + "|"');
    assert.strictEqual(formatAttributeDrop('bandwidth', 'config'), 'getconfigattr("bandwidth")');
    assert.strictEqual(formatAttributeDrop('part_num', 'datatable'), '"part_num"');
    assert.strictEqual(formatAttributeDrop(''), '');
  });

  test('handleDrag populates text/plain and custom tree payload for single attribute', () => {
    let transferMap = new Map();
    const mockTransfer = {
      set: (mime, item) => transferMap.set(mime, item),
      get: (mime) => transferMap.get(mime),
    };

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: (key) => key === 'editor.dragAndDropFormat' ? 'variableName' : undefined,
        }),
      },
    };

    const controller = createCloudDragAndDropController(mockVscode, 'commerce');
    assert.ok(controller.dragMimeTypes.includes('text/plain'));
    assert.ok(controller.dragMimeTypes.includes('application/vnd.code.tree.cpqBmlExplorer'));

    const source = [
      {
        type: 'attribute',
        contextValue: 'cpqCommerceAttribute',
        data: {
          variableName: 'discount_percent_t',
          name: 'Discount Percent',
          dataType: 'Float',
        },
      },
    ];

    controller.handleDrag(source, mockTransfer, {});

    const plainItem = transferMap.get('text/plain');
    assert.ok(plainItem);
    assert.strictEqual(plainItem.value, 'discount_percent_t');

    const treeItem = transferMap.get('application/vnd.code.tree.cpqBmlExplorer');
    assert.ok(treeItem);
    const parsed = JSON.parse(treeItem.value);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].variableName, 'discount_percent_t');
    assert.strictEqual(parsed[0].domain, 'commerce');
  });

  test('handleDrag handles multiple selected items and joins them with comma', () => {
    let transferMap = new Map();
    const mockTransfer = {
      set: (mime, item) => transferMap.set(mime, item),
    };

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: () => 'variableName',
        }),
      },
    };

    const controller = createCloudDragAndDropController(mockVscode, 'commerce');

    const source = [
      { data: { variableName: 'attr1_t' } },
      { data: { variableName: 'attr2_t' } },
      { data: { variableName: 'attr3_t' } },
    ];

    controller.handleDrag(source, mockTransfer, {});

    const plainItem = transferMap.get('text/plain');
    assert.strictEqual(plainItem.value, 'attr1_t, attr2_t, attr3_t');
  });

  test('handleDrag respects accessorSnippet format setting', () => {
    let transferMap = new Map();
    const mockTransfer = {
      set: (mime, item) => transferMap.set(mime, item),
    };

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: (key) => key === 'editor.dragAndDropFormat' ? 'accessorSnippet' : undefined,
        }),
      },
    };

    const controller = createCloudDragAndDropController(mockVscode, 'commerce');

    const source = [
      {
        contextValue: 'cpqCommerceAttribute',
        data: { variableName: 'customer_t' },
      },
      {
        contextValue: 'cpqConfigAttribute',
        data: { variableName: 'speed_mbps' },
      },
    ];

    controller.handleDrag(source, mockTransfer, {});

    const plainItem = transferMap.get('text/plain');
    assert.strictEqual(plainItem.value, 'get(transaction, "customer_t"), getconfigattr("speed_mbps")');
  });

  test('handleDrag respects stringLiteral format setting', () => {
    let transferMap = new Map();
    const mockTransfer = {
      set: (mime, item) => transferMap.set(mime, item),
    };

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: (key) => key === 'editor.dragAndDropFormat' ? 'stringLiteral' : undefined,
        }),
      },
    };

    const controller = createCloudDragAndDropController(mockVscode, 'commerce');
    const source = [{ data: { variableName: 'quoteStatus_t' } }];

    controller.handleDrag(source, mockTransfer, {});

    const plainItem = transferMap.get('text/plain');
    assert.strictEqual(plainItem.value, '"quoteStatus_t"');
  });

  test('handleDrag handles data table columns appropriately', () => {
    let transferMap = new Map();
    const mockTransfer = {
      set: (mime, item) => transferMap.set(mime, item),
    };

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: () => 'variableName',
        }),
      },
    };

    const controller = createCloudDragAndDropController(mockVscode, 'datatable');
    const source = [
      {
        type: 'column',
        contextValue: 'cpqCloudDataTableColumn',
        data: { name: 'part_number', type: 'String' },
      },
    ];

    controller.handleDrag(source, mockTransfer, {});

    const plainItem = transferMap.get('text/plain');
    assert.strictEqual(plainItem.value, 'part_number');
  });

  test('handleDrag ignores invalid/empty sources gracefully', () => {
    let transferMap = new Map();
    const mockTransfer = {
      set: (mime, item) => transferMap.set(mime, item),
    };

    const controller = createCloudDragAndDropController({}, 'commerce');
    controller.handleDrag([], mockTransfer, {});
    controller.handleDrag(null, mockTransfer, {});
    controller.handleDrag([{ data: {} }], mockTransfer, {});

    assert.strictEqual(transferMap.size, 0);
  });

  test('registerBmlDropEditProvider registers provider and provides document drop edits', async () => {
    let registeredProvider = null;
    let registeredSelector = null;

    const mockVscode = {
      languages: {
        registerDocumentDropEditProvider: (selector, provider) => {
          registeredSelector = selector;
          registeredProvider = provider;
          return { dispose: () => {} };
        },
      },
      SnippetString: function (s) { this.value = s; },
      DocumentDropEdit: function (insertText) { this.insertText = insertText; },
      workspace: {
        getConfiguration: () => ({
          get: () => 'variableName',
        }),
      },
    };

    const mockContext = { subscriptions: [] };
    const disposable = registerBmlDropEditProvider(mockContext, mockVscode);

    assert.ok(disposable);
    assert.deepStrictEqual(registeredSelector, { language: 'bml' });
    assert.strictEqual(mockContext.subscriptions.length, 1);

    const mockDataTransfer = {
      get: (mime) => {
        if (mime === 'application/vnd.code.tree.cpqBmlExplorer') {
          return {
            asString: async () => JSON.stringify([{ variableName: 'billingCity_t', domain: 'commerce' }]),
          };
        }
        if (mime === 'text/plain') {
          return {
            asString: async () => 'billingCity_t',
          };
        }
        return null;
      },
    };

    const dropEdit = await registeredProvider.provideDocumentDropEdits({}, {}, mockDataTransfer, {});
    assert.ok(dropEdit);
    assert.ok(dropEdit.insertText);
    assert.strictEqual(dropEdit.insertText.value, 'billingCity_t');
  });
});
