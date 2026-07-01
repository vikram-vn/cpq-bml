import os
import json

def generate_bml_variables(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'commonVariables.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml_variables_api_usage.json')
    
    print(f"[generateBmlVariables] Reading: {os.path.relpath(input_path, root_dir)}")
    with open(input_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)
        
    items = raw.get('items', [])
    result = {}
    
    for item in items:
        key = item.get('lookupCode')
        if not key:
            continue
        dt = item.get('dataType').get('displayLabel') if item.get('dataType') else 'String'
        label = item.get('displayLabel') or key
        desc = item.get('description') or label
        
        result[key] = {
            "scope": "BML Variable",
            "dataType": dt,
            "syntax": key,
            "examples": [],
            "notes": desc
        }
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
        
    print(f"[generateBmlVariables] ok: {len(result)} variables -> {os.path.relpath(output_path, root_dir)}")
