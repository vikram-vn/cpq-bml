'use strict';

require('./register-alias');
const fs = require('fs');
const path = require('path');
const config = require('@/lang/rest/config');
const { replicateStructure } = require('@/lang/rest/migrationStructure');

const ROOT = path.join(__dirname, '..');

// ─── Load .env from workspace root if present ────────────────────────────────
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const baseUrl = config.getBaseUrl();
const siteName = config.getCpqSiteName(baseUrl);

if (!siteName) {
  console.error('Error: CPQ site URL is not configured. Set cpqBml.connection.siteUrl in VS Code Settings or CPQ_SITE_URL in .env / environment variables.');
  process.exit(1);
}

const SITE_ROOT = path.join(ROOT, 'cpq', siteName);
const BACKUP_DIR = path.join(SITE_ROOT, 'backup');
const MODIFY_DIR = path.join(SITE_ROOT, 'modify');
const MODIFIED_DIR = path.join(SITE_ROOT, 'modified');

const CANONICAL_CATEGORIES = [
  'catalog',
  'commerce',
  'configuration',
  'data-tables',
  'documents',
  'eligibility-rules',
  'file-manager',
  'parts',
  'pricing',
  'util-libraries',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runMigration() {
  console.log('=== Moving all category folders into modify/ and backup/ ===');
  console.log(`Site Folder:  cpq/${siteName}/`);
  ensureDir(MODIFY_DIR);
  ensureDir(BACKUP_DIR);

  // 1. If old 'modified' exists, merge its contents into 'modify'
  if (fs.existsSync(MODIFIED_DIR)) {
    console.log('Merging existing modified/ into modify/...');
    copyDirRecursive(MODIFIED_DIR, MODIFY_DIR);
    fs.rmSync(MODIFIED_DIR, { recursive: true, force: true });
    console.log('✓ Removed old modified/ folder');
  }

  // 2. Move live categories from SITE_ROOT into MODIFY_DIR
  for (const cat of CANONICAL_CATEGORIES) {
    const catSrc = path.join(SITE_ROOT, cat);
    const catDest = path.join(MODIFY_DIR, cat);
    if (fs.existsSync(catSrc)) {
      console.log(`Moving ${cat} into modify/${cat}...`);
      copyDirRecursive(catSrc, catDest);
      fs.rmSync(catSrc, { recursive: true, force: true });
    }
  }

  // 3. Remove any lingering legacy folders at SITE_ROOT
  const legacyAtRoot = ['oraclecpqo', 'util', 'actions', 'attributes', 'rules', 'migration-packages'];
  for (const leg of legacyAtRoot) {
    const p = path.join(SITE_ROOT, leg);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  }

  // 4. Write README for modify/
  const modifyReadme = path.join(MODIFY_DIR, 'README.md');
  fs.writeFileSync(modifyReadme, [
    '# Modify',
    '',
    'Local working copies and staged edits created by the CPQ-BML extension.',
    'Follows the identical hierarchy as the Oracle CPQ Migration API taxonomy.',
    '',
    '> These reflect local edits before deployment to the CPQ server.',
    '',
  ].join('\n'), 'utf8');

  // 5. Replicate structure from MODIFY_DIR into BACKUP_DIR
  console.log('Replicating complete hierarchy into backup/...');
  const backupReadme = path.join(BACKUP_DIR, 'README.md');
  fs.writeFileSync(backupReadme, [
    '# Backup',
    '',
    'Local snapshots and pristine rollback restore points created by the CPQ-BML extension.',
    'Follows the identical hierarchy as the live CPQ environment.',
    '',
    '> These are generated locally prior to modifications and are not synced to the CPQ server.',
    '',
  ].join('\n'), 'utf8');

  replicateStructure(MODIFY_DIR, BACKUP_DIR, 'Backup', 'Local pristine snapshots and rollback restore points prior to edit.', MODIFY_DIR);

  // 6. Delete cpq-migration-manifest.json if present
  const manifestPath = path.join(SITE_ROOT, 'cpq-migration-manifest.json');
  if (fs.existsSync(manifestPath)) {
    fs.rmSync(manifestPath, { force: true });
    console.log('✓ Removed cpq-migration-manifest.json');
  }

  console.log('✓ Successfully reorganized site root! Only backup/, modify/, and migration-packages/ remain at root.');
}

runMigration();
