import os
import json

def generate_bml_data_types(root_dir):
    lookups_dir = os.path.join(root_dir, 'app', 'lookups', 'bml')
    output_dir = os.path.join(root_dir, 'app', 'lang', 'intellisense')
    files = ['function-param-data-types.json', 'function-return-types.json']
    
    for filename in files:
        input_path = os.path.join(lookups_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        print(f"[generateBmlDataTypes] Reading: {os.path.relpath(input_path, root_dir)}")
        with open(input_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
            
        items = raw.get('items', [])
        result = {}
        for item in items:
            code = item.get('lookupCode')
            if not isinstance(code, int):
                continue
            result[code] = item.get('displayLabel')
            
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=4, ensure_ascii=False)
            
        print(f"[generateBmlDataTypes] ok: {len(result)} entries -> {os.path.relpath(output_path, root_dir)}")
