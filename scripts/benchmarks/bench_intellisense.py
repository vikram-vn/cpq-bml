#!/usr/bin/env python3
"""
Benchmark: IntelliSense Subsystem
Tests:
 - BML Catalog & API usage data loading
 - Hover information resolution (built-ins & workspace functions)
 - Signature Help parameter index detection
 - Local variable scope scanner
 - Workspace function index traversal & caching
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

    # 1. API Catalog Loading & Dictionary Lookup
    res1 = run_node_benchmark(
        name="Catalog Loading & Built-in Lookup",
        category="IntelliSense",
        setup_code="""
const { getBmlApiData, invalidateApiData } = require('./app/lang/intellisense/apiData');
""",
        run_code="""
const data = getBmlApiData();
const info = data['bmql-select'] || data['jsonput'] || data['getdate'];
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res1)
    print_result_card(res1)

    # 2. Hover Info Resolution & JSDoc Formatting
    res2 = run_node_benchmark(
        name="Hover Info Resolution & Formatting",
        category="IntelliSense",
        setup_code="""
const { lookupApiInfo } = require('./app/lang/intellisense/apiData');
const { formatAsJsDoc } = require('./app/lang/intellisense/docFormatting');
""",
        run_code="""
const info = lookupApiInfo('jsonput') || lookupApiInfo('getdate');
if (info) {
    formatAsJsDoc(info);
}
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res2)
    print_result_card(res2)

    # 3. Signature Help Active Call & Parameter Detection
    res3 = run_node_benchmark(
        name="Signature Help Active Parameter Detection",
        category="IntelliSense",
        setup_code="""
const { getActiveFunctionCall } = require('./app/lang/intellisense/signatureHelp');
const mockDoc = {
    getText: (r) => sampleBml.slice(Math.max(0, sampleBml.length - 2000)),
    positionAt: (o) => ({ line: 0, character: 0 })
};
const totalLines = sampleBml.split(/\\r?\\n/).length;
const pos = new MockPosition(totalLines - 1, 10);
""",
        run_code="""
getActiveFunctionCall(mockDoc, pos);
""",
        iterations=iterations,
        warmup=10,
    )
    results.append(res3)
    print_result_card(res3)

    # 4. Local Variables Scope Scanner across 2,700+ lines
    res4 = run_node_benchmark(
        name="Local Variable Scope Scanner",
        category="IntelliSense",
        setup_code="""
const { collectLocalVariables } = require('./app/lang/intellisense/bmqlVariableCompletions');
const sampleLines = sampleBml.split(/\\r?\\n/);
const mockDoc = {
    getText: (r) => sampleBml,
    lineCount: sampleLines.length,
    lineAt: (l) => ({ text: sampleLines[l] || '' })
};
const totalLines = sampleLines.length;
const pos = new MockPosition(totalLines - 1, 10);
""",
        run_code="""
collectLocalVariables(mockDoc, pos);
""",
        iterations=max(20, iterations // 2),
        warmup=5,
    )
    results.append(res4)
    print_result_card(res4)

    # 5. Workspace Function Indexing (with IGNORED_FOLDERS)
    res5 = run_node_benchmark(
        name="Workspace Function Indexing & Resolution",
        category="IntelliSense",
        setup_code="""
const { getWorkspaceIndex, invalidateIndex } = require('./app/lang/intellisense/workspaceIndex');
""",
        run_code="""
invalidateIndex();
const idx = getWorkspaceIndex();
idx.get('util.calculatepricing');
""",
        iterations=max(20, iterations // 2),
        warmup=5,
    )
    results.append(res5)
    print_result_card(res5)

    return results


if __name__ == "__main__":
    print_header("IntelliSense Subsystem")
    results = run_benchmarks(iterations=100)
    print_summary_table(results)
