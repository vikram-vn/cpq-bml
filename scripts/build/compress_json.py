"""Brotli-compresses ALL intellisense JSON data files for packaging.

The raw .json files are the editable sources kept in git; this script
generates .json.br files (gitignored, ~3-6x smaller) that the extension
decompresses at runtime via Node's built-in zlib - no extra dependency.
Re-run automatically by `npm run compile` / `vscode:prepublish`.
"""
import os

import brotli

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
INTELLISENSE_DIR = os.path.join(ROOT, "app", "lang", "intellisense")

FILES_TO_COMPRESS = [
    "bml_functions_api_usage.json",
    "bml_attributes_api_usage.json",
    "bml_cpq_js_api_usage.json",
    "bml_util_attributes_api_usage.json",
    "bml_variables_api_usage.json",
    "custom_snippets.json",
    "functionParamDataTypes.json",
    "functionReturnTypes.json",
]


def main():
    for file_name in FILES_TO_COMPRESS:
        src_path = os.path.join(INTELLISENSE_DIR, file_name)
        out_path = src_path + ".br"

        with open(src_path, "rb") as f:
            data = f.read()
        compressed = brotli.compress(data, quality=11)
        with open(out_path, "wb") as f:
            f.write(compressed)
        pct = round((1 - len(compressed) / len(data)) * 100)
        print(f"compressed {file_name}: {len(data)} -> {len(compressed)} bytes (-{pct}%)")


if __name__ == "__main__":
    main()
