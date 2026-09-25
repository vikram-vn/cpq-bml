const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { openDataTableEditor } = require('@/lang/cloud/dataTableEditor');
const { getWebPanelHtml } = require('@/lang/web-panel/webPanelHtml');

suite('React Data Table Editor - Unit Tests', () => {
  let tmpDir;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-react-test-'));
  });

  teardown(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('getWebPanelHtml generates HTML embedding React bundle and initialDataTable', () => {
    const context = { extensionPath: path.resolve(__dirname, '..', '..') };
    const fakeWebview = {
      asWebviewUri: (uri) => uri.toString(),
      cspSource: "'self'"
    };
    const dataTableData = {
      tableName: 'AC_BOM_RULES',
      columns: [
        { name: 'part', type: 'string' },
        { name: 'qty', type: 'string' },
        { name: 'brand', type: 'string' }
      ],
      rows: [
        { part: 'COMP_NONINV_1.5', qty: '1', brand: 'LG' },
        { part: 'COIL_1.5', qty: '1', brand: 'LG' }
      ]
    };

    const html = getWebPanelHtml(context, fakeWebview, {
      page: 'datatable',
      dataTableData
    });

    assert.ok(html.includes("window.__INITIAL_PAGE__ = 'datatable';"), 'Must set initial page to datatable');
    assert.ok(html.includes('AC_BOM_RULES'), 'Must include table name in initial data');
    assert.ok(html.includes('COMP_NONINV_1.5'), 'Must include row values');
    assert.ok(html.includes('main.js'), 'Must link to compiled React bundle main.js');
    assert.ok(html.includes('main.css'), 'Must link to compiled main.css');
  });

  test('openDataTableEditor opens webview panel and responds to messages', async () => {
    let htmlContent = '';
    let messageHandler = null;
    const postedMessages = [];

    const fakePanel = {
      webview: {
        set html(val) { htmlContent = val; },
        get html() { return htmlContent; },
        asWebviewUri: (uri) => uri.toString(),
        cspSource: "'self'",
        onDidReceiveMessage: (cb) => {
          messageHandler = cb;
          return { dispose: () => {} };
        },
        postMessage: async (msg) => {
          postedMessages.push(msg);
          return true;
        }
      },
      onDidDispose: () => ({ dispose: () => {} }),
      reveal: () => {}
    };

    const fakeVscode = {
      Uri: { file: (p) => ({ toString: () => p, path: p }) },
      ViewColumn: { One: 1 },
      window: {
        createWebviewPanel: () => fakePanel,
        showInformationMessage: () => {},
        showErrorMessage: () => {}
      },
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tmpDir } }]
      }
    };

    const fakeContext = { extensionPath: path.resolve(__dirname, '..', '..') };
    const item = {
      name: 'PRICING_MATRIX',
      data: {
        name: 'PRICING_MATRIX',
        columns: [{ name: 'tier', type: 'string' }, { name: 'price', type: 'string' }]
      }
    };

    await openDataTableEditor(item, fakeVscode, fakeContext);

    assert.ok(htmlContent.includes('PRICING_MATRIX'), 'Panel must load table name');
    assert.ok(typeof messageHandler === 'function', 'Must register webview message listener');

    // Simulate saving edited rows from React component
    const updatedRows = [
      { tier: 'Gold', price: '100' },
      { tier: 'Platinum', price: '200' }
    ];

    await messageHandler({ command: 'saveRows', rows: updatedRows });

    assert.ok(postedMessages.some(m => m.type === 'saveSuccess'), 'Must post saveSuccess to webview');

    const savedFile = path.join(tmpDir, 'cpq', 'datatables', 'PRICING_MATRIX.dt.json');
    assert.ok(fs.existsSync(savedFile), 'Saved file must exist on disk');

    const content = JSON.parse(fs.readFileSync(savedFile, 'utf8'));
    assert.strictEqual(content.name, 'PRICING_MATRIX');
    assert.strictEqual(content.rows.length, 2);
    assert.strictEqual(content.rows[0].tier, 'Gold');
  });
});
