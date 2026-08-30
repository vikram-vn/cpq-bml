import os
import json


def generate_category_labels(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'function-category.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'category-labels.json')

    categories = {
        "function": "function",
        "attribute": "attribute",
        "variable": "variable",
        "snippet": "snippet",
        "keyword": "keyword",
        "constant": "constant"
    }

    function_categories = {}

    if os.path.exists(input_path):
        with open(input_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        items = raw.get('items', [])
        for item in items:
            code = item.get('lookupCode', '').lower()
            label = item.get('displayLabel', '').lower()
            if code and code != 'all':
                if code == 'direct_db_access':
                    function_categories[code] = 'database'
                elif code == 'url':
                    function_categories['url_access'] = 'url'
                elif code == 'array':
                    function_categories['arrays'] = 'array'
                elif code == 'others':
                    function_categories['others'] = 'misc'
                elif code == 'logical':
                    function_categories['logical'] = 'logic'
                else:
                    function_categories[code] = label

    # Ensure fallback keys are always present
    default_mappings = {
        "direct_db_access": "database",
        "arrays": "array",
        "string": "string",
        "date": "date",
        "dictionary": "dictionary",
        "json": "json",
        "math": "math",
        "url_access": "url",
        "xml": "xml",
        "others": "misc",
        "constant": "constant",
        "constants": "constant"
    }
    for k, v in default_mappings.items():
        if k not in function_categories:
            function_categories[k] = v

    result = {
        "categories": categories,
        "functionCategories": function_categories
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"[generateCategoryLabels] ok: {len(function_categories)} category mappings -> {os.path.relpath(output_path, root_dir)}")
