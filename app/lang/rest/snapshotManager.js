const fs = require('fs');
const path = require('path');
const os = require('os');
const api = require('@/lang/rest/api');
const metadataLib = require('@/lang/rest/metadata');
const { isSuccess, describeError } = require('@/lang/rest/commands/shared');

const MAX_SNAPSHOTS_PER_FUNCTION = 50;

function getSnapshotsDir(workspaceRoot) {
  let baseDir;
  if (workspaceRoot && typeof workspaceRoot === 'string') {
    baseDir = path.join(workspaceRoot, 'cpq', '.snapshots');
  } else {
    baseDir = path.join(os.homedir(), '.cpq-bml', 'snapshots');
  }
  if (!fs.existsSync(baseDir)) {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
    } catch {}
  }
  return baseDir;
}

function sanitizeName(name) {
  return String(name || 'unnamed').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Creates and persists a rollback snapshot before deployment or remote write.
 */
function saveSnapshot({
  workspaceRoot,
  variableName,
  functionType = 'util',
  environment = 'default',
  remoteContent = '',
  localContent = '',
  metadata = null
}) {
  try {
    const snapshotsDir = getSnapshotsDir(workspaceRoot);
    const safeName = sanitizeName(variableName);
    const funcDir = path.join(snapshotsDir, safeName);
    if (!fs.existsSync(funcDir)) {
      fs.mkdirSync(funcDir, { recursive: true });
    }

    const timestamp = Date.now();
    const isoDate = new Date(timestamp).toISOString();
    const id = `snap_${safeName}_${timestamp}`;
    const filename = `${id}.json`;
    const filePath = path.join(funcDir, filename);

    const snapshot = {
      id,
      timestamp,
      isoDate,
      formattedTime: new Date(timestamp).toLocaleString(),
      variableName,
      functionType,
      environment,
      remoteContent: remoteContent || '',
      localContent: localContent || '',
      metadata: metadata || {}
    };

    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

    // Prune older snapshots if exceeding threshold
    pruneOldSnapshots(funcDir, MAX_SNAPSHOTS_PER_FUNCTION);

    return snapshot;
  } catch (err) {
    console.error('Failed to save BML rollback snapshot:', err);
    return null;
  }
}

function pruneOldSnapshots(funcDir, maxCount) {
  try {
    const files = fs.readdirSync(funcDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fullPath = path.join(funcDir, f);
        return { file: f, path: fullPath, mtime: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > maxCount) {
      const toDelete = files.slice(maxCount);
      for (const item of toDelete) {
        try { fs.unlinkSync(item.path); } catch {}
      }
    }
  } catch {}
}

/**
 * Lists all snapshots for a function, or across the workspace if variableName is omitted.
 */
function listSnapshots(variableName, workspaceRoot) {
  try {
    const snapshotsDir = getSnapshotsDir(workspaceRoot);
    if (!fs.existsSync(snapshotsDir)) return [];

    let dirs = [];
    if (variableName) {
      const targetDir = path.join(snapshotsDir, sanitizeName(variableName));
      if (fs.existsSync(targetDir)) dirs.push(targetDir);
    } else {
      dirs = fs.readdirSync(snapshotsDir)
        .map(d => path.join(snapshotsDir, d))
        .filter(p => {
          try { return fs.statSync(p).isDirectory(); } catch { return false; }
        });
    }

    const snapshots = [];
    for (const dir of dirs) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dir, file), 'utf8');
          const data = JSON.parse(content);
          snapshots.push(data);
        } catch {}
      }
    }

    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('Failed to list snapshots:', err);
    return [];
  }
}

/**
 * Retrieves a single snapshot by ID.
 */
function getSnapshot(snapshotId, workspaceRoot) {
  const all = listSnapshots(null, workspaceRoot);
  return all.find(s => s.id === snapshotId) || null;
}

/**
 * Restores local file content from a snapshot and optionally pushes it back to CPQ.
 */
async function rollbackSnapshot({
  snapshot,
  localFilePath,
  transport,
  deployToRemote = false
}) {
  if (!snapshot || !snapshot.remoteContent) {
    return { success: false, errorMessage: 'Snapshot contains no remote content to restore.' };
  }

  try {
    if (localFilePath && fs.existsSync(localFilePath)) {
      metadataLib.writeBmlFile(localFilePath, snapshot.remoteContent);
    }

    if (deployToRemote && snapshot.metadata) {
      const nsVarName = metadataLib.namespaceVariableNameFor(snapshot.metadata);
      const payload = metadataLib.buildFunctionPayload(snapshot.metadata, snapshot.remoteContent);
      const res = await api.updateLibraryFunction(nsVarName, payload, transport);

      if (!isSuccess(res.statusCode)) {
        return {
          success: false,
          errorMessage: `Restored local file, but remote CPQ update failed (HTTP ${res.statusCode}): ${describeError(res.body)}`
        };
      }
    }

    return {
      success: true,
      message: `Successfully rolled back "${snapshot.variableName}" to snapshot from ${snapshot.formattedTime}.`
    };
  } catch (err) {
    return { success: false, errorMessage: err.message || String(err) };
  }
}

module.exports = {
  getSnapshotsDir,
  saveSnapshot,
  listSnapshots,
  getSnapshot,
  rollbackSnapshot
};
