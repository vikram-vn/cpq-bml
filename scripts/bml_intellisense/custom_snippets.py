import os
import json


def generate_custom_snippets(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'custom-snippets.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'custom-snippets.json')

    if not os.path.exists(input_path):
        input_path = output_path

    if os.path.exists(input_path):
        with open(input_path, 'r', encoding='utf-8') as f:
            snippets_data = json.load(f)
    else:
        snippets_data = {}

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(snippets_data, f, indent=2, ensure_ascii=False)

    print(f"[generateCustomSnippets] ok: {len(snippets_data)} snippets -> {os.path.relpath(output_path, root_dir)}")
