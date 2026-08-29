#!/usr/bin/env python3
"""
Benchmark: BML Better Comments & Directives Subsystem
Tests:
 - Comment decoration builder across 2,776 lines
 - Tag recognition (TODO, FIXME, NOTE, WARN, etc.)
 - Lint & beautify directive parsing
 - Hover markdown generator for comments
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

    # 1. Comment Decoration Builder
    res1 = run_node_benchmark(
        name="Comment Decoration Builder (All Tags)",
        category="Comments",
        setup_code="""
const { buildCommentDecorations } = require('./app/lang/comments/decorate');
""",
        run_code="""
buildCommentDecorations(sampleBml);
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res1)
    print_result_card(res1)

    # 2. Directive Parsing & Hover Tooltip Resolution
    res2 = run_node_benchmark(
        name="Directive Parsing & Hover Resolution",
        category="Comments",
        setup_code="""
const { getHoverMarkdown } = require('./app/lang/comments/hover');
const { describeDirective } = require('./app/lang/comments/directives');
""",
        run_code="""
describeDirective('// bml-lint-disable bml-bmql-in-loop');
getHoverMarkdown('// bml-lint-disable bml-bmql-in-loop', 10);
""",
        iterations=iterations * 2,
        warmup=10,
    )
    results.append(res2)
    print_result_card(res2)

    return results


if __name__ == "__main__":
    print_header("Better Comments & Directives Subsystem")
    results = run_benchmarks(iterations=100)
    print_summary_table(results)
