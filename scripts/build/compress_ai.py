import os
import json
import brotli

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
AI_DIR = os.path.join(ROOT, "app", "ai")
DEST_FILE = os.path.join(ROOT, "dist", "ai.br")

def collect_files(directory, base_dir, payload):
    if not os.path.exists(directory):
        return
    for entry in os.scandir(directory):
        if entry.is_dir():
            collect_files(entry.path, base_dir, payload)
        elif entry.is_file() and entry.name.endswith(('.md', '.json', '.txt')):
            rel_path = os.path.relpath(entry.path, base_dir).replace("\\", "/")
            try:
                with open(entry.path, "r", encoding="utf-8") as f:
                    payload[rel_path] = f.read()
            except Exception as e:
                print(f"Skipping non-UTF8 file {entry.path}: {e}")

def main():
    print("Compressing AI skills into dist/ai.br...")
    payload = {}

    # 1. Collect skills directory
    skills_dir = os.path.join(AI_DIR, "skills")
    if os.path.exists(skills_dir):
        collect_files(skills_dir, AI_DIR, payload)
    else:
        print("Warning: app/ai/skills does not exist.")

    # 2. Collect bml-skills.md if exists
    summary_file = os.path.join(AI_DIR, "bml-skills.md")
    if os.path.exists(summary_file):
        with open(summary_file, "r", encoding="utf-8") as f:
            payload["bml-skills.md"] = f.read()

    # 3. Compress
    os.makedirs(os.path.dirname(DEST_FILE), exist_ok=True)
    json_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    compressed = brotli.compress(json_bytes, quality=6)

    with open(DEST_FILE, "wb") as f:
        f.write(compressed)

    print(f"Successfully compressed {len(payload)} files to dist/ai.br ({len(compressed) / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
