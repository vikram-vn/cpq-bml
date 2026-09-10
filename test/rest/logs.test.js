const assert = require('assert');
const { RemoteLogStreamer } = require('@/lang/rest/apiLogs');
const { createFakeVscode } = require('@/test/rest/testHelpers');
const { baseVscodeConfig } = require('@/test/rest/commands/fixtures');

suite('Remote Log Streamer - Unit Tests', () => {
  test('formats log entries with timestamp, severity, script name and line number', () => {
    const entry = {
      timestamp: '2026-09-10T08:00:00Z',
      severity: 'ERROR',
      scriptName: 'calculate_pricing',
      lineNumber: 42,
      message: 'NullPointerException encountered on line_item_dict'
    };

    const formatted = RemoteLogStreamer.formatLogEntry(entry);
    assert.strictEqual(
      formatted,
      '[2026-09-10T08:00:00Z] [ERROR] [calculate_pricing:42] NullPointerException encountered on line_item_dict'
    );
  });

  test('fetches logs successfully via REST transport', async () => {
    const streamer = new RemoteLogStreamer();
    const fakeVscode = createFakeVscode({
      config: baseVscodeConfig()
    });

    const mockLogs = {
      items: [
        { timestamp: '2026-09-10T08:01:00Z', severity: 'INFO', scriptName: 'rule_1', message: 'Executed cleanly' }
      ]
    };

    const transport = async (opts) => {
      assert.strictEqual(opts.method, 'GET');
      assert.ok(opts.path.includes('/developerLogs'));
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify(mockLogs)
      };
    };

    const logs = await streamer.fetchLogs(fakeVscode, transport);
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].scriptName, 'rule_1');
  });

  test('manages stream start and stop states cleanly', () => {
    const streamer = new RemoteLogStreamer();
    assert.strictEqual(streamer.isStreaming, false);

    streamer.isStreaming = true;
    streamer.stopStream();
    assert.strictEqual(streamer.isStreaming, false);
    assert.strictEqual(streamer.timer, null);
  });
});
