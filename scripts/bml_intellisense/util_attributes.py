import os
import json

def generate_bml_util_attributes(root_dir):
    config_dir = os.path.join(root_dir, 'app', 'lookups', 'configuration')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml-util-attributes-api-usage.json')

    sources = [
        {"file": os.path.join(config_dir, 'attributes.json'), "context": 'Configuration'},
        {"file": os.path.join(config_dir, 'product-family-attributes.json'), "context": 'Product Family'}
    ]
    
    output = {}
    
    for src in sources:
        filepath = src["file"]
        context = src["context"]
        if not os.path.exists(filepath):
            print(f"[generateBmlUtilAttributes] WARNING: File not found, skipping: {os.path.relpath(filepath, root_dir)}")
            continue
            
        print(f"[generateBmlUtilAttributes] Reading [{context}]: {os.path.relpath(filepath, root_dir)}")
        with open(filepath, 'r', encoding='utf-8') as f:
            raw = json.load(f)
            
        items = raw.get('items', [])
        for item in items:
            key = item.get('variableName') or item.get('name')
            if not key:
                continue
            
            dt = item.get('dataType')
            dataType = dt.get('displayValue') if isinstance(dt, dict) else 'String'

            output[key] = {
                "scope": f"util.{context}",
                "dataType": dataType,
                "syntax": f"util.{key}",
                "examples": [f'val = util.{key};'],
                "notes": item.get('description') or item.get('label') or item.get('displayLabel') or ''
            }
        print(f"[generateBmlUtilAttributes]   -> {len(items)} items from {os.path.basename(filepath)}")
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=4, ensure_ascii=False)
        
    print(f"[generateBmlUtilAttributes] ok: {len(output)} util attributes -> {os.path.relpath(output_path, root_dir)}")
