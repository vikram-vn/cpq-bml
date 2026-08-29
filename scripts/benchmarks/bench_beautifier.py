#!/usr/bin/env python3
"""
Benchmark: BML Beautifier / Formatter Subsystem
Tests:
 - Full file beautification across 2,776 lines
 - Expression indentation, keyword casing, bracket spacing
 - Directive parsing & region preservation
"""

from common import (
    run_node_benchmark,
    print_header,
    print_result_card,
    print_summary_table,
    BenchmarkResult,
)
from typing import List


def run_benchmarks(iterations: int = 40) -> List[BenchmarkResult]:
    results = []

    # 1. Full-File Beautification (Default Settings)
    res1 = run_node_benchmark(
        name="Beautifier Formatting (Default 4-space)",
        category="Beautifier",
        setup_code="""
const beautify = require('./app/lang/beautify/bml');
const opts = { indent_size: 4, space_in_empty_paren: false };
""",
        run_code="""
beautify(sampleBml, opts);
""",
        iterations=iterations,
        warmup=5,
    )
    results.append(res1)
    print_result_card(res1)

    # 2. Beautifier with Expanded Braces & Space in Parens
    res2 = run_node_benchmark(
        name="Beautifier (Expand Braces & Spaces)",
        category="Beautifier",
        setup_code="""
const beautify = require('./app/lang/beautify/bml');
const opts = { indent_size: 2, brace_style: 'expand', space_in_empty_paren: true };
""",
        run_code="""
beautify(sampleBml, opts);
""",
        iterations=iterations,
        warmup=5,
    )
    results.append(res2)
    print_result_card(res2)

    return results


if __name__ == "__main__":
    print_header("Beautifier & Code Formatter Subsystem")
    results = run_benchmarks(iterations=40)
    print_summary_table(results)
