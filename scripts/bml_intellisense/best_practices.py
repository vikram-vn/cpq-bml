import os
import json


def generate_best_practices(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'best-practice-advisories.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'best-practice-advisories.json')

    if not os.path.exists(input_path):
        input_path = output_path

    if os.path.exists(input_path):
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {}

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"[generateBestPractices] ok: {len(data)} best practice advisories -> {os.path.relpath(output_path, root_dir)}")
