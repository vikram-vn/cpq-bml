'use strict';

require('./register-alias');
const fs = require('fs');
const path = require('path');
const { replicateStructure } = require('@/lang/rest/migrationStructure');

const ROOT = path.join(__dirname, '..');
const SITE_ROOT = path.join(ROOT, 'cpq', 'cpq-10124');
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
