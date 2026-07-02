import os
import json
from bml_intellisense.utils import strip_html, extract_return_type, to_snippet_syntax

def generate_bml_functions(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'common.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml_functions_api_usage.json')
    
    print(f"[generateBmlFunctions] Reading: {os.path.relpath(input_path, root_dir)}")
    with open(input_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)
        
    items = raw.get('items', [])
    result = {}
    
    for item in items:
        key = item.get('name')
        if not key:
            continue
        full_sig = strip_html(item.get('syntax', ''))
        result[key] = {
            "functionCategory": item.get('category').lower() if item.get('category') else None,
            "returnType": extract_return_type(full_sig),
            "fullSignature": full_sig if full_sig else None,
            "syntax": to_snippet_syntax(item.get('shortSyntax') or item.get('name')),
            "examples": [strip_html(item.get('example'))] if item.get('example') else [],
            "notes": strip_html(item.get('description', ''))
        }
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
        
    print(f"[generateBmlFunctions] ok: {len(result)} functions -> {os.path.relpath(output_path, root_dir)}")
