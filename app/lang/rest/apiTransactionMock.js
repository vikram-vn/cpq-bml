const { request } = require('@/lang/rest/client');
const { getBaseUrl, getAuthHeader, getRestVersion, getCommerceProcess, getSettings, isConfigured } = require('@/lang/rest/config');

/**
 * Fetches real CPQ Commerce Transaction payloads and converts them
 * into clean test mocks and executable BML unit test fixtures.
 */
async function fetchTransaction(transId, proc, vscodeInstance, customTransport, context) {
  const baseUrl = getBaseUrl(vscodeInstance);
  if (!baseUrl) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }
  let authHeader = "";
  try {
    authHeader = await getAuthHeader(context, vscodeInstance);
  } catch (err) {
    if (!customTransport) throw err;
  }
  if (!authHeader && !customTransport) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const process = proc || getCommerceProcess(vscodeInstance) || 'oraclecpqo';
  const path = `/rest/${version}/commerceProcesses/${process}/transactions/${transId}?expand=transactionLine`;

  const res = await request({
    baseUrl,
    path,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 20000,
    transport: customTransport
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.body || {};
  } else {
    const err = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    throw new Error(`HTTP ${res.statusCode}: ${err || 'Failed to fetch transaction'}`);
  }
}

function extractMockAttributes(rawPayload = {}) {
  const headerAttrs = {};
  const sensitiveKeys = new Set(['links', 'href', 'referencesUrl', 'password', 'token', '_user_session_id']);

  for (const [key, val] of Object.entries(rawPayload)) {
    if (sensitiveKeys.has(key) || key === 'transactionLine') continue;
    if (val !== null && typeof val !== 'function') {
      headerAttrs[key] = val;
    }
  }

  const lines = [];
  const rawLines = rawPayload.transactionLine?.items || (Array.isArray(rawPayload.transactionLine) ? rawPayload.transactionLine : []);
  for (const line of rawLines) {
    const lineAttrs = {};
    for (const [k, v] of Object.entries(line)) {
      if (!sensitiveKeys.has(k) && typeof v !== 'function') {
        lineAttrs[k] = v;
      }
    }
    lines.push(lineAttrs);
  }

  return {
    transactionId: rawPayload._transaction_id || rawPayload.bs_id || 'unknown',
    process: rawPayload._process_id || 'oraclecpqo',
    header: headerAttrs,
    lines
  };
}

function generateBmlTestScaffold(mockData) {
  const lines = [];
  lines.push(`// =========================================================================`);
  lines.push(`// CPQ BML Unit Test Scaffolding for Transaction #${mockData.transactionId}`);
  lines.push(`// Auto-generated from Live CPQ REST Payload`);
  lines.push(`// =========================================================================\n`);

  lines.push(`// @test "Validate Header Attributes for Quote #${mockData.transactionId}"`);
  lines.push(`quoteId = "${mockData.transactionId}";`);
  lines.push(`currency = "${mockData.header.transactionCurrency_t || 'USD'}";`);
  if (mockData.header.totalAmount_t !== undefined) {
    lines.push(`totalAmount = ${parseFloat(mockData.header.totalAmount_t) || 0.0};`);
    lines.push(`assert.isTrue(totalAmount >= 0.0, "Total amount should be non-negative");`);
  }
  lines.push(`assert.equals(quoteId, "${mockData.transactionId}", "Quote ID should match");\n`);

  if (mockData.lines.length > 0) {
    lines.push(`// @test "Verify Line Items Count and Pricing"`);
    lines.push(`lineCount = ${mockData.lines.length};`);
    lines.push(`assert.isTrue(lineCount > 0, "Transaction should contain line items");`);
    const firstLine = mockData.lines[0];
    if (firstLine._part_number) {
      lines.push(`firstPart = "${firstLine._part_number}";`);
      lines.push(`assert.notNull(firstPart, "First line item part number should not be null");`);
    }
  }

  return lines.join('\n');
}

/**
 * Fetches recent live transactions from CPQ for interactive QuickPick selection.
 */
async function fetchRecentTransactions(proc, limit = 15, vscodeInstance, customTransport, context) {
  const baseUrl = getBaseUrl(vscodeInstance);
  if (!baseUrl) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }
  let authHeader = "";
  try {
    authHeader = await getAuthHeader(context, vscodeInstance);
  } catch (err) {
    if (!customTransport) throw err;
  }
  if (!authHeader && !customTransport) {
    throw new Error('CPQ site URL or credentials are not configured.');
  }

  const version = getRestVersion(vscodeInstance);
  const process = proc || getCommerceProcess(vscodeInstance) || 'oraclecpqo';
  const path = `/rest/${version}/commerceProcesses/${process}/transactions?limit=${limit}&orderBy=dateModified:desc`;

  const res = await request({
    baseUrl,
    path,
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json'
    },
    timeoutMs: getSettings(vscodeInstance).timeoutMs || 20000,
    transport: customTransport
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    let body = res.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const items = body.items || (Array.isArray(body) ? body : []);
    return items.map(t => {
      const id = t._transaction_id || t.bs_id || t.id || t.transactionNumber || 'unknown';
      const lastModified = t.dateModified || t._date_modified || '';
      const status = t.status_t || t.status || t.statusName || '';
      const amount = t.totalAmount_t || t.totalAmount || '';
      const currency = t.transactionCurrency_t || '';
      return {
        id: String(id),
        process,
        lastModified,
        status,
        amount: amount ? `${amount} ${currency}`.trim() : '',
        raw: t
      };
    });
  } else {
    const err = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
    throw new Error(`HTTP ${res.statusCode}: ${err || 'Failed to fetch transactions'}`);
  }
}

const TransactionMockGenerator = {
  fetchTransaction,
  fetchRecentTransactions,
  extractMockAttributes,
  generateBmlTestScaffold
};

module.exports = {
  fetchTransaction,
  fetchRecentTransactions,
  extractMockAttributes,
  generateBmlTestScaffold,
  TransactionMockGenerator
};

