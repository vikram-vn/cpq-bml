"""Minifies JSON files for packaging - both the ones VS Code core loads
directly by path (themes, TextMate grammars) and the intellisense data files
apiDataLoader.js reads at runtime.

The pretty .json files (indent=4, readable/diffable in git - see
scripts/bml_intellisense/*.py, which generate them) are the editable/generated
sources kept in git; this generates .min.json siblings (gitignored) that ship
instead. Re-run automatically by `npm run compile` / `vscode:prepublish`.
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
INTELLISENSE_DIR = os.path.join(ROOT, "app", "lang", "intellisense")

FILES_TO_MINIFY = [
    os.path.join(ROOT, "themes", "dark-default.json"),
    os.path.join(ROOT, "themes", "dark.json"),
    os.path.join(ROOT, "themes", "light-default.json"),
    os.path.join(ROOT, "themes", "light.json"),
    os.path.join(ROOT, "app", "lang", "syntaxes", "bml.tmLanguage.json"),
    os.path.join(ROOT, "app", "lang", "syntaxes", "xslt.tmLanguage.json"),
    os.path.join(INTELLISENSE_DIR, "bml-functions-api-usage.json"),
    os.path.join(INTELLISENSE_DIR, "bml-attributes-api-usage.json"),
    os.path.join(INTELLISENSE_DIR, "bml-cpq-js-api-usage.json"),
    os.path.join(INTELLISENSE_DIR, "bml-util-attributes-api-usage.json"),
    os.path.join(INTELLISENSE_DIR, "bml-variables-api-usage.json"),
    os.path.join(INTELLISENSE_DIR, "custom-snippets.json"),
    os.path.join(INTELLISENSE_DIR, "function-param-data-types.json"),
    os.path.join(INTELLISENSE_DIR, "function-return-types.json"),
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
