#!/usr/bin/env python3
"""
Benchmark: Dynamic Folder Icons Subsystem
Tests:
 - Rule Matcher Classification across 1,000 folder names (40 regex rules)
 - Name Variation Expander (kebab, snake, camel, pascal, prefixes)
 - Deep Workspace Directory Discovery
 - In-Memory Theme Sync & Dictionary Merging
 - Full Dynamic Icons Generation Pipeline
"""

from common import (
    run_node_benchmark,
    print_header,
    print_result_card,
    print_summary_table,
    BenchmarkResult,
)
from typing import List


def run_benchmarks(iterations: int = 50) -> List[BenchmarkResult]:
    results = []

    # 1. Rule Matcher Classification
    res1 = run_node_benchmark(
        name="Dynamic Icons Rule Matcher (1,000 classifications)",
        category="DynamicIcons",
        setup_code="""
const { matchFolderIcon } = require('./app/lang/icons/dynamicFolderIcons');
const names = ['modify', 'rules', 'configuration', 'recommendation', 'recommended-item',
  'constraint', 'access', 'attributes', 'libraries', 'util-libraries',
  'commerce-libraries', 'validation', 'approvals', 'pricing', 'bom',
  'integrations', 'transactions', 'line-items', 'bmql', 'variables'];
""",
        run_code="""
for (let i = 0; i < 50; i++) {
  for (const n of names) matchFolderIcon(n);
}
""",
        iterations=iterations,
        warmup=5,
        custom_line_count=1000
    )
    results.append(res1)
    print_result_card(res1)

    # 2. Variation Expander
    res2 = run_node_benchmark(
        name="Dynamic Icons Variation Expander (1,000 names)",
        category="DynamicIcons",
        setup_code="""
const { expandVariations } = require('./app/lang/icons/dynamicFolderIcons');
const names = ['modify', 'rules', 'configuration', 'recommendation', 'recommended-item',
  'constraint', 'access', 'attributes', 'libraries', 'util-libraries'];
""",
        run_code="""
for (let i = 0; i < 100; i++) {
  for (const n of names) expandVariations(n);
}
""",
        iterations=iterations,
        warmup=5,
        custom_line_count=1000
    )
    results.append(res2)
    print_result_card(res2)

    # 3. Workspace Directory Discovery
    res3 = run_node_benchmark(
        name="Dynamic Icons Workspace Folder Scan",
        category="DynamicIcons",
        setup_code="""
const { scanDirFolders } = require('./app/lang/icons/dynamicFolderIcons');
const workspaceRoot = rootDir;
""",
        run_code="""
scanDirFolders(workspaceRoot, 3);
""",
        iterations=30,
        warmup=3,
        custom_line_count=100
    )
    results.append(res3)
    print_result_card(res3)

    # 4. In-Memory Theme Sync
    res4 = run_node_benchmark(
        name="Dynamic Icons In-Memory Theme Sync (500 terms)",
        category="DynamicIcons",
        setup_code="""
const { syncFoldersIntoTheme } = require('./app/lang/icons/dynamicFolderIcons');
const theme = JSON.parse(fs.readFileSync(path.join(rootDir, 'themes', 'bml-icons.json'), 'utf8'));
const candidates = ['modify', 'rules', 'configuration', 'recommendation', 'constraint', 'attributes', 'libraries'];
""",
        run_code="""
const clone = { folderNames: { ...theme.folderNames }, folderNamesExpanded: { ...theme.folderNamesExpanded } };
syncFoldersIntoTheme(clone, candidates);
""",
        iterations=iterations,
        warmup=5,
        custom_line_count=500
    )
    results.append(res4)
    print_result_card(res4)

    # 5. Full End-to-End Dynamic Icons Generation
    res5 = run_node_benchmark(
        name="Dynamic Icons Full Generation Pipeline",
        category="DynamicIcons",
        setup_code="""
const { generateDynamicIcons } = require('./app/lang/icons/dynamicFolderIcons');
const origLog = console.log;
""",
        run_code="""
console.log = () => {};
generateDynamicIcons(rootDir);
console.log = origLog;
""",
        iterations=15,
        warmup=2,
        custom_line_count=7600
    )
    results.append(res5)
    print_result_card(res5)

    return results


if __name__ == "__main__":
    print_header("Oracle CPQ-BML — Dynamic Folder Icons Benchmarks")
    bench_results = run_benchmarks()
    print_summary_table(bench_results)
