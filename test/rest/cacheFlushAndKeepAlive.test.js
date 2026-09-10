const assert = require('assert');
const { flushServerCache } = require('@/lang/rest/commands/cacheFlush');
const { SessionKeepAlive } = require('@/lang/rest/sessionKeepAlive');
const { createFakeVscode } = require('./testHelpers');
const { baseVscodeConfig } = require('./commands/fixtures');

suite('Cache Flush & Session Keep-Alive - Unit Tests', () => {
  test('flushServerCache triggers server-side cache invalidation', async () => {
    const fakeVscode = createFakeVscode({
      config: baseVscodeConfig()
    });

    let requestedPath = '';
    let requestedMethod = '';
    const transport = async (opts) => {
      requestedPath = opts.path;
      requestedMethod = opts.method;
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify({ status: 'SUCCESS' })
      };
    };

    const res = await flushServerCache(fakeVscode, transport);
    assert.strictEqual(res.success, true);
    assert.strictEqual(requestedMethod, 'POST');
    assert.ok(requestedPath.includes('_flushCache'));
  });

  test('SessionKeepAlive pings instance and handles successful heartbeat', async () => {
    const keepAlive = new SessionKeepAlive();
    const fakeVscode = createFakeVscode({
      config: baseVscodeConfig()
    });

    const transport = async (opts) => {
      assert.strictEqual(opts.method, 'GET');
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify({ status: 'UP' })
      };
    };

    const res = await keepAlive.ping(fakeVscode, transport);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(keepAlive.lastPingTime instanceof Date);
  });

  test('SessionKeepAlive detects 401 unauthenticated session and notifies', async () => {
    const keepAlive = new SessionKeepAlive();
    let warningShown = false;
    const fakeVscode = createFakeVscode({
      config: baseVscodeConfig(),
      window: {
        showWarningMessage: () => { warningShown = true; }
      }
    });

    const transport = async () => {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify({ error: 'Unauthorized' })
      };
    };

    const res = await keepAlive.ping(fakeVscode, transport);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(warningShown, true);
  });
});
