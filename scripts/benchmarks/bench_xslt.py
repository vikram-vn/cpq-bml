#!/usr/bin/env python3
"""
Benchmark: XSLT Formatter & Linter Subsystem
Tests:
 - XSLT document formatting & XML indentation
 - XSLT static analysis and tag validation
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

    # 1. XSLT Formatter Benchmark
    res1 = run_node_benchmark(
        name="XSLT Document Formatter",
        category="XSLT",
        setup_code="""
const { formatXml } = require('./app/lang/xslt/formatter');
const xsltSample = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><html><body><h1><xsl:value-of select="title"/></h1><p>Test</p></body></html></xsl:template></xsl:stylesheet>';
""",
        run_code="""
formatXml(xsltSample, 4);
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res1)
    print_result_card(res1)

    # 2. XSLT Linter Benchmark
    res2 = run_node_benchmark(
        name="XSLT Document Linter",
        category="XSLT",
        setup_code="""
const { lintXslt } = require('./app/lang/xslt/xsltLinter');
const xsltSample = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/"><html><body><h1><xsl:value-of select="title"/></h1><p>Test</p></body></html></xsl:template></xsl:stylesheet>';
const xsltDoc = {
    getText: () => xsltSample,
    positionAt: (idx) => new vscodeMock.Position(0, idx)
};
""",
        run_code="""
lintXslt(xsltDoc);
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res2)
    print_result_card(res2)

    return results


if __name__ == "__main__":
    print_header("XSLT Formatter & Linter Subsystem")
    results = run_benchmarks(iterations=100)
    print_summary_table(results)
