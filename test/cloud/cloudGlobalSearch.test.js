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

const { createCloudMockVscode: createMockVscode } = require('./cloudTestMocks');

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

  test('runGlobalBmlSearch includes Data Tables and Transactions in search results', async () => {
    const origListDt = api.listDataTables;
    const origGetTx = api.getTransactions;

    api.listDataTables = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { name: 'TaxRates', description: 'Tax rate tables by jurisdiction' },
            { name: 'DiscountMatrix', description: 'Discount tiers' }
          ]
        }
      };
    };

    api.getTransactions = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            { _id: '1001', transactionID_t: 'TX-TAX-01', customer_t: 'Acme Corp', status_t: 'Draft' },
            { _id: '1002', transactionID_t: 'TX-DISC-02', customer_t: 'Globex', status_t: 'Active' }
          ]
        }
      };
    };

    try {
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

      await runGlobalBmlSearch({}, mockVscode, 'Tax');
      const items = mockVscode.getQuickPickItems();
      assert.ok(items);

      // Verify Data Table match
      assert.ok(items.some(it => it.label && it.label.includes('Data Table Matches')));
      const dtItem = items.find(it => it.data && it.data.category === 'datatable');
      assert.ok(dtItem);
      assert.strictEqual(dtItem.data.name, 'TaxRates');

      // Verify Transaction match
      assert.ok(items.some(it => it.label && it.label.includes('Transaction Matches')));
      const txItem = items.find(it => it.data && it.data.category === 'transaction');
      assert.ok(txItem);
      assert.strictEqual(txItem.data.name, 'TX-TAX-01');
    } finally {
      api.listDataTables = origListDt;
      api.getTransactions = origGetTx;
    }
  });
});

