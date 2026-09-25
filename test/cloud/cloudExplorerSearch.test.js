'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createCloudMockVscode } = require('./cloudTestMocks');
const { searchExplorerCommand, filterExplorerCommand, clearFilterCommand } = require('@/lang/cloud/cloudExplorerSearch');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockContext(workspaceState = {}) {
  const state = new Map(Object.entries(workspaceState));
  return {
    subscriptions: [],
    workspaceState: {
      get: (k) => state.get(k),
      update: (k, v) => { state.set(k, v); return Promise.resolve(); }
    }
  };
}

/**
 * Creates a minimal treeDataProvider stub that satisfies searchExplorerCommand's
 * duck-typed interface. Override individual fields as needed per test.
 */
function makeProvider(overrides = {}) {
  return {
    fetchRemoteFunctions: async () => {},
    getCachedFunctions: () => [],
    getCachedActions: () => [],
    getCachedItems: () => [],
    setFilter: () => {},
    getFilter: () => '',
    clearFilter: () => {},
    refresh: () => {},
    ...overrides
  };
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

const UTIL_FN = {
  variableName: 'addNumbers',
  name: 'Add Numbers',
  returnType: 'Float',
  folderName: 'math'
};

const COMMERCE_ACTION = {
  variableName: 'cleanSave_t',
  name: 'Clean Save',
  actionType: 'Modify',
  commerceProcess: 'oraclecpqo',
  commerceDocument: 'transaction'
};

const COMMERCE_RULE = {
  variableName: 'minQtyRule',
  name: 'Min Qty Rule',
  ruleType: 'Constraint',
  _searchType: 'rule',
  commerceProcess: 'oraclecpqo',
  commerceDocument: 'transaction'
};

const COMMERCE_ATTR = {
  variableName: 'quantity_t',
  name: 'Quantity',
  dataType: 'Integer',
  _searchType: 'attribute',
  commerceProcess: 'oraclecpqo',
  commerceDocument: 'transaction'
};

const CONFIG_FAMILY = {
  variableName: 'router_pf',
  label: 'Router Product Family',
  name: 'Router Product Family',
  _searchType: 'configFamily',
  _searchLabel: 'Router Product Family'
};

const DATA_TABLE = {
  variableName: 'pricingTable',
  name: 'pricingTable',
  description: 'Pricing reference table',
  _searchType: 'dataTable'
};

const COMMERCE_LIB_FN = {
  variableName: 'calcDiscount',
  name: 'Calc Discount',
  returnType: 'Float',
  isCommerce: true,
  commerceProcess: 'oraclecpqo',
  commerceDocument: 'transaction',
  _searchType: 'function'
};

// ─── Suite ────────────────────────────────────────────────────────────────────

suite('searchExplorerCommand - section-aware QuickPick search', () => {

  // 1. No items guard
  test('shows informationMessage and returns early when provider has no items', async () => {
    const mockVscode = createCloudMockVscode();
    const provider = makeProvider();
    const context = makeMockContext();

    await searchExplorerCommand(provider, mockVscode, context);

    assert.ok(
      mockVscode.getInfoMsg() && mockVscode.getInfoMsg().includes('No items'),
      `Expected "No items" message, got: "${mockVscode.getInfoMsg()}"`
    );
    assert.strictEqual(mockVscode.getQuickPickItems(), null);
  });

  // 2. Util functions section
  test('populates QuickPick with util function items from getCachedFunctions()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedFunctions: () => [UTIL_FN] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    assert.ok(Array.isArray(items));
    const fnItem = items.find(i => i.itemType === 'function');
    assert.ok(fnItem, 'Should have a function item');
    assert.ok(fnItem.label.includes('addNumbers'), `Label should include variableName, got: ${fnItem.label}`);
    assert.ok(fnItem.description.includes('Util'), `Description should show Util, got: ${fnItem.description}`);
    assert.ok(fnItem.description.includes('math'), `Description should include folder, got: ${fnItem.description}`);
    assert.ok(fnItem.description.includes('Float'), `Description should include return type, got: ${fnItem.description}`);
  });

  // 3. Commerce actions
  test('populates QuickPick with action items from getCachedActions()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedActions: () => [COMMERCE_ACTION] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const actionItem = items.find(i => i.itemType === 'action');
    assert.ok(actionItem, 'Should have an action item');
    assert.ok(actionItem.label.includes('cleanSave_t'), `Label missing variableName, got: ${actionItem.label}`);
    assert.ok(actionItem.description.includes('Action'), `Description should contain Action, got: ${actionItem.description}`);
    assert.ok(actionItem.description.includes('Modify'), `Description should include actionType, got: ${actionItem.description}`);
    assert.ok(actionItem.description.includes('transaction'), `Description should include doc, got: ${actionItem.description}`);
  });

  // 4. Commerce rule via getCachedItems()
  test('renders Commerce rule items from getCachedItems()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedItems: () => [COMMERCE_RULE] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const ruleItem = items.find(i => i.itemType === 'rule');
    assert.ok(ruleItem, 'Should have a rule item');
    assert.ok(ruleItem.label.includes('minQtyRule'), `Label missing variableName, got: ${ruleItem.label}`);
    assert.ok(ruleItem.description.includes('Rule'), `Description should contain Rule, got: ${ruleItem.description}`);
    assert.ok(ruleItem.description.includes('Constraint'), `Description should include ruleType, got: ${ruleItem.description}`);
    assert.ok(ruleItem.description.includes('transaction'), `Description should include doc, got: ${ruleItem.description}`);
  });

  // 5. Commerce attribute via getCachedItems()
  test('renders Commerce attribute items from getCachedItems()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedItems: () => [COMMERCE_ATTR] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const attrItem = items.find(i => i.itemType === 'attribute');
    assert.ok(attrItem, 'Should have an attribute item');
    assert.ok(attrItem.label.includes('quantity_t'), `Label missing variableName, got: ${attrItem.label}`);
    assert.ok(attrItem.description.includes('Attribute'), `Description should contain Attribute, got: ${attrItem.description}`);
    assert.ok(attrItem.description.includes('Integer'), `Description should include dataType, got: ${attrItem.description}`);
  });

  // 6. Config family via getCachedItems()
  test('renders Config family items from getCachedItems()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedItems: () => [CONFIG_FAMILY] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const familyItem = items.find(i => i.itemType === 'configFamily');
    assert.ok(familyItem, 'Should have a configFamily item');
    assert.ok(familyItem.label.includes('Router'), `Label should include family label, got: ${familyItem.label}`);
    assert.ok(familyItem.description.includes('Configuration Family'), `Description should identify type, got: ${familyItem.description}`);
  });

  // 7. DataTable via getCachedItems()
  test('renders DataTable items from getCachedItems()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedItems: () => [DATA_TABLE] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const tableItem = items.find(i => i.itemType === 'dataTable');
    assert.ok(tableItem, 'Should have a dataTable item');
    assert.ok(tableItem.label.includes('pricingTable'), `Label should include table name, got: ${tableItem.label}`);
    assert.ok(tableItem.description.includes('Data Table'), `Description should identify type, got: ${tableItem.description}`);
    assert.ok(tableItem.detail.includes('Pricing reference'), `Detail should include description, got: ${tableItem.detail}`);
  });

  // 8. Commerce library function via getCachedItems()
  test('renders commerce library function items from getCachedItems()', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedItems: () => [COMMERCE_LIB_FN] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const fnItem = items.find(i => i.itemType === 'function');
    assert.ok(fnItem, 'Should have a function item for commerce library');
    assert.ok(fnItem.label.includes('calcDiscount'), `Label should include variableName, got: ${fnItem.label}`);
    assert.ok(fnItem.description.includes('Commerce'), `Description should indicate Commerce, got: ${fnItem.description}`);
    assert.ok(fnItem.description.includes('Float'), `Description should include returnType, got: ${fnItem.description}`);
  });

  // 9. Mixed items across all types
  test('includes all item types when provider exposes multiple getCached methods', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({
      getCachedFunctions: () => [UTIL_FN],
      getCachedActions: () => [COMMERCE_ACTION],
      getCachedItems: () => [COMMERCE_RULE, COMMERCE_ATTR, CONFIG_FAMILY, DATA_TABLE]
    });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    const types = new Set(items.filter(i => i.itemType).map(i => i.itemType));
    assert.ok(types.has('function'), 'Should contain function items');
    assert.ok(types.has('action'), 'Should contain action items');
    assert.ok(types.has('rule'), 'Should contain rule items');
    assert.ok(types.has('attribute'), 'Should contain attribute items');
    assert.ok(types.has('configFamily'), 'Should contain configFamily items');
    assert.ok(types.has('dataTable'), 'Should contain dataTable items');
  });

  // 10. Filter shortcut at top when no active filter
  test('prepends a filterTree shortcut item as the first entry when no filter active', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedFunctions: () => [UTIL_FN] });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    assert.ok(items.length > 0);
    assert.strictEqual(items[0].action, 'filterTree',
      `First item should be filterTree shortcut, got action: ${items[0].action}`);
  });

  // 11. clearFilter shortcut when filter is active
  test('prepends a clearFilter shortcut when a filter is active', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({
      getCachedFunctions: () => [UTIL_FN],
      getFilter: () => 'myQuery'
    });

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    const items = mockVscode.getQuickPickItems();
    assert.strictEqual(items[0].action, 'clearFilter',
      'When filter is active, first item should be clearFilter');
    assert.ok(items[0].label.includes('myQuery'),
      `clearFilter item should show current query, got: ${items[0].label}`);
  });

  // 12. Selecting a local function opens the file
  test('selecting a local-present function opens the file via openTextDocument', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-search-test-'));
    const fnDir = path.join(tmpDir, 'cpq', 'cpq-demo', 'util-libraries', 'math', 'addNumbers');
    fs.mkdirSync(fnDir, { recursive: true });
    const bmlPath = path.join(fnDir, 'addNumbers.bml');
    fs.writeFileSync(bmlPath, 'return a + b;');

    let openedUri = null;
    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
        getConfiguration: () => ({
          get: (k) => k === 'connection.siteUrl' ? 'https://cpq-demo.bigmachines.com' : ''
        }),
        openTextDocument: async (uri) => { openedUri = uri; return { uri }; }
      },
      window: { showTextDocument: async () => {} },
      Uri: { file: (f) => ({ fsPath: f, scheme: 'file', toString: () => f }) }
    });

    const provider = makeProvider({ getCachedFunctions: () => [UTIL_FN] });
    mockVscode.setQuickPickSelected((items) => items.find(i => i.itemType === 'function'));

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    assert.ok(openedUri, 'Expected openTextDocument to be called');
    assert.ok(
      openedUri.fsPath.endsWith('addNumbers.bml'),
      `Expected addNumbers.bml to be opened, got: ${openedUri.fsPath}`
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 13. Selecting a dataTable opens a BMQL query document
  test('selecting a dataTable item opens an untitled BMQL query document', async () => {
    let openedContent = null;
    const mockVscode = createCloudMockVscode({
      workspace: {
        workspaceFolders: [],
        getConfiguration: () => ({ get: () => '' }),
        openTextDocument: async (opts) => { openedContent = opts && opts.content; return { uri: opts }; }
      },
      window: { showTextDocument: async () => {} },
      Uri: { file: (f) => ({ fsPath: f }) }
    });

    const provider = makeProvider({ getCachedItems: () => [DATA_TABLE] });
    mockVscode.setQuickPickSelected((items) => items.find(i => i.itemType === 'dataTable'));

    await searchExplorerCommand(provider, mockVscode, makeMockContext());

    assert.ok(openedContent, 'Expected openTextDocument to be called with content');
    assert.ok(openedContent.includes('pricingTable'), `BMQL snippet should include table name, got: ${openedContent}`);
    assert.ok(openedContent.includes('SELECT'), `BMQL snippet should include SELECT, got: ${openedContent}`);
  });

  // 14. Workspace state cache (section 4 fallback)
  test('includes dataTable items from workspaceState cache as section-4 fallback', async () => {
    const mockVscode = createCloudMockVscode();
    mockVscode.setQuickPickSelected(null);
    const provider = makeProvider({ getCachedItems: () => [] });  // no getCachedItems returns
    const context = makeMockContext({
      cpqCloudDataTablesCache: [{ name: 'discountTable', description: 'Discount lookup' }]
    });

    await searchExplorerCommand(provider, mockVscode, context);

    const items = mockVscode.getQuickPickItems();
    const tableItem = items && items.find(i => i.itemType === 'dataTable');
    assert.ok(tableItem, 'Should include dataTable item from workspace state cache');
    assert.ok(tableItem.label.includes('discountTable'), `Label should include table name, got: ${tableItem.label}`);
  });

  // 15. filterExplorerCommand sets filter
  test('filterExplorerCommand calls setFilter with the entered query', async () => {
    let setFilterArg = null;
    const mockVscode = createCloudMockVscode({
      window: { showInputBox: async () => 'priceCalc' }
    });
    const provider = makeProvider({ setFilter: (q) => { setFilterArg = q; } });

    await filterExplorerCommand(provider, mockVscode);

    assert.strictEqual(setFilterArg, 'priceCalc');
  });

  test('filterExplorerCommand calls clearFilter when empty string entered', async () => {
    let cleared = false;
    const mockVscode = createCloudMockVscode({
      window: { showInputBox: async () => '' }
    });
    const provider = makeProvider({ clearFilter: () => { cleared = true; } });

    await filterExplorerCommand(provider, mockVscode);

    assert.strictEqual(cleared, true);
  });

  test('filterExplorerCommand does nothing when user cancels (undefined)', async () => {
    let called = false;
    const mockVscode = createCloudMockVscode({
      window: { showInputBox: async () => undefined }
    });
    const provider = makeProvider({
      setFilter: () => { called = true; },
      clearFilter: () => { called = true; }
    });

    await filterExplorerCommand(provider, mockVscode);

    assert.strictEqual(called, false);
  });

  // 16. clearFilterCommand
  test('clearFilterCommand calls clearFilter on provider', () => {
    let cleared = false;
    const provider = makeProvider({ clearFilter: () => { cleared = true; } });
    clearFilterCommand(provider, createCloudMockVscode());
    assert.strictEqual(cleared, true);
  });

  test('clearFilterCommand is safe when provider is null', () => {
    assert.doesNotThrow(() => clearFilterCommand(null, createCloudMockVscode()));
  });

  // 17. Commerce provider getCachedActions() and getCachedItems() return arrays
  test('Commerce provider getCachedActions() returns array when no data cached', () => {
    const { createCommerceExplorer } = require('@/lang/cloud/cloudCommerceExplorer');
    const provider = createCommerceExplorer(createCloudMockVscode(), makeMockContext());
    assert.ok(Array.isArray(provider.getCachedActions()));
    assert.strictEqual(provider.getCachedActions().length, 0);
  });

  test('Commerce provider getCachedItems() returns array when no data cached', () => {
    const { createCommerceExplorer } = require('@/lang/cloud/cloudCommerceExplorer');
    const provider = createCommerceExplorer(createCloudMockVscode(), makeMockContext());
    assert.ok(Array.isArray(provider.getCachedItems()));
    assert.strictEqual(provider.getCachedItems().length, 0);
  });

  // 18. Config provider getCachedItems()
  test('Config provider getCachedItems() returns array when no families cached', () => {
    const { createConfigExplorer } = require('@/lang/cloud/cloudConfigExplorer');
    const provider = createConfigExplorer(createCloudMockVscode(), makeMockContext());
    assert.ok(Array.isArray(provider.getCachedItems()));
    assert.strictEqual(provider.getCachedItems().length, 0);
  });

  // 19. DataTables provider getCachedItems()
  test('DataTables provider getCachedItems() returns array when no tables cached', () => {
    const { createCloudDataTablesProvider } = require('@/lang/cloud/cloudDataTables');
    const provider = createCloudDataTablesProvider(createCloudMockVscode(), makeMockContext());
    assert.ok(Array.isArray(provider.getCachedItems()));
    assert.strictEqual(provider.getCachedItems().length, 0);
  });
});
