const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
  runGlobalBmlSearch
} = require('@/lang/cloud/cloudGlobalSearch');
const api = require('@/lang/rest/api');

function createMockVscode(overrides = {}) {
  let openedDoc = null;
  let shownDoc = null;
  let infoMsg = null;
  let quickPickItems = null;
  let quickPickSelected = null;

  const mock = {
    workspace: {
      workspaceFolders: [],
      openTextDocument: async function (target) {
        openedDoc = target;
        return target;
      }
    },
    window: {
      showInputBox: async function () {
        return 'testFunc';
      },
      showQuickPick: async function (items, opts) {
        quickPickItems = items;
        if (typeof quickPickSelected === 'function') {
          return quickPickSelected(items);
        }
        return quickPickSelected || items.find(it => it.data);
      },
      showInformationMessage: function (msg) {
        infoMsg = msg;
      },
      showErrorMessage: function (msg) {},
      showWarningMessage: function (msg) {},
      showTextDocument: async function (doc) {
        shownDoc = doc;
        return {
          selection: null,
          revealRange: function () {}
        };
      },
      withProgress: async function (opt, task) {
        return task({ report: function () {} });
      }
    },
    commands: {
      registerCommand: function () {
        return { dispose: function () {} };
      }
    },
    Uri: {
      file: function (f) {
        return { fsPath: f, scheme: 'file' };
      }
    },
    Position: function (l, c) {
      this.line = l;
      this.char = c;
    },
    Range: function (start, end) {
      this.start = start;
      this.end = end;
    },
    getOpenedDoc: function () { return openedDoc; },
    getShownDoc: function () { return shownDoc; },
    getInfoMsg: function () { return infoMsg; },
    getQuickPickItems: function () { return quickPickItems; },
    setQuickPickSelected: function (sel) { quickPickSelected = sel; }
  };

  if (overrides) {
    Object.assign(mock, overrides);
  }
  return mock;
}

suite('CPQ Global BML Script Search - Unit Tests', () => {
  let tempDir;
  const origSearchBmlScripts = api.searchBmlScripts;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bml-search-test-'));
    fs.mkdirSync(path.join(tempDir, 'subfolder'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'sample.bml'),
      'print("hello world");\nreturn calculateTax(amount);\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'subfolder', 'nested.bml'),
      '// nested file\nstring res = calculateTax(total);\nreturn res;\n',
      'utf8'
    );

    api.searchBmlScripts = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            {
              name: 'calculateTax',
              componentType: 'Util Library Function',
              scriptText: 'float calculateTax(float amt) { return amt * 0.08; }'
            }
          ]
        }
      };
    };
  });

  teardown(() => {
    api.searchBmlScripts = origSearchBmlScripts;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test('findWorkspaceBmlFiles recursively discovers .bml and .bmlt files', () => {
    const files = findWorkspaceBmlFiles(tempDir);
    assert.strictEqual(files.length, 2);
    assert.ok(files.some(f => f.endsWith('sample.bml')));
    assert.ok(files.some(f => f.endsWith('nested.bml')));
  });

  test('searchLocalWorkspaceBml identifies matching lines with correct line numbers', () => {
    const matches = searchLocalWorkspaceBml(tempDir, 'calculateTax');
    assert.strictEqual(matches.length, 2);

    const sampleMatch = matches.find(m => m.file.endsWith('sample.bml'));
    assert.ok(sampleMatch);
    assert.strictEqual(sampleMatch.line, 2);
    assert.ok(sampleMatch.lineText.includes('calculateTax'));

    const nestedMatch = matches.find(m => m.file.endsWith('nested.bml'));
    assert.ok(nestedMatch);
    assert.strictEqual(nestedMatch.line, 2);
  });

  test('runGlobalBmlSearch combines cloud and local results and opens selected item', async () => {
    const mockVscode = createMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: function () {
          return {
            get: function (key, def) {
              if (key === 'connection.siteUrl') return 'https://test.bigmachines.com';
              if (key === 'connection.username') return 'testuser';
              return def;
            }
          };
        },
        openTextDocument: async function (target) {
          mockVscode._openedTarget = target;
          return target;
        }
      }
    });

    await runGlobalBmlSearch({}, mockVscode, 'calculateTax');
    const items = mockVscode.getQuickPickItems();
    assert.ok(items);
    assert.ok(items.some(it => it.label && it.label.includes('Cloud Matches')));
    assert.ok(items.some(it => it.label && it.label.includes('Local Workspace Matches')));

    // Pick cloud result
    const cloudItem = items.find(it => it.data && it.data.source === 'CPQ Cloud');
    assert.ok(cloudItem);
    assert.strictEqual(cloudItem.data.name, 'calculateTax');
  });

  test('runGlobalBmlSearch falls back gracefully to local files when cloud API is unavailable', async () => {
    api.searchBmlScripts = async function () {
      return { statusCode: 404, body: 'Not Found' };
    };

    const mockVscode = createMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: function () {
          return {
            get: function (key, def) {
              return def;
            }
          };
        },
        openTextDocument: async function (target) {
          mockVscode._openedTarget = target;
          return target;
        }
      }
    });

    await runGlobalBmlSearch({}, mockVscode, 'calculateTax');
    const items = mockVscode.getQuickPickItems();
    assert.ok(items);
    assert.ok(items.some(it => it.label && it.label.includes('Local Workspace Matches')));
    const localItem = items.find(it => it.data && it.data.file);
    assert.ok(localItem);
    assert.ok(localItem.data.file.includes(tempDir));
  });
});
