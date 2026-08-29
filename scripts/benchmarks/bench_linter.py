#!/usr/bin/env python3
"""
Benchmark: BML Static Linter Subsystem
Tests:
 - Real-time AST & heuristic static analysis across all 27 lint rules
 - Large file analysis (2,776 lines)
 - Diagnostic collection dispatch & range mapping
"""

from common import (
    run_node_benchmark,
    print_header,
    print_result_card,
    print_summary_table,
    BenchmarkResult,
)
from typing import List


def run_benchmarks(iterations: int = 30) -> List[BenchmarkResult]:
    results = []

    # 1. Full 27-Rule Static Linter Pass across 2,776 lines
    res1 = run_node_benchmark(
        name="Full Static Analysis (All 27 Rules)",
        category="Linter",
        setup_code="""
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
const mockCollection = { set: () => {}, clear: () => {}, delete: () => {} };
const mockVscode = {
    workspace: { getConfiguration: () => ({ get: (k, d) => k === 'features.spelling' ? false : (d !== undefined ? d : true) }) },
    Diagnostic: function(r, m, s) { this.range = r; this.message = m; this.severity = s; this.tags = []; },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    DiagnosticTag: { Unnecessary: 1, Deprecated: 2 },
    Range: function(s, e) { this.start = s; this.end = e; },
    Position: function(l, c) { this.line = l; this.character = c; }
};
""",
        run_code="""
lintBMLCustom(mockDoc, mockCollection, mockVscode, rootDir);
""",
        iterations=iterations,
        warmup=3,
    )
    results.append(res1)
    print_result_card(res1)

    # 2. Comment & String Range Stripping Optimization Pass
    res2 = run_node_benchmark(
        name="Comment & String AST Pre-Pass",
        category="Linter",
        setup_code="""
const { getCommentRanges } = require('./app/lang/lint/rules/comments');
const { getStringRanges } = require('./app/lang/lint/rules/strings');
""",
        run_code="""
const commentRanges = getCommentRanges(sampleBml);
const stringRanges = getStringRanges(sampleBml);
""",
        iterations=iterations * 2,
        warmup=5,
    )
    results.append(res2)
    print_result_card(res2)

    return results


if __name__ == "__main__":
    print_header("Static Linter Subsystem")
    results = run_benchmarks(iterations=30)
    print_summary_table(results)
