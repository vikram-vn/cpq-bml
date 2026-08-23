import os
import json
from bml_intellisense.utils import strip_html, extract_return_type, to_snippet_syntax
from bml_intellisense.knowledge_docs import (
    get_docs_excerpt,
    get_raw_doc_section,
    extract_examples_from_section,
    knowledge_source_available,
)

def generate_bml_functions(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'common.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml-functions-api-usage.json')

    print(f"[generateBmlFunctions] Reading: {os.path.relpath(input_path, root_dir)}")
    with open(input_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    have_fresh_source = knowledge_source_available(root_dir)
    if not have_fresh_source:
        print("[generateBmlFunctions] scratch/knowledge not found - preserving existing \"docs\" values")

    existing_docs = {}
    existing_examples = {}
    existing_data = {}
    if os.path.exists(output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except Exception:
            existing_data = {}

    for k, v in existing_data.items():
        existing_docs[k] = v.get('docs')
        existing_examples[k] = v.get('examples', [])

    items = raw.get('items', [])
    result = dict(existing_data)
    docs_found = 0
    examples_found = 0

    for item in items:
        key = item.get('name')
        if not key:
            continue
        item_syntax = strip_html(item.get('syntax', ''))
        category = item.get('category').lower() if item.get('category') else None

        existing_entry = existing_data.get(key, {})
        full_sig = existing_entry.get('fullSignature') or item_syntax

        docs = get_docs_excerpt(root_dir, category, key) if have_fresh_source else existing_docs.get(key)
        if docs:
            docs_found += 1

        extracted_examples = []
        if have_fresh_source:
            raw_section = get_raw_doc_section(root_dir, category, key)
            if raw_section:
                extracted_examples = extract_examples_from_section(raw_section)

        # Include example from common.json if present
        raw_example = item.get('example')
        if raw_example:
            cleaned = strip_html(raw_example).strip()
            if cleaned and cleaned not in extracted_examples:
                extracted_examples.insert(0, cleaned)

        # Fallback to existing examples if none extracted
        if not extracted_examples and existing_examples.get(key):
            extracted_examples = existing_examples[key]

        if extracted_examples:
            examples_found += 1

        result[key] = {
            "functionCategory": category or existing_entry.get("functionCategory"),
            "returnType": extract_return_type(full_sig) or existing_entry.get("returnType"),
            "fullSignature": full_sig if full_sig else None,
            "syntax": existing_entry.get("syntax") or to_snippet_syntax(item.get('shortSyntax') or item.get('name')),
            "examples": extracted_examples,
            "notes": strip_html(item.get('description', '')) or existing_entry.get("notes"),
            "docs": docs,
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)

    print(f"[generateBmlFunctions] ok: {len(result)} functions ({docs_found} with docs excerpts, {examples_found} with code examples) -> {os.path.relpath(output_path, root_dir)}")
