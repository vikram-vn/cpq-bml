import os
import json
from bml_intellisense.utils import strip_html, extract_return_type, to_snippet_syntax
from bml_intellisense.knowledge_docs import get_docs_excerpt, knowledge_source_available

def generate_bml_functions(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'common.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml_functions_api_usage.json')

    print(f"[generateBmlFunctions] Reading: {os.path.relpath(input_path, root_dir)}")
    with open(input_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    # scratch/knowledge (the crawled markdown docs) is gitignored - a fresh
    # clone won't have it. When it's missing, fall back to whatever "docs"
    # values are already baked into the existing output file instead of
    # wiping every one of them out to null.
    have_fresh_source = knowledge_source_available(root_dir)
    if not have_fresh_source:
        print("[generateBmlFunctions] scratch/knowledge not found - preserving existing \"docs\" values "
              "(run scripts/docs/bml_crawler to refresh them)")
    existing_docs = {}
    if not have_fresh_source and os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            existing_docs = {k: v.get('docs') for k, v in json.load(f).items()}

    items = raw.get('items', [])
    result = {}
    docs_found = 0

    for item in items:
        key = item.get('name')
        if not key:
            continue
        full_sig = strip_html(item.get('syntax', ''))
        category = item.get('category').lower() if item.get('category') else None
        docs = get_docs_excerpt(root_dir, category, key) if have_fresh_source else existing_docs.get(key)
        if docs:
            docs_found += 1
        result[key] = {
            "functionCategory": category,
            "returnType": extract_return_type(full_sig),
            "fullSignature": full_sig if full_sig else None,
            "syntax": to_snippet_syntax(item.get('shortSyntax') or item.get('name')),
            "examples": [strip_html(item.get('example'))] if item.get('example') else [],
            "notes": strip_html(item.get('description', '')),
            "docs": docs,
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)

    print(f"[generateBmlFunctions] ok: {len(result)} functions ({docs_found} with docs excerpts) -> {os.path.relpath(output_path, root_dir)}")
