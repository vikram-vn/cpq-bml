const assert = require('assert');
const { BmlCodeLensProvider } = require('@/lang/codelens/bmlCodeLensProvider');
const { parseBmqlQuery, extractBmqlQueryAtCursor } = require('@/lang/cloud/bmqlRunner');
const { lookupAttributeAtCursor } = require('@/lang/cloud/attributeLookup');
const { debugWithQuoteCommand, createTransactionsProvider } = require('@/lang/cloud/cloudTransactions');
const { toggleLogStream, isStreamingLogs } = require('@/lang/rest/commands/logs');
const api = require('@/lang/rest/api');
const { createCloudMockVscode: createMockVscode } = require('./cloudTestMocks');

suite('CPQ Cloud Workflow Features - Unit Tests', () => {
  let mockVscode;
  const origGetTransactions = api.getTransactions;
  const origGetDataTableSchema = api.getDataTableSchema;

  setup(() => {
    mockVscode = createMockVscode();
  });

  teardown(() => {
    api.getTransactions = origGetTransactions;
    api.getDataTableSchema = origGetDataTableSchema;
  });

  suite('BmlCodeLensProvider', () => {
    test('provides top-of-file and BMQL inline CodeLenses for BML document', () => {
      const provider = new BmlCodeLensProvider(mockVscode);
      const bmlText = [
        '// Calculation script',
        'records = bmql("SELECT part_num, price FROM PartsTable WHERE price > 0");',
        'return total;'
      ].join('\n');

      const mockDoc = {
        getText: () => bmlText,
        positionAt: (offset) => {
          return new mockVscode.Position(1, 10);
        }
      };

      const lenses = provider.provideCodeLenses(mockDoc, {});
      assert.ok(Array.isArray(lenses));
      assert.strictEqual(lenses.length, 5); // 4 top lenses + 1 BMQL lens

      // Verify top lenses
      const commands = lenses.map(l => l.command?.command);
      assert.ok(commands.includes('cpqBml.rest.debugCurrentFile'));
      assert.ok(commands.includes('cpqBml.cloud.debugWithQuote'));
      assert.ok(commands.includes('cpqBml.cloud.diffFunction'));
      assert.ok(commands.includes('cpqBml.rest.preflightCheck'));

      // Verify BMQL live lens
      const bmqlLens = lenses.find(l => l.command?.command === 'cpqBml.bmql.runAtCursor');
      assert.ok(bmqlLens);
      assert.strictEqual(bmqlLens.command.title, '$(play) Run BMQL Live');
      assert.ok(bmqlLens.command.arguments[0].query.includes('PartsTable'));
    });

    test('respects configuration when features.codeLens is disabled', () => {
      const customMockVscode = {
        ...mockVscode,
        workspace: {
          getConfiguration: (section) => ({
            get: (key, defVal) => {
              if (key === 'features.codeLens') return false;
              return defVal;
            }
          })
        }
      };

      const provider = new BmlCodeLensProvider(customMockVscode);
      const mockDoc = {
        getText: () => 'return 42;'
      };

      const lenses = provider.provideCodeLenses(mockDoc, {});
      assert.deepStrictEqual(lenses, []);
    });

    test('returns empty array when cancellation is requested or document is empty', () => {
      const provider = new BmlCodeLensProvider(mockVscode);
      assert.deepStrictEqual(provider.provideCodeLenses(null, {}), []);
      assert.deepStrictEqual(provider.provideCodeLenses({ getText: () => '   ' }, {}), []);
      assert.deepStrictEqual(provider.provideCodeLenses({ getText: () => 'foo' }, { isCancellationRequested: true }), []);
    });
  });

  suite('bmqlRunner', () => {
    test('parseBmqlQuery parses standard SELECT ... FROM ... WHERE ... statements', () => {
      const query = 'SELECT partNumber, listPrice, discount FROM PricingRules WHERE status == \'Active\' ORDER BY partNumber';
      const parsed = parseBmqlQuery(query);

      assert.ok(parsed);
      assert.strictEqual(parsed.tableName, 'PricingRules');
      assert.deepStrictEqual(parsed.fields, ['partNumber', 'listPrice', 'discount']);
      assert.strictEqual(parsed.whereClause, "status == 'Active'");
    });

    test('parseBmqlQuery parses wildcard SELECT * queries', () => {
      const query = 'SELECT * FROM TierMatrix';
      const parsed = parseBmqlQuery(query);

      assert.ok(parsed);
      assert.strictEqual(parsed.tableName, 'TierMatrix');
      assert.deepStrictEqual(parsed.fields, ['*']);
      assert.strictEqual(parsed.whereClause, null);
    });

    test('parseBmqlQuery strips SQL/BML comments', () => {
      const query = '/* Fetch active tiers */ SELECT id FROM Tiers // line comment';
      const parsed = parseBmqlQuery(query);

      assert.ok(parsed);
      assert.strictEqual(parsed.tableName, 'Tiers');
      assert.deepStrictEqual(parsed.fields, ['id']);
    });

    test('parseBmqlQuery returns null for invalid query strings', () => {
      assert.strictEqual(parseBmqlQuery(null), null);
      assert.strictEqual(parseBmqlQuery(''), null);
      assert.strictEqual(parseBmqlQuery('var x = 123;'), null);
    });

    test('extractBmqlQueryAtCursor extracts bmql query enclosing cursor position', () => {
      const code = 'string s = "test";\nrs = bmql("SELECT colA FROM MyTable WHERE id == 1");\nreturn s;';
      const mockDoc = {
        getText: () => code,
        offsetAt: (pos) => 35, // inside bmql("...")
        positionAt: (idx) => new mockVscode.Position(1, idx)
      };

      const extracted = extractBmqlQueryAtCursor(mockDoc, new mockVscode.Position(1, 15));
      assert.ok(extracted);
      assert.strictEqual(extracted.rawQuery, 'SELECT colA FROM MyTable WHERE id == 1');
    });

    test('extractBmqlQueryAtCursor falls back to first match when position not specified', () => {
      const code = 'rs = bmql("SELECT colB FROM FallbackTable");';
      const mockDoc = {
        getText: () => code
      };

      const extracted = extractBmqlQueryAtCursor(mockDoc, null);
      assert.ok(extracted);
      assert.strictEqual(extracted.rawQuery, 'SELECT colB FROM FallbackTable');
    });
  });

  suite('attributeLookup', () => {
    test('lookupAttributeAtCursor resolves Data Table schema when table is queried', async () => {
      api.getDataTableSchema = async () => ({
        statusCode: 200,
        body: {
          name: 'DiscountMatrix',
          description: 'Tiered discount rates table',
          columns: [
            { name: 'tier', type: 'String', primaryKey: true },
            { name: 'minQty', type: 'Integer' },
            { name: 'discountPercent', type: 'Float' }
          ]
        }
      });

      let openedContent = null;
      mockVscode.workspace.openTextDocument = async (opts) => {
        openedContent = opts.content;
        return { languageId: opts.language };
      };
      mockVscode.window.showTextDocument = async () => true;

      const result = await lookupAttributeAtCursor({}, mockVscode, 'DiscountMatrix');
      assert.ok(result.success);
      assert.strictEqual(result.type, 'dataTable');
      assert.ok(openedContent.includes('DiscountMatrix'));
      assert.ok(openedContent.includes('discountPercent'));
    });

    test('lookupAttributeAtCursor handles cancelled user input gracefully', async () => {
      mockVscode.window.showInputBox = async () => null;
      const result = await lookupAttributeAtCursor({}, mockVscode, '');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'Lookup cancelled or empty');
    });
  });

  suite('debugWithQuoteCommand', () => {
    test('debugWithQuoteCommand prompts QuickPick with formatted transactions and invokes debug', async () => {
      api.getTransactions = async () => ({
        statusCode: 200,
        body: {
          items: [
            {
              _id: '1001',
              transactionID_t: 'Q-9901',
              customer_t: 'Acme International',
              status_t: 'Approved',
              transactionName_t: 'Server Upgrade',
              _date_modified: '2026-09-12'
            }
          ]
        }
      });

      let quickPickItems = null;
      mockVscode.window.showQuickPick = async (items) => {
        quickPickItems = items;
        return items[0]; // select first
      };

      let executedCommand = null;
      let executedArgs = null;
      mockVscode.commands.executeCommand = async (cmd, ...args) => {
        executedCommand = cmd;
        executedArgs = args;
        return true;
      };

      const treeProvider = createTransactionsProvider(mockVscode, {});
      const result = await debugWithQuoteCommand(treeProvider, mockVscode, {});

      assert.ok(result.success);
      assert.strictEqual(result.transactionId, 'Q-9901');
      assert.ok(quickPickItems.length > 0);
      assert.ok(quickPickItems[0].label.includes('Q-9901'));
      assert.ok(quickPickItems[0].description.includes('Acme International'));
      assert.strictEqual(executedCommand, 'cpqBml.rest.debugExecution');
      assert.deepStrictEqual(executedArgs, [{ transactionId: '1001' }]);
    });

    test('debugWithQuoteCommand returns cancelled when user dismisses QuickPick', async () => {
      api.getTransactions = async () => ({
        statusCode: 200,
        body: {
          items: [{ _id: '1001', transactionID_t: 'Q-9901' }]
        }
      });

      mockVscode.window.showQuickPick = async () => null;

      const treeProvider = createTransactionsProvider(mockVscode, {});
      const result = await debugWithQuoteCommand(treeProvider, mockVscode, {});
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'Cancelled');
    });
  });

  suite('Status Bar Log Stream Toggle', () => {
    test('toggleLogStream switches log stream state and updates status bar text', () => {
      const status = toggleLogStream(mockVscode);
      assert.strictEqual(status.streaming, true);
      assert.strictEqual(isStreamingLogs(), true);

      const statusAfterSecondToggle = toggleLogStream(mockVscode);
      assert.strictEqual(statusAfterSecondToggle.streaming, false);
      assert.strictEqual(isStreamingLogs(), false);
    });
  });
});
