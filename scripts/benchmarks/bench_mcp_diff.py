#!/usr/bin/env python3
"""
Benchmark: MCP Fast Diff & Knowledge Subsystem
Tests:
 - High-speed line-by-line diff computation across 2,776 lines
 - Patch & chunk generation for AI working copy diffs
"""

from common import (
    run_node_benchmark,
    print_header,
    print_result_card,
    print_summary_table,
    BenchmarkResult,
)
from typing import List


def run_benchmarks(iterations: int = 100) -> List[BenchmarkResult]:
    results = []

    # 1. MCP Fast Line Diff across 2,776 lines
    res1 = run_node_benchmark(
        name="MCP Fast Line Diff (2,776 lines)",
        category="MCP",
        setup_code="""
const { computeLineDiff } = require('./app/lang/mcp/tools/knowledge');
const linesOld = sampleBml.split(/\\r?\\n/);
const linesNew = [...linesOld];
linesNew[10] = '// Modified line 10';
linesNew[500] = '// Modified line 500';
linesNew[1500] = '// Modified line 1500';
linesNew[2500] = '// Modified line 2500';
""",
        run_code="""
computeLineDiff(linesOld, linesNew);
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res1)
    print_result_card(res1)

    return results


if __name__ == "__main__":
    print_header("MCP Fast Diff Subsystem")
    results = run_benchmarks(iterations=100)
    print_summary_table(results)
