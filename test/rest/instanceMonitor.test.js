const assert = require('assert');
const { InstanceMonitor } = require('@/lang/rest/instanceMonitor');
const { createFakeVscode } = require('@/test/rest/testHelpers');
const { baseVscodeConfig } = require('@/test/rest/commands/fixtures');

suite('CPQ Instance Monitor & Health Check - Unit Tests', () => {
  test('returns disconnected status when credentials are not configured', async () => {
    const monitor = new InstanceMonitor();
    const fakeVscode = createFakeVscode({
      config: { 'connection.siteUrl': '' }
    });

    const res = await monitor.checkHealth(fakeVscode);
    assert.strictEqual(res.connected, false);
    assert.strictEqual(res.reason, 'Credentials not configured');
  });

  test('probes instance health and calculates latency correctly', async () => {
    const monitor = new InstanceMonitor();
    const fakeVscode = createFakeVscode({
      config: baseVscodeConfig()
    });

    const transport = async (opts) => {
      assert.strictEqual(opts.method, 'GET');
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify({ version: 'v17', patch: '24C' })
      };
    };

    const res = await monitor.checkHealth(fakeVscode, transport);
    assert.strictEqual(res.connected, true);
    assert.ok(res.latencyMs >= 0);
    assert.strictEqual(res.siteName, 'sitename');
    assert.ok(monitor.statusBarItem.text.includes('sitename'));
  });
});
