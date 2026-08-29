#!/usr/bin/env python3
"""
Master Benchmark Orchestrator for Oracle CPQ-BML Extension
Runs all individual subsystem benchmarks, aggregates metrics, and generates
formatted terminal reports, Markdown scorecards, or JSON output.

Usage:
  python scripts/benchmarks/run_all.py
  python scripts/benchmarks/run_all.py --markdown
  python scripts/benchmarks/run_all.py --json
  python scripts/benchmarks/run_all.py --output benchmark_report.md
  python scripts/benchmarks/run_all.py intellisense linter beautifier
"""

import argparse
import json
import os
import sys
import time
from typing import List, Dict, Any

from common import (
    print_header,
    print_summary_table,
    get_sample_metrics,
    BenchmarkResult,
    ROOT_DIR,
    CYAN,
    BOLD,
    RESET,
    GREEN,
    YELLOW,
    RED,
    DIM,
)

# Import individual benchmark modules
import bench_intellisense
import bench_linter
import bench_beautifier
import bench_comments
import bench_spelling
import bench_metrics
import bench_inlay_hints
import bench_code_actions
import bench_xslt
import bench_mcp_diff

SUITES = {
    "intellisense": ("IntelliSense (Hover, Lookup, Signature, Index)", bench_intellisense.run_benchmarks),
    "linter": ("BML Static Linter (27 Rules)", bench_linter.run_benchmarks),
    "beautifier": ("Code Beautifier & Formatter", bench_beautifier.run_benchmarks),
    "comments": ("Better Comments & Directives", bench_comments.run_benchmarks),
    "spelling": ("Spell Checker (20k+ tokens)", bench_spelling.run_benchmarks),
    "metrics": ("Complexity & Code Health Metrics", bench_metrics.run_benchmarks),
    "inlay_hints": ("Inlay Hints Parameter Names", bench_inlay_hints.run_benchmarks),
    "code_actions": ("Code Actions & Safe Fix-All Rewriter", bench_code_actions.run_benchmarks),
    "xslt": ("XSLT Formatter & Linter", bench_xslt.run_benchmarks),
    "mcp_diff": ("MCP Knowledge Fast Diff", bench_mcp_diff.run_benchmarks),
}


def generate_markdown_report(results: List[BenchmarkResult], metadata: Dict[str, Any]) -> str:
    """Generate a clean Markdown table scorecard."""
    md = []
    md.append("# Oracle CPQ-BML Extension — End-to-End Benchmark Report\n")
    md.append(f"- **Target File**: `{metadata['path']}`")
    md.append(f"- **Document Size**: **{metadata['line_count']:,} lines** ({metadata['size_kb']:.1f} KB)")
    md.append(f"- **Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    md.append(f"- **Python**: {sys.version.split()[0]} | **Platform**: {sys.platform}\n")
    md.append("## Subsystem Performance Scorecard\n")
    md.append("| Subsystem / Benchmark | Category | Avg Latency | p95 Latency | Min / Max | Throughput (lines/sec) | Rating |")
    md.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")

    for r in results:
        md.append(
            f"| **{r.name}** | {r.category} | {r.avg_ms:.2f} ms | {r.p95_ms:.2f} ms | "
            f"{r.min_ms:.2f} / {r.max_ms:.2f} ms | {r.throughput_lines_sec:,} | {r.status_label} |"
        )

    md.append("\n---\n")
    md.append("### Rating Thresholds")
    md.append("- **⚡ INSTANT**: < 1 ms")
    md.append("- **✅ EXCELLENT**: < 50 ms")
    md.append("- **⚡ FAST**: < 150 ms")
    md.append("- **⚠️ ATTENTION**: >= 150 ms")
    return "\n".join(md)


def main():
    parser = argparse.ArgumentParser(description="Oracle CPQ-BML End-to-End Benchmark Suite")
    parser.add_argument("suites", nargs="*", help="Specific suites to run (e.g., intellisense linter beautifier)")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    parser.add_argument("--markdown", action="store_true", help="Print scorecard in Markdown format")
    parser.add_argument("--output", "-o", type=str, help="Save report to specified file path (.md or .json)")
    parser.add_argument("--iterations", "-n", type=int, default=None, help="Override default iteration count")
    args = parser.parse_args()

    selected_suites = args.suites if args.suites else list(SUITES.keys())
    # Normalize names
    selected_keys = []
    for s in selected_suites:
        norm = s.lower().replace("-", "_")
        if norm in SUITES:
            selected_keys.append(norm)
        else:
            print(f"{YELLOW}Warning: Unknown suite '{s}'. Available: {', '.join(SUITES.keys())}{RESET}", file=sys.stderr)

    if not selected_keys:
        selected_keys = list(SUITES.keys())

    if not args.json:
        print_header("End-to-End Full Extension Suite")

    all_results: List[BenchmarkResult] = []
    meta = get_sample_metrics()

    for key in selected_keys:
        title, runner = SUITES[key]
        if not args.json:
            print(f"\n{CYAN}{BOLD}▶ Running Suite: {title}{RESET}")
            print(f"{CYAN}{'-' * 50}{RESET}")
        
        if args.iterations:
            res_list = runner(iterations=args.iterations)
        else:
            res_list = runner()
        
        all_results.extend(res_list)

    if args.json:
        out_data = {
            "metadata": meta,
            "results": [
                {
                    "name": r.name,
                    "category": r.category,
                    "iterations": r.iterations,
                    "avg_ms": r.avg_ms,
                    "min_ms": r.min_ms,
                    "max_ms": r.max_ms,
                    "p50_ms": r.p50_ms,
                    "p95_ms": r.p95_ms,
                    "p99_ms": r.p99_ms,
                    "std_dev_ms": r.std_dev_ms,
                    "throughput_lines_sec": r.throughput_lines_sec,
                    "status": r.status_label,
                }
                for r in all_results
            ]
        }
        json_str = json.dumps(out_data, indent=2)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(json_str)
            print(f"JSON report saved to: {args.output}")
        else:
            print(json_str)
        return

    if args.markdown:
        md_report = generate_markdown_report(all_results, meta)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(md_report)
            print(f"Markdown report saved to: {args.output}")
        else:
            print(md_report)
        return

    # Standard console summary
    print_summary_table(all_results)

    if args.output:
        if args.output.endswith(".json"):
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump([vars(r) for r in all_results], f, indent=2)
        else:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(generate_markdown_report(all_results, meta))
        print(f"\n{GREEN}Report saved to: {args.output}{RESET}")


if __name__ == "__main__":
    main()
