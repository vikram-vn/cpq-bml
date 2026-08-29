#!/usr/bin/env python3
"""
Benchmark: Inlay Hints Subsystem
Tests:
 - Parameter name derivation and hint generation across all calls
 - Argument index mapping and suppression filters
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

    # 1. Inlay Hints Parameter Hints Generation
    res1 = run_node_benchmark(
        name="Inlay Hints Generation across Document",
        category="InlayHints",
        setup_code="""
const { provideBmlInlayHints } = require('./app/lang/intellisense/inlayHints');
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
    getText: (r) => sampleBml,
    lineCount: sampleLines.length,
    lineAt: (l) => ({ text: sampleLines[l] || '' }),
    positionAt: offsetToPos
};
const fullRange = new vscodeMock.Range(0, 0, sampleLines.length - 1, 0);
""",
        run_code="""
if (typeof provideBmlInlayHints === 'function') {
    provideBmlInlayHints(mockDoc, fullRange);
}
""",
        iterations=iterations,
        warmup=5,
    )
    results.append(res1)
    print_result_card(res1)

    return results


if __name__ == "__main__":
    print_header("Inlay Hints Subsystem")
    results = run_benchmarks(iterations=50)
    print_summary_table(results)
