"""Brotli-compresses the spell-check dictionaries for packaging.

bml-words.txt and english-words.txt are the readable, editable sources kept
in git; this generates .br siblings (gitignored, several times smaller) that
spelling.js loads at runtime. Re-run automatically by `npm run compile`/
`vscode:prepublish` so the packaged extension never ships the uncompressed
word lists.
"""
import os

import brotli

SPELLCHECK_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "app", "lang", "spellCheck")

FILES_TO_COMPRESS = [
    "bml-words.txt",
    "english-words.txt",
]


def main():
    for file_name in FILES_TO_COMPRESS:
        src_path = os.path.join(SPELLCHECK_DIR, file_name)
        out_path = src_path + ".br"

        with open(src_path, "rb") as f:
            data = f.read()
        compressed = brotli.compress(data, quality=11)
        with open(out_path, "wb") as f:
            f.write(compressed)
        print(f"compressed {file_name}: {len(data)} -> {len(compressed)} bytes")


if __name__ == "__main__":
    main()
