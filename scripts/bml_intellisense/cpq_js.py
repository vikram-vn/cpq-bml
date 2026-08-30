import os
import json


def generate_cpq_js(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'commerce', 'cpq-js.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml-cpq-js-api-usage.json')

    if not os.path.exists(input_path):
        input_path = output_path

    if os.path.exists(input_path):
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        data = {}

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"[generateCpqJs] ok: {len(data)} CPQJS methods -> {os.path.relpath(output_path, root_dir)}")
