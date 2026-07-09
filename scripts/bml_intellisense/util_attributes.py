import os
import json

def get_bml_util_attributes_data_type(item):
    dt = item.get('dataType')
    if not dt:
        return 'String'
    if isinstance(dt, str):
        return dt
    return dt.get('displayValue') or dt.get('displayLabel') or str(dt)

def get_bml_util_attributes_key(item):
    return item.get('variableName') or item.get('name')

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
            key = get_bml_util_attributes_key(item)
            if not key:
                continue
                
            dt = get_bml_util_attributes_data_type(item)
            label = item.get('displayLabel') or key
            desc = item.get('description') or label
            
            output[key] = {
                "scope": context,
                "dataType": dt,
                "syntax": key,
                "examples": [],
                "notes": desc
            }
        print(f"[generateBmlUtilAttributes]   -> {len(items)} items from {os.path.basename(filepath)}")
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=4, ensure_ascii=False)
        
    print(f"[generateBmlUtilAttributes] ok: {len(output)} util attributes -> {os.path.relpath(output_path, root_dir)}")
