const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  saveSnapshot,
  listSnapshots,
  getSnapshot,
  rollbackSnapshot
} = require('@/lang/rest/snapshotManager');

suite('Snapshot Manager & Rollback Engine - Unit Tests', () => {
  let tempWs;

  setup(() => {
    tempWs = fs.mkdtempSync(path.join(os.tmpdir(), 'cpq-snap-test-'));
  });

  teardown(() => {
    try {
      fs.rmSync(tempWs, { recursive: true, force: true });
    } catch {}
  });

  test('saves and lists snapshots for a function', () => {
    const snap1 = saveSnapshot({
      workspaceRoot: tempWs,
      variableName: 'calcTaxes',
      functionType: 'util',
      environment: 'https://testsite.bigmachines.com',
      remoteContent: 'return 10.0;',
      localContent: 'return 15.0;',
      metadata: { variableName: 'calcTaxes' }
    });

    assert.ok(snap1);
    assert.strictEqual(snap1.variableName, 'calcTaxes');
    assert.strictEqual(snap1.remoteContent, 'return 10.0;');

    const list = listSnapshots('calcTaxes', tempWs);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, snap1.id);
  });

  test('retrieves specific snapshot by ID', () => {
    const snap = saveSnapshot({
      workspaceRoot: tempWs,
      variableName: 'formatCurrency',
      remoteContent: 'return "$" + string(amt);',
      metadata: { variableName: 'formatCurrency' }
    });

    const retrieved = getSnapshot(snap.id, tempWs);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, snap.id);
    assert.strictEqual(retrieved.remoteContent, 'return "$" + string(amt);');
  });

  test('rolls back local file to snapshot remote content', async () => {
    const filePath = path.join(tempWs, 'formatCurrency.bml');
    fs.writeFileSync(filePath, 'return "broken new code";', 'utf8');

    const snap = {
      id: 'snap_1',
      variableName: 'formatCurrency',
      formattedTime: 'Today',
      remoteContent: 'return "$" + string(val);',
      metadata: { variableName: 'formatCurrency' }
    };

    const res = await rollbackSnapshot({
      snapshot: snap,
      localFilePath: filePath,
      deployToRemote: false
    });

    assert.strictEqual(res.success, true);
    const restored = fs.readFileSync(filePath, 'utf8');
    assert.strictEqual(restored, 'return "$" + string(val);');
  });
});
