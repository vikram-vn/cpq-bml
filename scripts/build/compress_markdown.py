"""Brotli-compresses all BML knowledge markdown files for packaging.

The raw .md files are the editable sources kept in git; this script
generates .md.br files (gitignored, ~3-5x smaller) that helpViewer.js
decompresses at runtime via Node's built-in zlib - no extra dependency.
Re-run automatically by `npm run compile` / `vscode:prepublish`.
"""
import os

import brotli

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
KNOWLEDGE_DIR = os.path.join(ROOT, "app", "knowledge")


def compress_dir(dir_path, totals):
    for entry in sorted(os.listdir(dir_path)):
        full = os.path.join(dir_path, entry)
        if os.path.isdir(full):
            compress_dir(full, totals)
        elif entry.endswith(".md"):
            out_path = full + ".br"
            with open(full, "rb") as f:
                data = f.read()
            compressed = brotli.compress(data, quality=11)
            with open(out_path, "wb") as f:
                f.write(compressed)
            totals["raw"] += len(data)
            totals["compressed"] += len(compressed)
            totals["count"] += 1
            pct = round((1 - len(compressed) / len(data)) * 100)
            rel = os.path.relpath(full, ROOT)
            print(f"  compressed {rel}: {len(data)} -> {len(compressed)} bytes (-{pct}%)")


def main():
    print("Compressing knowledge markdown files...")
    totals = {"raw": 0, "compressed": 0, "count": 0}
    compress_dir(KNOWLEDGE_DIR, totals)
    total_pct = round((1 - totals["compressed"] / totals["raw"]) * 100)
    print(
        f"\nDone: {totals['count']} files, "
        f"{round(totals['raw'] / 1024)} KB -> {round(totals['compressed'] / 1024)} KB (-{total_pct}%)"
    )


if __name__ == "__main__":
    main()
