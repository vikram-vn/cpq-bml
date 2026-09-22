'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUPS = 2;

// In-memory write queues per file path to prevent concurrent file race conditions
const writeQueues = new Map();

/**
 * Rotates log file if it exceeds MAX_LOG_SIZE_BYTES.
 * Rotates: file -> file.1 -> file.2
 */
function rotateLogSync(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stats = fs.statSync(filePath);
    if (stats.size < MAX_LOG_SIZE_BYTES) return;

    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const src = `${filePath}.${i}`;
      const dest = `${filePath}.${i + 1}`;
      if (fs.existsSync(src)) {
        try {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          fs.renameSync(src, dest);
        } catch {}
      }
    }

    const firstBackup = `${filePath}.1`;
    if (fs.existsSync(firstBackup)) {
      try { fs.unlinkSync(firstBackup); } catch {}
    }
    fs.renameSync(filePath, firstBackup);
  } catch {}
}

/**
 * Appends text to a log file with automatic rotation and directory creation.
 */
function safeAppendLog(filePath, text) {
  return safeAppendLogSync(filePath, text);
}

/**
 * Synchronous version for teardown / exit scenarios where event loop may terminate.
 */
function safeAppendLogSync(filePath, text) {
  if (!filePath || typeof filePath !== 'string' || !text) return;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    rotateLogSync(filePath);
    fs.appendFileSync(filePath, text, 'utf8');
  } catch {}
}

module.exports = {
  safeAppendLog,
  safeAppendLogSync,
  rotateLogSync,
  MAX_LOG_SIZE_BYTES,
  MAX_BACKUPS,
};
