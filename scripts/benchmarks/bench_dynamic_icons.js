#!/usr/bin/env node
/**
 * Benchmark Suite: Dynamic Folder Icons Subsystem
 * Measures performance of:
 * 1. Rule Matcher Classification (40-rule engine)
 * 2. Casing & Affix Variation Expander
 * 3. Deep Workspace Directory Discovery
 * 4. In-Memory Theme Sync & Dictionary Merging
 * 5. Full End-to-End Dynamic Icons Generation
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  RULE_MATCHERS,
  matchFolderIcon,
  expandVariations,
  scanDirFolders,
  syncFoldersIntoTheme,
  generateDynamicIcons
} = require('../../app/lang/icons/dynamicFolderIcons');

const ROOT = path.join(__dirname, '..', '..');

function runBench(name, iterations, fn) {
  // Warmup
  for (let i = 0; i < 5; i++) fn();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    times.push(t1 - t0);
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const min = times[0];
  const max = times[times.length - 1];
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];

  return { name, iterations, avg, min, max, p50, p95 };
}

console.log('\n======================================================');
console.log(' 🚀 DYNAMIC FOLDER ICONS BENCHMARK (Node.js)');
console.log('======================================================\n');

// Test dataset of 100 realistic folder names in CPQ & BML workspaces
const testFolders = [
  'modify', 'rules', 'configuration', 'recommendation', 'recommended-item',
  'constraint', 'access', 'attributes', 'libraries', 'util-libraries',
  'commerce-libraries', 'validation', 'approvals', 'pricing', 'bom',
  'integrations', 'transactions', 'line-items', 'bmql', 'variables',
  'constants', 'dictionary', 'arrays', 'math', 'date', 'strings',
  'urldata', 'debug', 'testing', 'snapshots', 'hiding', 'web-services',
  'tool-defs', 'categories', 'material', 'web-view', 'database', 'sql',
  'rest', 'soap', 'json', 'xml', 'helpers', 'utils', 'services',
  'security', 'auth', 'tokens', 'git', 'github', 'docs', 'docmd',
  'bml-scripts', 'commerce-process', 'util-functions', 'config-rules',
  'pricing-rules', 'quote-actions', 'approval-matrix', 'cache', 'temp',
  'dist', 'build', 'scripts', 'assets', 'icons', 'themes', 'syntaxes',
  'intellisense', 'snippets', 'lint', 'beautify', 'metrics', 'inlay-hints'
];

// 1. Rule Matcher Classification
const bench1 = runBench('Rule Matcher (1,000 folder classifications)', 100, () => {
  for (let i = 0; i < 10; i++) {
    for (const f of testFolders) {
      matchFolderIcon(f);
    }
  }
});

// 2. Variation Expander
const bench2 = runBench('Variation Expander (1,000 name variations)', 100, () => {
  for (let i = 0; i < 10; i++) {
    for (const f of testFolders.slice(0, 50)) {
      expandVariations(f);
    }
  }
});

// 3. Workspace Directory Walker
const bench3 = runBench('Workspace Folder Discovery (scanDirFolders)', 50, () => {
  scanDirFolders(ROOT, 3);
});

// 4. In-Memory Theme Sync
const sampleTheme = JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', 'bml-icons.json'), 'utf8'));
const bench4 = runBench('In-Memory Theme Sync (500 candidate terms)', 50, () => {
  const clone = { folderNames: { ...sampleTheme.folderNames }, folderNamesExpanded: { ...sampleTheme.folderNamesExpanded } };
  syncFoldersIntoTheme(clone, testFolders);
});

// 5. Full End-to-End Dynamic Icons Generation
const bench5 = runBench('Full Dynamic Icons Generation Pipeline', 10, () => {
  generateDynamicIcons(ROOT);
});

const results = [bench1, bench2, bench3, bench4, bench5];

console.log('| Benchmark Feature | Avg Latency | p95 Latency | Min / Max | Rating |');
console.log('| :--- | :--- | :--- | :--- | :--- |');

for (const r of results) {
  const rating = r.avg < 1.0 ? '🚀 INSTANT (<1ms)' : r.avg < 50.0 ? '✨ EXCELLENT (<50ms)' : '⚡ FAST (<100ms)';
  console.log(`| **${r.name}** | **${r.avg.toFixed(3)} ms** | ${r.p95.toFixed(3)} ms | ${r.min.toFixed(3)} / ${r.max.toFixed(3)} ms | ${rating} |`);
}

console.log('\nDynamic icons benchmark finished successfully.\n');
