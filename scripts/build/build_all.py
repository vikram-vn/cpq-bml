"""Consolidated fast build runner for packaging assets.

Runs dictionary compression, CSS minification, JSON minification, AI skills
building, and AI skills compression in a single Python process with smart
mtime checks so unchanged assets are skipped instantaneously.
"""
import os
import json
import shutil
import brotli
import rcssmin

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# ── 1. Dictionary Compression ───────────────────────────────────────────────
SPELLCHECK_DIR = os.path.join(ROOT, "app", "lang", "spell-check")
DICT_FILES = ["bml-words.txt", "english-words.txt"]

def build_dictionaries():
    for file_name in DICT_FILES:
        src_path = os.path.join(SPELLCHECK_DIR, file_name)
        out_path = src_path + ".br"
        if os.path.exists(out_path) and os.path.getmtime(out_path) >= os.path.getmtime(src_path):
            continue
        with open(src_path, "rb") as f:
            data = f.read()
        compressed = brotli.compress(data, quality=6)
        with open(out_path, "wb") as f:
            f.write(compressed)
        print(f"compressed {file_name}: {len(data)} -> {len(compressed)} bytes")

# ── 2. CSS Minification ─────────────────────────────────────────────────────
CSS_DIR = os.path.join(ROOT, "app", "lang", "settings-panel", "web-view", "css")
CSS_FILES = ["main.css", "layout.css", "components.css"]

def minify_css():
    for file_name in CSS_FILES:
        src_path = os.path.join(CSS_DIR, file_name)
        out_path = os.path.join(CSS_DIR, file_name.replace(".css", ".min.css"))
        if os.path.exists(out_path) and os.path.getmtime(out_path) >= os.path.getmtime(src_path):
            continue
        with open(src_path, encoding="utf-8") as f:
            src = f.read()
        minified = rcssmin.cssmin(src)
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(minified)
        pct = round((1 - len(minified) / len(src)) * 100)
        print(f"minified {file_name}: {len(src)} -> {len(minified)} chars (-{pct}%)")

# ── 3. JSON Minification ────────────────────────────────────────────────────
INTELLISENSE_DIR = os.path.join(ROOT, "app", "lang", "intellisense")
JSON_FILES = [
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

def minify_json():
    for src_path in JSON_FILES:
        out_path = src_path.replace(".json", ".min.json")
        if os.path.exists(out_path) and os.path.getmtime(out_path) >= os.path.getmtime(src_path):
            continue
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

# ── 4 & 5. AI Skills Build & Compress ───────────────────────────────────────
from build_skills import build_skills, SRC_KNOWLEDGE_DIR
from compress_ai import main as compress_ai_main, DEST_FILE as AI_DEST_FILE, AI_DIR

def is_ai_up_to_date():
    if not os.path.exists(AI_DEST_FILE):
        return False
    ai_mtime = os.path.getmtime(AI_DEST_FILE)
    
    # Check knowledge files mtime
    if os.path.exists(SRC_KNOWLEDGE_DIR):
        for root_dir, _, files in os.walk(SRC_KNOWLEDGE_DIR):
            for f in files:
                if os.path.getmtime(os.path.join(root_dir, f)) > ai_mtime:
                    return False
    
    # Check build script mtime
    script_path = os.path.join(ROOT, "scripts", "build", "build_skills.py")
    if os.path.exists(script_path) and os.path.getmtime(script_path) > ai_mtime:
        return False

    return True

def process_ai_skills():
    if is_ai_up_to_date():
        return
    build_skills()
    compress_ai_main()

# ── Main Entry Point ────────────────────────────────────────────────────────
def main():
    build_dictionaries()
    minify_css()
    minify_json()
    process_ai_skills()

if __name__ == "__main__":
    main()
