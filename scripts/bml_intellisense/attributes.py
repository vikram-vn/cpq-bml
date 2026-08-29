import os
import json

def get_bml_attributes_data_type(item):
    dt = item.get('dataType')
    if not dt:
        return 'String'
    return dt.get('displayValue') or dt.get('displayLabel') or 'String'

def get_bml_attributes_menu_values(item):
    if not item.get('isMenuType') or not isinstance(item.get('availableElements'), list) or len(item.get('availableElements')) == 0:
        return None
    vals = []
    for e in item.get('availableElements'):
        v = e.get('displayValue') or e.get('value')
        if v:
            vals.append(v)
    return vals[:10]

def generate_bml_attributes(root_dir):
    commerce_dir = os.path.join(root_dir, 'app', 'lookups', 'commerce')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml-attributes-api-usage.json')

    sources = [
        {"file": os.path.join(commerce_dir, 'transaction.json'), "context": 'Transaction'},
        {"file": os.path.join(commerce_dir, 'transaction-line.json'), "context": 'Line Item'},
        {"file": os.path.join(commerce_dir, 'system-variables.json'), "context": 'System'}
    ]
    
    output = {}
    
    for src in sources:
        filepath = src["file"]
        context = src["context"]
        if not os.path.exists(filepath):
            print(f"[generateBmlAttributes] WARNING: File not found, skipping: {os.path.relpath(filepath, root_dir)}")
            continue
            
        print(f"[generateBmlAttributes] Reading [{context}]: {os.path.relpath(filepath, root_dir)}")
        with open(filepath, 'r', encoding='utf-8') as f:
            raw = json.load(f)
            
        items = raw.get('items', [])
        for item in items:
            key = item.get('name')
            if not key:
                continue
            
            if context == 'Line Item':
                ex = [f'val = line.{key};']
            else:
                ex = [f'val = {key};']

            output[key] = {
                "scope": context,
                "dataType": get_bml_attributes_data_type(item),
                "syntax": key,
                "examples": ex,
                "notes": item.get('description') or item.get('displayLabel') or '',
                "values": get_bml_attributes_menu_values(item)
            }
        print(f"[generateBmlAttributes]   -> {len(items)} items from {os.path.basename(filepath)}")
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=4, ensure_ascii=False)
        
    print(f"[generateBmlAttributes] ok: {len(output)} attributes -> {os.path.relpath(output_path, root_dir)}")
