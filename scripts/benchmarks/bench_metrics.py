#!/usr/bin/env python3
"""
Benchmark: Code Metrics & Complexity Engine Subsystem
Tests:
 - Cyclomatic complexity calculation
 - Halstead maintainability index & volume
 - Line count, nesting depth, and parameter density
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

    # 1. Complexity & Code Health Metrics across 2,776 lines
    res1 = run_node_benchmark(
        name="Cyclomatic Complexity & Halstead Metrics",
        category="Metrics",
        setup_code="""
const { computeComplexity } = require('./app/lang/metrics/complexity');
""",
        run_code="""
computeComplexity(sampleBml);
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res1)
    print_result_card(res1)

    return results


if __name__ == "__main__":
    print_header("Code Metrics & Complexity Subsystem")
    results = run_benchmarks(iterations=100)
    print_summary_table(results)
