"""Brotli-compresses the English spell-check dictionary for packaging.

english-words.txt is the readable, editable source (kept in git); this
generates english-words.txt.br (gitignored, ~5x smaller) that spelling.js
loads at runtime. Re-run automatically by `npm run compile`/`vscode:prepublish`
so the packaged extension never ships the uncompressed word list.
"""
import os

import brotli

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC_PATH = os.path.join(ROOT, "app", "lang", "spellCheck", "english-words.txt")
OUT_PATH = SRC_PATH + ".br"


def main():
    with open(SRC_PATH, "rb") as f:
        data = f.read()
    compressed = brotli.compress(data, quality=11)
    with open(OUT_PATH, "wb") as f:
        f.write(compressed)
    print(f"compressed english-words.txt: {len(data)} -> {len(compressed)} bytes")


if __name__ == "__main__":
    main()
