'use strict';

require('./register-alias');
const path = require('path');
const fs = require('fs');
const config = require('@/lang/rest/config');
const api = require('@/lang/rest/api');
const {
  generateMigrationFolderStructure,
  enrichCommerceProcess,
  enrichConfigFamily,
  enrichDataTableFolder,
} = require('@/lang/rest/migrationStructure');

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

// ─── HTTP helper using configured credentials ─────────────────────────────────
async function fetchGranular(category, variableName) {
  try {
    const res = await api.getMigrationResourceItem(category, variableName);
    if (res && res.statusCode === 200 && res.body) {
      const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
      return body;
    }
  } catch {
    // non-fatal: return null if granular fetch fails
  }
  return null;
}

async function main() {
  const settings = config.getSettings();
  const baseUrl = config.getBaseUrl();
  const siteName = config.getCpqSiteName(baseUrl);

  console.log('=== Oracle CPQ Migration Structure Sync ===');
  console.log(`Target Site:  ${baseUrl || '(not configured)'}`);
  console.log(`Auth Method:  ${settings.authMethod}`);
  console.log(`Username:     ${settings.username || '(not configured)'}`);
  console.log(`Site Folder:  cpq/${siteName}/`);

  const hasMissing = await config.hasMissingCredentials();
  if (hasMissing) {
    console.error('\nError: CPQ connection credentials are not configured.');
    console.error('Configure via VS Code Settings (cpqBml.connection.*),');
    console.error('"CPQ-BML: Set CPQ Password", or CPQ_SITE_URL / CPQ_USERNAME / CPQ_PASSWORD env vars.');
    process.exit(1);
  }

  // ── Step 1: Fetch all migration resource categories ──────────────────────
  console.log('\n[1/4] Fetching migration resource categories...');
  const resResources = await api.listMigrationResources();
  if (!resResources || resResources.statusCode !== 200) {
    console.error(`Failed to fetch migration resources. HTTP ${resResources ? resResources.statusCode : 'unknown'}`);
    process.exit(1);
  }
  const body = typeof resResources.body === 'string' ? JSON.parse(resResources.body) : resResources.body;
  const categories = body.items || [];
  console.log(`✓ ${categories.length} categories retrieved.`);
  for (const cat of categories) {
    console.log(`  • ${cat.name} (${cat.category}): ${(cat.children || []).length} items`);
  }

  // ── Step 2: Fetch migration packages ─────────────────────────────────────
  console.log('\n[2/4] Fetching migration packages...');
  let packages = [];
  try {
    const resPkg = await api.listMigrationPackages({ limit: 200 });
    if (resPkg && resPkg.statusCode === 200) {
      const pkgBody = typeof resPkg.body === 'string' ? JSON.parse(resPkg.body) : resPkg.body;
      packages = pkgBody.items || [];
    }
  } catch (e) {
    console.warn(`  Warning: Could not fetch packages: ${e.message}`);
  }
  console.log(`✓ ${packages.length} migration packages retrieved.`);

  // ── Step 3: Build top-level structure ─────────────────────────────────────
  console.log('\n[3/4] Generating top-level cpq/ folder structure...');
  const result = generateMigrationFolderStructure(ROOT, siteName, categories, packages.length);

  // Write package info files
  const pkgDir = path.join(result.siteRoot, 'migration-packages');
  for (const pkg of packages) {
    const pkgFolder = path.join(pkgDir, pkg.identifier);
    if (!fs.existsSync(pkgFolder)) fs.mkdirSync(pkgFolder, { recursive: true });
    fs.writeFileSync(path.join(pkgFolder, 'package-info.json'), JSON.stringify(pkg, null, 2), 'utf8');

    // Per-package README.md
    const readmePath = path.join(pkgFolder, 'README.md');
    const pkgReadme = [
      `# Migration Package: ${pkg.name}`,
      '',
      `**Identifier:** \`${pkg.identifier}\`  `,
      `**Version:** ${pkg.version}  `,
      `**Description:** ${pkg.description || '_None_'}  `,
      `**Date Modified:** ${pkg.dateModified || 'N/A'}  `,
      `**Source Site:** \`${pkg.sourceSiteUrl || 'N/A'}\`  `,
      '',
      '> Source: `GET /rest/v19/migrationPackages`',
      '',
      '## Files',
      '- `package-info.json` — Full package metadata',
      '- `contents/` — Package contents per category (if exported)',
      '',
    ].join('\n');
    fs.writeFileSync(readmePath, pkgReadme, 'utf8');
  }
  console.log(`✓ Top-level structure built at: ${result.siteRoot}`);

  // ── Step 4: Fetch granular depth for Commerce, Configuration, Data Tables ──
  console.log('\n[4/4] Fetching granular depth for Commerce, Configuration, Data Tables...');

  for (const cat of categories) {
    const catCode = cat.category;
    const children = cat.children || [];

    if (catCode === 'COMMERCE') {
      console.log(`  → Enriching ${children.length} Commerce processes...`);
      for (const proc of children) {
        process.stdout.write(`    • ${proc.variableName} ... `);
        const detail = await fetchGranular('COMMERCE', proc.variableName);
        if (detail) {
          enrichCommerceProcess(result.siteRoot, proc.variableName, detail);
          process.stdout.write(`✓ (${(detail.children || []).length} children)\n`);
        } else {
          process.stdout.write('skipped\n');
        }
      }
    }

    else if (catCode === 'CONFIGURATION' || catCode === 'PRODUCT_DEFINITION') {
      console.log(`  → Enriching ${children.length} Configuration families...`);
      for (const fam of children) {
        process.stdout.write(`    • ${fam.variableName} ... `);
        const detail = await fetchGranular(catCode, fam.variableName);
        if (detail) {
          enrichConfigFamily(result.siteRoot, fam.variableName, detail);
          process.stdout.write(`✓ (${(detail.children || []).length} children)\n`);
        } else {
          process.stdout.write('skipped\n');
        }
      }
    }

    else if (catCode === 'DATA_TABLE') {
      console.log(`  → Enriching ${children.length} Data Table folders...`);
      for (const folder of children) {
        process.stdout.write(`    • ${folder.variableName} ... `);
        const detail = await fetchGranular('DATA_TABLE', folder.variableName);
        if (detail) {
          enrichDataTableFolder(result.siteRoot, folder.variableName, detail);
          process.stdout.write(`✓ (${(detail.children || []).length} children)\n`);
        } else {
          process.stdout.write('skipped\n');
        }
      }
    }
  }

  console.log('\n=== Done ===');
  console.log(`✓ Full structure at:  ${result.siteRoot}`);
  console.log(`✓ Manifest:           ${result.manifestPath}`);
  console.log(`✓ Categories:         ${categories.length}`);
  console.log(`✓ Packages:           ${packages.length}`);
}

main().catch(err => {
  console.error('Fatal error during migration structure sync:', err);
  process.exit(1);
});
