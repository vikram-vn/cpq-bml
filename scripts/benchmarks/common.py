"""
Common Benchmark Harness for Oracle CPQ-BML Extension
Provides timing, statistical analysis (p50, p95, p99, min, max, avg, throughput),
Node.js extension bridge, and rich CLI / Markdown reporting.
"""

import json
import math
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Any

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Root paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
SAMPLE_BML_PATH = os.path.join(ROOT_DIR, "bml", "sample.bml")

# Terminal color constants
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
BLUE = "\033[34m"
RED = "\033[31m"
MAGENTA = "\033[35m"
DIM = "\033[2m"

@dataclass
class BenchmarkResult:
    name: str
    category: str
    iterations: int
    avg_ms: float
    min_ms: float
    max_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    std_dev_ms: float
    throughput_lines_sec: int
    total_lines: int
    extra: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_batch_operation(self) -> bool:
        return self.category in ("CodeActions", "Batch") or "Fix-All" in self.name

    @property
    def status_label(self) -> str:
        if self.avg_ms < 1.0:
            return "⚡ INSTANT (<1ms)"
        elif self.is_batch_operation:
            if self.avg_ms < 500.0:
                return "⚡ FAST BATCH (<500ms)"
            elif self.avg_ms < 1000.0:
                return "✅ GOOD BATCH (<1s)"
            else:
                return "⚠️ ATTENTION"
        else:
            if self.avg_ms < 50.0:
                return "✅ EXCELLENT (<50ms)"
            elif self.avg_ms < 150.0:
                return "⚡ FAST (<150ms)"
            else:
                return "⚠️ ATTENTION"

    @property
    def status_color(self) -> str:
        if self.avg_ms < 50.0 or (self.is_batch_operation and self.avg_ms < 500.0):
            return GREEN
        elif self.avg_ms < 150.0 or (self.is_batch_operation and self.avg_ms < 1000.0):
            return YELLOW
        else:
            return RED


def load_sample_bml() -> str:
    """Load the standard sample.bml fixture."""
    if os.path.exists(SAMPLE_BML_PATH):
        with open(SAMPLE_BML_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return "// sample bml\nreturn true;\n"


def get_sample_metrics() -> Dict[str, Any]:
    """Get metadata for the sample BML file."""
    content = load_sample_bml()
    lines = content.splitlines()
    return {
        "path": SAMPLE_BML_PATH,
        "line_count": len(lines),
        "size_kb": len(content.encode("utf-8")) / 1024.0,
        "char_count": len(content),
    }


def compute_statistics(
    name: str,
    category: str,
    times_ms: List[float],
    total_lines: int
) -> BenchmarkResult:
    """Calculate statistics from recorded execution times in milliseconds."""
    sorted_times = sorted(times_ms)
    n = len(sorted_times)
    total = sum(sorted_times)
    avg = total / n
    min_val = sorted_times[0]
    max_val = sorted_times[-1]

    p50 = sorted_times[int(n * 0.50)]
    p95 = sorted_times[min(int(n * 0.95), n - 1)]
    p99 = sorted_times[min(int(n * 0.99), n - 1)]

    variance = sum((t - avg) ** 2 for t in sorted_times) / n if n > 1 else 0.0
    std_dev = math.sqrt(variance)

    total_sec = total / 1000.0
    throughput = int((total_lines * n) / total_sec) if total_sec > 0 else 0

    return BenchmarkResult(
        name=name,
        category=category,
        iterations=n,
        avg_ms=avg,
        min_ms=min_val,
        max_ms=max_val,
        p50_ms=p50,
        p95_ms=p95,
        p99_ms=p99,
        std_dev_ms=std_dev,
        throughput_lines_sec=throughput,
        total_lines=total_lines,
    )


def run_node_benchmark(
    name: str,
    category: str,
    setup_code: str,
    run_code: str,
    iterations: int = 50,
    warmup: int = 5,
    custom_line_count: Optional[int] = None
) -> BenchmarkResult:
    """
    Execute JavaScript benchmark inside Node.js with high-resolution performance.now()
    and return statistical metrics back to Python.
    """
    sample_info = get_sample_metrics()
    total_lines = custom_line_count or sample_info["line_count"]

    escaped_root = ROOT_DIR.replace("\\", "\\\\")

    driver_script = f"""
const fs = require('fs');
const path = require('path');
const {{ performance }} = require('perf_hooks');

// Setup minimal VS Code Mock
const Module = require('module');
const origRequire = Module.prototype.require;
function MockPosition(l, c) {{
    this.line = l;
    this.character = c;
    this.translate = (dl = 0, dc = 0) => new MockPosition(this.line + dl, this.character + dc);
    this.isEqual = (o) => o && this.line === o.line && this.character === o.character;
}}
const vscodeMock = {{
    workspace: {{
        getConfiguration: () => ({{ get: (k, d) => d }}),
        createFileSystemWatcher: () => ({{ onDidChange: () => {{}}, onDidCreate: () => {{}}, onDidDelete: () => {{}} }}),
        workspaceFolders: [{{ uri: {{ fsPath: '{escaped_root}' }} }}]
    }},
    languages: {{
        registerCompletionItemProvider: () => ({{ dispose: () => {{}} }}),
        registerHoverProvider: () => ({{ dispose: () => {{}} }}),
        registerSignatureHelpProvider: () => ({{ dispose: () => {{}} }}),
        registerDefinitionProvider: () => ({{ dispose: () => {{}} }}),
        registerReferenceProvider: () => ({{ dispose: () => {{}} }}),
        registerRenameProvider: () => ({{ dispose: () => {{}} }}),
        registerDocumentSymbolProvider: () => ({{ dispose: () => {{}} }}),
        registerInlayHintsProvider: () => ({{ dispose: () => {{}} }}),
        registerCodeActionsProvider: () => ({{ dispose: () => {{}} }}),
        createDiagnosticCollection: () => ({{ set: () => {{}}, clear: () => {{}}, delete: () => {{}}, dispose: () => {{}} }})
    }},
    Position: MockPosition,
    Range: function(s, e, sc, ec) {{
        if (typeof s === 'number') {{
            this.start = new MockPosition(s, e);
            this.end = new MockPosition(sc, ec);
        }} else {{
            this.start = s;
            this.end = e;
        }}
    }},
    Diagnostic: function(r, m, s) {{ this.range = r; this.message = m; this.severity = s; this.tags = []; }},
    DiagnosticSeverity: {{ Error: 0, Warning: 1, Information: 2, Hint: 3 }},
    DiagnosticTag: {{ Unnecessary: 1, Deprecated: 2 }},
    CompletionItem: function(l, k) {{ this.label = l; this.kind = k; }},
    CompletionItemKind: {{ Method: 0, Function: 1, Property: 2, Variable: 3, Class: 4 }},
    SnippetString: function(v) {{ this.value = v; }},
    MarkdownString: function(v) {{ this.value = v; this.appendCodeblock = () => {{}}; this.appendMarkdown = () => {{}}; }},
    ParameterInformation: function(l) {{ this.label = l; }},
    SignatureInformation: function(l, d) {{ this.label = l; this.documentation = d; }},
    SignatureHelp: function() {{ this.signatures = []; this.activeSignature = 0; this.activeParameter = 0; }},
    Uri: {{ file: (f) => ({{ fsPath: f, toString: () => f }}) }},
    Location: function(u, p) {{ this.uri = u; this.range = p; }},
    WorkspaceEdit: function() {{ this.replace = () => {{}}; }},
    CodeAction: function(title, kind) {{ this.title = title; this.kind = kind; this.diagnostics = []; }},
    CodeActionKind: {{
        QuickFix: 'quickfix',
        Refactor: 'refactor',
        RefactorRewrite: 'refactor.rewrite',
        SourceFixAll: 'source.fixAll'
    }}
}};
Module.prototype.require = function(r) {{
    if (r === 'vscode') return vscodeMock;
    return origRequire.apply(this, arguments);
}};

const rootDir = '{escaped_root}';
const sampleBmlPath = path.join(rootDir, 'bml', 'sample.bml');
const sampleBml = fs.readFileSync(sampleBmlPath, 'utf8');

{setup_code}

// Warmup
for (let i = 0; i < {warmup}; i++) {{
    {run_code}
}}

// Benchmark Runs
const times = [];
for (let i = 0; i < {iterations}; i++) {{
    const t0 = performance.now();
    {run_code}
    const t1 = performance.now();
    times.push(t1 - t0);
}}

console.log(JSON.stringify({{ times }}));
"""

    proc = subprocess.run(
        ["node", "-e", driver_script],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=True
    )

    data = json.loads(proc.stdout)
    return compute_statistics(name, category, data["times"], total_lines)


def print_header(title: str) -> None:
    """Print an aesthetic section header."""
    metrics = get_sample_metrics()
    print(f"\n{CYAN}{BOLD}{'=' * 72}{RESET}")
    print(f" {BOLD}🚀 ORACLE CPQ-BML BENCHMARK — {title.upper()}{RESET}")
    print(f"{CYAN}{BOLD}{'=' * 72}{RESET}")
    print(f" {DIM}Target Document:{RESET} bml/sample.bml ({metrics['line_count']:,} lines, {metrics['size_kb']:.1f} KB)")
    print(f" {DIM}Python Version:{RESET}  {sys.version.split()[0]}")
    print(f" {DIM}Platform:{RESET}        {sys.platform}")
    print(f"{CYAN}{BOLD}{'=' * 72}{RESET}\n")


def print_result_card(res: BenchmarkResult) -> None:
    """Print a detailed result card for a single benchmark run."""
    print(f"⚡ {BOLD}[{res.category}] {res.name}{RESET}")
    print(f"   {DIM}Iterations:{RESET} {res.iterations:,} runs")
    print(f"   {DIM}Average:{RESET}    {res.status_color}{BOLD}{res.avg_ms:.2f} ms{RESET} (p50: {res.p50_ms:.2f} ms, p95: {res.p95_ms:.2f} ms, p99: {res.p99_ms:.2f} ms)")
    print(f"   {DIM}Min / Max:{RESET}  {res.min_ms:.2f} ms / {res.max_ms:.2f} ms (σ = {res.std_dev_ms:.2f} ms)")
    print(f"   {DIM}Throughput:{RESET} {CYAN}{BOLD}{res.throughput_lines_sec:,}{RESET} lines / sec")
    print(f"   {DIM}Rating:{RESET}     {res.status_color}{res.status_label}{RESET}\n")


def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes for accurate string width calculation."""
    import re
    return re.sub(r'\x1b\[[0-9;]*m', '', text)


def print_summary_table(results: List[BenchmarkResult]) -> None:
    """Print a clean, beautifully aligned terminal table with full statistics."""
    if not results:
        return

    # Column definitions: (Header, Key, Align)
    headers = [
        "Category",
        "Subsystem / Feature",
        "Avg (ms)",
        "p95 (ms)",
        "Min / Max (ms)",
        "Throughput (lines/s)",
        "Rating"
    ]

    rows = []
    for r in results:
        rows.append([
            r.category,
            r.name,
            f"{r.avg_ms:.2f} ms",
            f"{r.p95_ms:.2f} ms",
            f"{r.min_ms:.2f} / {r.max_ms:.2f} ms",
            f"{r.throughput_lines_sec:,} l/s",
            r.status_label
        ])

    # Calculate max column widths
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(strip_ansi(val)))

    # Box-drawing characters
    top_border    = "┌─" + "─┬─".join("─" * w for w in col_widths) + "─┐"
    header_sep    = "├─" + "─┼─".join("─" * w for w in col_widths) + "─┤"
    bottom_border = "└─" + "─┴─".join("─" * w for w in col_widths) + "─┘"

    print(f"\n{CYAN}{BOLD}{'=' * (sum(col_widths) + len(col_widths) * 3 + 1)}{RESET}")
    print(f" {BOLD}📊 ORACLE CPQ-BML END-TO-END BENCHMARK SCORECARD{RESET}")
    print(f"{CYAN}{BOLD}{'=' * (sum(col_widths) + len(col_widths) * 3 + 1)}{RESET}\n")

    print(f"{CYAN}{top_border}{RESET}")

    # Print Header
    header_cells = []
    for i, h in enumerate(headers):
        header_cells.append(f"{BOLD}{h.ljust(col_widths[i])}{RESET}")
    print(f"{CYAN}│{RESET} " + f" {CYAN}│{RESET} ".join(header_cells) + f" {CYAN}│{RESET}")
    print(f"{CYAN}{header_sep}{RESET}")

    # Print Rows
    for r_idx, (res, row) in enumerate(zip(results, rows)):
        row_cells = []
        for i, val in enumerate(row):
            # Right-align numeric columns
            if i in (2, 3, 4, 5):
                padded = val.rjust(col_widths[i])
            else:
                padded = val.ljust(col_widths[i])
            
            # Apply color highlighting
            if i == 0:
                cell_str = f"{BLUE}{padded}{RESET}"
            elif i == 1:
                cell_str = f"{BOLD}{padded}{RESET}"
            elif i in (2, 3):
                cell_str = f"{res.status_color}{padded}{RESET}"
            elif i == 6:
                cell_str = f"{res.status_color}{padded}{RESET}"
            else:
                cell_str = padded
            row_cells.append(cell_str)

        print(f"{CYAN}│{RESET} " + f" {CYAN}│{RESET} ".join(row_cells) + f" {CYAN}│{RESET}")

    print(f"{CYAN}{bottom_border}{RESET}\n")
