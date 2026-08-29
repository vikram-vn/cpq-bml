#!/usr/bin/env python3
"""
Benchmark: Code Actions & Safe Fix-All Rewriter Subsystem
Tests:
 - Quick Fix action matching against diagnostic collections
 - AST Fix-All rewriter for safe batch fixes across full file
"""

from common import (
    run_node_benchmark,
    print_header,
    print_result_card,
    print_summary_table,
    BenchmarkResult,
)
from typing import List


def run_benchmarks(iterations: int = 15) -> List[BenchmarkResult]:
    results = []

    # 1. Whole Document Fix-All Safe AST Rewrite
    res1 = run_node_benchmark(
        name="Whole-Document Fix-All Safe AST Rewrite",
        category="CodeActions",
        setup_code="""
const { getFixAllSafeAction } = require('./app/lang/lint/code-actions/fixAllSafe');
const { lintBMLCustom } = require('./app/lang/lint/core/lint');
const sampleLines = sampleBml.split(/\\r?\\n/);
const lineOffsets = [0];
for (let i = 0; i < sampleBml.length; i++) {
    if (sampleBml[i] === '\\n') lineOffsets.push(i + 1);
}
function offsetToPos(offset) {
    let low = 0, high = lineOffsets.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineOffsets[mid] <= offset) low = mid + 1;
        else high = mid - 1;
    }
    const line = Math.max(0, high);
    return new MockPosition(line, Math.max(0, offset - lineOffsets[line]));
}
const mockDoc = {
    getText: () => sampleBml,
    positionAt: offsetToPos,
    lineAt: (l) => ({ text: sampleLines[l] || '' }),
    uri: { fsPath: sampleBmlPath, toString: () => sampleBmlPath }
};
let recordedDiags = [];
const mockCollection = {
    set: (uri, diags) => { recordedDiags = diags || []; },
    clear: () => {},
    delete: () => {}
};
const mockVscode = {
    workspace: { getConfiguration: () => ({ get: () => true }) },
    Diagnostic: function(r, m, s) { this.range = r; this.message = m; this.severity = s; this.tags = []; },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    DiagnosticTag: { Unnecessary: 1, Deprecated: 2 },
    Range: function(s, e) { this.start = s; this.end = e; },
    Position: function(l, c) { this.line = l; this.character = c; }
};
lintBMLCustom(mockDoc, mockCollection, mockVscode, rootDir);
""",
        run_code="""
getFixAllSafeAction(mockDoc, recordedDiags);
""",
        iterations=iterations,
        warmup=5,
    )
    results.append(res1)
    print_result_card(res1)

    return results


if __name__ == "__main__":
    print_header("Code Actions & Fix-All Subsystem")
    results = run_benchmarks(iterations=50)
    print_summary_table(results)
