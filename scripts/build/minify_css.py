"""Minifies the settings webview CSS for packaging.

The .css files are the readable, editable sources kept in git; this
generates .min.css siblings (gitignored, comments/whitespace stripped) that
html.js references via webview.asWebviewUri. CSS is loaded by the webview's
browser context as a static resource (not read by our Node code), so unlike
the dictionary/JSON/markdown assets it can't be transparently decompressed
at runtime - minifying to a real file is the only lever available here.
Re-run automatically by `npm run compile` / `vscode:prepublish`.
"""
import os

import rcssmin

CSS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "app", "lang", "settingsPanel", "webview", "css")

FILES_TO_MINIFY = [
    "main.css",
    "layout.css",
    "components.css",
]


def main():
    for file_name in FILES_TO_MINIFY:
        src_path = os.path.join(CSS_DIR, file_name)
        out_path = os.path.join(CSS_DIR, file_name.replace(".css", ".min.css"))

        with open(src_path, encoding="utf-8") as f:
            src = f.read()
        minified = rcssmin.cssmin(src)
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(minified)
        pct = round((1 - len(minified) / len(src)) * 100)
        print(f"minified {file_name}: {len(src)} -> {len(minified)} chars (-{pct}%)")


if __name__ == "__main__":
    main()
