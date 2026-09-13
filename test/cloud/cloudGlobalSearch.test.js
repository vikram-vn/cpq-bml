const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  findWorkspaceBmlFiles,
  searchLocalWorkspaceBml,
  extractMatchingSnippet,
  detectActiveProcess,
  consolidateCloudResults,
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

  test('runGlobalBmlSearch executes search directly from active editor selection without showing input box', async () => {
    let capturedOptions = null;
    let quickPickShown = false;
    const mockVscode = createMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }]
      },
      window: {
        activeTextEditor: {
          selection: { isEmpty: false },
          document: {
            getText: () => 'calculateTax'
          }
        },
        showInputBox: async (opts) => {
          capturedOptions = opts;
          return opts.value;
        },
        showQuickPick: async () => {
          quickPickShown = true;
          return null;
        }
      }
    });

    await runGlobalBmlSearch({}, mockVscode);
    assert.strictEqual(capturedOptions, null, 'showInputBox should not be called when text is selected');
    assert.strictEqual(quickPickShown, true, 'search should execute directly');
  });

  test('runGlobalBmlSearch prefills input box from word under cursor when selection is empty', async () => {
    let capturedOptions = null;
    const mockVscode = createMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }]
      },
      window: {
        activeTextEditor: {
          selection: { isEmpty: true, active: { line: 0, character: 5 } },
          document: {
            getWordRangeAtPosition: () => ({ start: 0, end: 8 }),
            getText: () => 'statusId'
          }
        },
        showInputBox: async (opts) => {
          capturedOptions = opts;
          return opts.value;
        }
      }
    });

    await runGlobalBmlSearch({}, mockVscode);
    assert.ok(capturedOptions);
    assert.strictEqual(capturedOptions.value, 'statusId');
    assert.deepStrictEqual(capturedOptions.valueSelection, [0, 8]);
  });

  test('extractMatchingSnippet highlights matching line and eliminates broken newline characters', () => {
    const script = '//default to starting status\nstatus = status_t;\nstatusDict = dict("integer");\n';
    
    // Non-comment code match preferred
    const res1 = extractMatchingSnippet(script, 'status', null);
    assert.strictEqual(res1.lineNum, 2);
    assert.strictEqual(res1.snippet, 'Line 2: status = status_t;');
    assert.ok(!res1.snippet.includes('\n'), 'Snippet must not contain newlines');

    // Comment fallback when only comment matches
    const res2 = extractMatchingSnippet(script, 'starting', null);
    assert.strictEqual(res2.lineNum, 1);
    assert.strictEqual(res2.snippet, 'Line 1: //default to starting status');

    // First non-comment code line when query does not match body
    const res3 = extractMatchingSnippet(script, 'unrelatedFunc', null);
    assert.strictEqual(res3.lineNum, 2);
    assert.strictEqual(res3.snippet, 'Line 2: status = status_t;');

    // Raw snippet sanitization when scriptText is null
    const res4 = extractMatchingSnippet(null, 'query', 'first line\nsecond line\nthird');
    assert.strictEqual(res4.snippet, 'first line second line third');
    assert.ok(!res4.snippet.includes('\n'));
  });

  test('consolidateCloudResults collapses duplicate functions across processes and prioritizes active process', () => {
    const rawCloudItems = [
      { name: 'transactionStatus', type: 'Commerce Library Function', process: 'Prodtec Quote Process GRP03', document: 'Transaction', scriptText: 'status = status_t;' },
      { name: 'transactionStatus', type: 'Commerce Library Function', process: 'Demo', document: 'Transaction', scriptText: 'status = status_t;' },
      { name: 'transactionStatus', type: 'Commerce Library Function', process: 'oraclecpqo', document: 'Transaction', scriptText: 'status = status_t;' },
      { name: 'transactionStatus', type: 'Commerce Library Function', process: 'Sales Process', document: 'Transaction', scriptText: 'status = status_t;' },
      { name: 'customPricing', type: 'Commerce Library Function', process: 'oraclecpqo', document: 'Transaction', scriptText: 'return 100.0;' },
    ];

    const consolidated = consolidateCloudResults(rawCloudItems, 'oraclecpqo');
    // 5 items should be consolidated to 2 unique items
    assert.strictEqual(consolidated.length, 2);

    const statusItem = consolidated.find(it => it.name === 'transactionStatus');
    assert.ok(statusItem);
    // Active process 'oraclecpqo' should be primary
    assert.strictEqual(statusItem.process, 'oraclecpqo');
    assert.strictEqual(statusItem.isConsolidated, true);
    assert.strictEqual(statusItem.otherProcesses.length, 3);
    assert.ok(statusItem.otherProcesses.includes('Prodtec Quote Process GRP03'));
    assert.ok(statusItem.otherProcesses.includes('Demo'));
    assert.ok(statusItem.otherProcesses.includes('Sales Process'));

    // Non-duplicate item remains single
    const pricingItem = consolidated.find(it => it.name === 'customPricing');
    assert.ok(pricingItem);
    assert.strictEqual(pricingItem.isConsolidated, undefined);
  });

  test('runGlobalBmlSearch deduplicates identical functions in QuickPick popup', async () => {
    api.searchBmlScripts = async function () {
      return {
        statusCode: 200,
        body: {
          items: [
            {
              name: 'Transaction Status',
              componentType: 'Commerce Library Function',
              commerceProcess: 'Prodtec Quote Process GRP03',
              commerceDocument: 'Transaction',
              scriptText: '//default to starting status\nstatus = status_t;\nstatusDict = dict("integer");\n'
            },
            {
              name: 'Transaction Status',
              componentType: 'Commerce Library Function',
              commerceProcess: 'Demo',
              commerceDocument: 'Transaction',
              scriptText: '//default to starting status\nstatus = status_t;\nstatusDict = dict("integer");\n'
            },
            {
              name: 'Transaction Status',
              componentType: 'Commerce Library Function',
              commerceProcess: 'oraclecpqo',
              commerceDocument: 'Transaction',
              scriptText: '//default to starting status\nstatus = status_t;\nstatusDict = dict("integer");\n'
            },
            {
              name: 'Transaction Status',
              componentType: 'Commerce Library Function',
              commerceProcess: 'Sales Process',
              commerceDocument: 'Transaction',
              scriptText: '//default to starting status\nstatus = status_t;\nstatusDict = dict("integer");\n'
            }
          ]
        }
      };
    };

    const mockVscode = createMockVscode({
      workspace: {
        workspaceFolders: [{ uri: { fsPath: tempDir } }],
        getConfiguration: () => ({
          get: (key, def) => {
            if (key === 'connection.siteUrl') return 'https://test.bigmachines.com';
            if (key === 'connection.username') return 'testuser';
            if (key === 'commerce.process') return 'oraclecpqo';
            return def;
          }
        })
      }
    });

    await runGlobalBmlSearch({}, mockVscode, 'status');
    const items = mockVscode.getQuickPickItems();
    assert.ok(items);

    // Should only have 1 cloud match item instead of 4
    const cloudItems = items.filter(it => it.data && it.data.source === 'CPQ Cloud');
    assert.strictEqual(cloudItems.length, 1, 'Should consolidate 4 identical process items into 1 QuickPick item');

    const primary = cloudItems[0];
    assert.strictEqual(primary.label, '$(cloud) Transaction Status');
    // Description should indicate the active process and mention the others
    assert.ok(primary.description.includes('oraclecpqo'), 'Primary process should be active process oraclecpqo');
    assert.ok(primary.description.includes('+3 other processes'), 'Description should count other processes');
    // Detail must show the clean line without newline characters
    assert.ok(!primary.detail.includes('\n'), 'Detail must not contain newline characters');
    assert.ok(primary.detail.includes('Line 2: status = status_t;'), 'Detail should highlight matching line');
    assert.ok(primary.detail.includes('Also in:'), 'Detail should list other processes');
  });
});

