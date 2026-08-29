#!/usr/bin/env python3
"""
Benchmark: Spell Checker Subsystem
Tests:
 - Spell checking over 20,000+ code tokens
 - CamelCase & snake_case sub-word token splitting
 - CSpell dictionary lookup & suggestion generation
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

    # 1. Full Spell Checker Pass across 2,776 lines
    res1 = run_node_benchmark(
        name="Full Spell Checker (20,000+ Tokens)",
        category="SpellChecker",
        setup_code="""
const { checkSpelling } = require('./app/lang/spell-check/spelling');
const { getCommentRanges } = require('./app/lang/lint/rules/comments');
const { getStringRanges } = require('./app/lang/lint/rules/strings');

const mockDoc = {
    getText: () => sampleBml,
    positionAt: (offset) => ({ line: 0, character: 0 }),
    uri: { fsPath: sampleBmlPath }
};
const mockVscode = {
    workspace: { getConfiguration: () => ({ get: () => [] }) },
    Diagnostic: function(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    },
    DiagnosticSeverity: { Information: 2, Error: 0, Warning: 1 },
    Range: function(start, end) { this.start = start; this.end = end; }
};

const commentRanges = getCommentRanges(sampleBml);
const cleanText = sampleBml;
const stringRanges = getStringRanges(cleanText);
const noStringsText = cleanText;
""",
        run_code="""
checkSpelling(sampleBml, cleanText, noStringsText, mockDoc, mockVscode, rootDir);
""",
        iterations=iterations,
        warmup=5,
    )
    results.append(res1)
    print_result_card(res1)

    return results


if __name__ == "__main__":
    print_header("Spell Checker Subsystem")
    results = run_benchmarks(iterations=30)
    print_summary_table(results)
