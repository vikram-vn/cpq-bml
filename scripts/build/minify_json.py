"""Minifies JSON files that VS Code core loads directly by path (themes and
TextMate grammars), for packaging.

These are declared in package.json's "contributes.themes"/"contributes.grammars"
paths and read straight off disk by VS Code itself - not through our own Node
code - so unlike the dictionary/JSON-data/markdown assets they can't be
transparently decompressed at runtime. Whitespace stripping (this script) is
the only lever available, same as the webview CSS. The pretty .json files are
the editable sources kept in git; this generates .min.json siblings
(gitignored) that package.json's contribution paths point to instead.
Re-run automatically by `npm run compile` / `vscode:prepublish`.
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")

FILES_TO_MINIFY = [
    os.path.join(ROOT, "themes", "dark-default.json"),
    os.path.join(ROOT, "themes", "dark.json"),
    os.path.join(ROOT, "themes", "light-default.json"),
    os.path.join(ROOT, "themes", "light.json"),
    os.path.join(ROOT, "app", "lang", "syntaxes", "bml.tmLanguage.json"),
    os.path.join(ROOT, "app", "lang", "syntaxes", "xslt.tmLanguage.json"),
]


def main():
    for src_path in FILES_TO_MINIFY:
        out_path = src_path.replace(".json", ".min.json")

        with open(src_path, encoding="utf-8") as f:
            data = json.load(f)
        minified = json.dumps(data, separators=(",", ":"))
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(minified)

        src_size = os.path.getsize(src_path)
        out_size = os.path.getsize(out_path)
        pct = round((1 - out_size / src_size) * 100)
        rel = os.path.relpath(src_path, ROOT)
        print(f"minified {rel}: {src_size} -> {out_size} bytes (-{pct}%)")


if __name__ == "__main__":
    main()
