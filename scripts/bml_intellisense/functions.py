import os
import re
import json
from bml_intellisense.utils import strip_html, extract_return_type, to_snippet_syntax
from bml_intellisense.knowledge_docs import (
    get_docs_excerpt,
    get_raw_doc_section,
    extract_examples_from_section,
    extract_parameters_from_section,
    knowledge_source_available,
)


def extract_outer_params_string(first_sig, func_name=None):
    if func_name:
        m = re.search(r"\b" + re.escape(func_name) + r"\s*\(", first_sig, re.IGNORECASE)
        idx = m.end() - 1 if m else first_sig.find("(")
    else:
        m = re.search(r"\b[a-zA-Z_]\w*\s*\(", first_sig)
        idx = m.end() - 1 if m else first_sig.find("(")

    if idx == -1:
        return ""
    depth = 0
    chars = []
    for c in first_sig[idx:]:
        if c == "(":
            depth += 1
            if depth > 1:
                chars.append(c)
        elif c == ")":
            depth -= 1
            if depth > 0:
                chars.append(c)
            elif depth == 0:
                break
        else:
            if depth >= 1:
                chars.append(c)
    return "".join(chars).strip()


def split_params_safely(param_str):
    raw_params = []
    curr = []
    depth = 0
    for char in param_str:
        if char in "(":
            depth += 1
            curr.append(char)
        elif char in ")":
            if depth > 0:
                depth -= 1
            curr.append(char)
        elif char == "," and depth == 0:
            part = "".join(curr).strip()
            if part:
                raw_params.append(part)
            curr = []
        else:
            curr.append(char)
    if curr:
        part = "".join(curr).strip()
        if part:
            raw_params.append(part)
    return raw_params


def parse_parameters_from_syntax(syntax, short_syntax=None, func_name=None):
    if not syntax:
        return []
    s = syntax.replace("&lt;", "<").replace("&gt;", ">")
    s = re.sub(r"\)\)\s*", ") ", s)
    s = re.sub(r"\)(?=[a-zA-Z_])", ") ", s)
    first_sig = re.split(r"(?:<br\s*/?>|\n\s*(?:OR|\(or\))\s*\n|\n)", s, flags=re.IGNORECASE)[0].strip()

    short_names = []
    if short_syntax:
        m_short = re.search(r"\((.*)\)", short_syntax)
        if m_short:
            inner_short = m_short.group(1).replace("[", "").replace("]", "").strip()
            short_names = [p.strip() for p in inner_short.split(",") if p.strip()]

    params_str = extract_outer_params_string(first_sig, func_name)
    if not params_str:
        return []

    raw_params = split_params_safely(params_str)
    parsed = []
    for i, raw in enumerate(raw_params):
        is_optional = "[" in raw
        cleaned = re.sub(r"[\[\]]", "", raw).strip()
        tokens = cleaned.split()

        if i < len(short_names) and short_names[i]:
            pname = short_names[i]
            if len(tokens) >= 2 and tokens[-1] == pname:
                ptype = " ".join(tokens[:-1])
            else:
                ptype = " ".join(tokens[:-1]) if len(tokens) >= 2 else (tokens[0] if tokens else "Any")
        else:
            if len(tokens) >= 2:
                pname = tokens[-1].rstrip(");,")
                ptype = " ".join(tokens[:-1])
            elif len(tokens) == 1:
                pname = tokens[0].rstrip(");,")
                ptype = "Any"
            else:
                continue

        parsed.append({
            "name": pname,
            "type": ptype,
            "required": not is_optional,
            "description": ""
        })
    return parsed


def _normalize_for_comparison(s):
    if not s:
        return ""
    return re.sub(r'\s+', '', s).strip().lower()


def generate_bml_functions(root_dir):
    input_path = os.path.join(root_dir, 'app', 'lookups', 'bml', 'common.json')
    output_path = os.path.join(root_dir, 'app', 'lang', 'intellisense', 'bml-functions-api-usage.json')

    print(f"[generateBmlFunctions] Reading: {os.path.relpath(input_path, root_dir)}")
    with open(input_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    have_fresh_source = knowledge_source_available(root_dir)
    if not have_fresh_source:
        print("[generateBmlFunctions] knowledge not found - preserving existing \"docs\" values")

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

        raw_section = get_raw_doc_section(root_dir, category, key) if have_fresh_source else None
        extracted_examples = []
        if raw_section:
            extracted_examples = extract_examples_from_section(raw_section)

        # Include example from common.json if present
        raw_example = item.get('example')
        if raw_example:
            cleaned = strip_html(raw_example).strip()
            if cleaned:
                norm_cleaned = _normalize_for_comparison(cleaned)
                already_covered = any(
                    _normalize_for_comparison(ex) == norm_cleaned or
                    _normalize_for_comparison(ex) in norm_cleaned
                    for ex in extracted_examples
                )
                if not already_covered and cleaned not in extracted_examples:
                    extracted_examples.insert(0, cleaned)

        # Fallback to existing examples if none extracted
        if not extracted_examples and existing_examples.get(key):
            extracted_examples = existing_examples[key]

        if extracted_examples:
            examples_found += 1

        raw_short_syntax = item.get('shortSyntax') or item.get('name')
        computed_syntax = to_snippet_syntax(raw_short_syntax)

        # Parse structured parameters
        syntax_params = parse_parameters_from_syntax(full_sig, item.get('shortSyntax'), key)
        section_params = extract_parameters_from_section(raw_section) if raw_section else {}
        final_params = []
        for sp in syntax_params:
            pname_lower = sp['name'].lower()
            if pname_lower in section_params:
                sp_desc = section_params[pname_lower].get('description') or sp['description']
                sp_type = section_params[pname_lower].get('type') or sp['type']
                final_params.append({
                    'name': sp['name'],
                    'type': sp_type,
                    'required': sp['required'],
                    'description': sp_desc
                })
            else:
                final_params.append(sp)

        result[key] = {
            "functionCategory": category or existing_entry.get("functionCategory"),
            "returnType": extract_return_type(full_sig) or existing_entry.get("returnType"),
            "fullSignature": full_sig if full_sig else None,
            "syntax": computed_syntax or existing_entry.get("syntax") or to_snippet_syntax(key),
            "parameters": final_params if final_params else existing_entry.get("parameters", []),
            "examples": extracted_examples,
            "notes": strip_html(item.get('description', '')) or existing_entry.get("notes"),
            "docs": docs,
        }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)

    print(f"[generateBmlFunctions] ok: {len(result)} functions ({docs_found} with docs excerpts, {examples_found} with code examples) -> {os.path.relpath(output_path, root_dir)}")
