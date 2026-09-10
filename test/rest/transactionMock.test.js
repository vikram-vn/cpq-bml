const assert = require('assert');
const { TransactionMockGenerator } = require('@/lang/rest/apiTransactionMock');

suite('Transaction Mock Generator - Unit Tests', () => {
  test('extracts mock attributes while stripping sensitive credentials and hypermedia links', () => {
    const raw = {
      _transaction_id: '998877',
      _process_id: 'oraclecpqo',
      status_t: 'APPROVED',
      totalAmount_t: '1500.00',
      password: 'secretPassword123',
      token: 'jwtTokenXYZ',
      links: [{ rel: 'self', href: '/rest/v17/transactions/998877' }],
      transactionLine: {
        items: [
          { _part_number: 'PART-001', unitPrice_l: '500.00', links: [] },
          { _part_number: 'PART-002', unitPrice_l: '1000.00', password: 'bad' }
        ]
      }
    };

    const mock = TransactionMockGenerator.extractMockAttributes(raw);

    assert.strictEqual(mock.transactionId, '998877');
    assert.strictEqual(mock.process, 'oraclecpqo');
    assert.strictEqual(mock.header.status_t, 'APPROVED');
    assert.strictEqual(mock.header.totalAmount_t, '1500.00');

    // Sensitive properties must be stripped
    assert.strictEqual(mock.header.password, undefined);
    assert.strictEqual(mock.header.token, undefined);
    assert.strictEqual(mock.header.links, undefined);

    // Line items
    assert.strictEqual(mock.lines.length, 2);
    assert.strictEqual(mock.lines[0]._part_number, 'PART-001');
    assert.strictEqual(mock.lines[0].links, undefined);
    assert.strictEqual(mock.lines[1].password, undefined);
  });

  test('generates valid BML unit test scaffolding with mock attributes and assertions', () => {
    const mock = {
      transactionId: '12345',
      process: 'oraclecpqo',
      header: {
        transactionCurrency_t: 'EUR',
        totalAmount_t: '250.0'
      },
      lines: [
        { _part_number: 'SERVER-BLADE-X', unitPrice_l: '250.0' }
      ]
    };

    const code = TransactionMockGenerator.generateBmlTestScaffold(mock);

    assert.ok(code.includes('// @test "Validate Header Attributes for Quote #12345"'));
    assert.ok(code.includes('currency = "EUR";'));
    assert.ok(code.includes('totalAmount = 250;'));
    assert.ok(code.includes('assert.equals(quoteId, "12345"'));
    assert.ok(code.includes('// @test "Verify Line Items Count and Pricing"'));
    assert.ok(code.includes('firstPart = "SERVER-BLADE-X";'));
  });

  test('fetchRecentTransactions queries and formats recent transactions using custom transport', async () => {
    const mockTransport = async (options) => {
      assert.ok(options.path.includes('/commerceProcesses/oraclecpqo/transactions'));
      assert.ok(options.path.includes('limit=10'));
      assert.ok(options.path.includes('orderBy=dateModified:desc'));
      return {
        statusCode: 200,
        text: JSON.stringify({
          items: [
            {
              _transaction_id: '1001',
              status_t: 'CREATED',
              totalAmount_t: '500.00',
              transactionCurrency_t: 'USD',
              dateModified: '2026-09-09T10:00:00Z'
            },
            {
              _transaction_id: '1002',
              status_t: 'WON',
              totalAmount_t: '12000.00',
              transactionCurrency_t: 'USD',
              dateModified: '2026-09-08T15:30:00Z'
            }
          ]
        })
      };
    };

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: (key, fallback) => {
            if (key === 'connection.siteUrl') return 'https://testsite.bigmachines.com';
            if (key === 'connection.username') return 'testUser';
            return fallback;
          }
        })
      }
    };

    const results = await TransactionMockGenerator.fetchRecentTransactions('oraclecpqo', 10, mockVscode, mockTransport);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, '1001');
    assert.strictEqual(results[0].status, 'CREATED');
    assert.strictEqual(results[0].amount, '500.00 USD');
    assert.strictEqual(results[0].lastModified, '2026-09-09T10:00:00Z');
    assert.strictEqual(results[1].id, '1002');
  });

  test('fetchRecentTransactions rejects when server responds with error', async () => {
    const mockTransport = async () => ({
      statusCode: 403,
      body: { message: 'Insufficient privileges' }
    });

    const mockVscode = {
      workspace: {
        getConfiguration: () => ({
          get: (key, fallback) => {
            if (key === 'connection.siteUrl') return 'https://testsite.bigmachines.com';
            if (key === 'connection.username') return 'testUser';
            return fallback;
          }
        })
      }
    };

    await assert.rejects(
      async () => {
        await TransactionMockGenerator.fetchRecentTransactions('oraclecpqo', 5, mockVscode, mockTransport);
      },
      /HTTP 403/
    );
  });
});

