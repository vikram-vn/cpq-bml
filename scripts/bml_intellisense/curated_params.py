import os
import json
import re


def clean_param_name(name):
    if not name:
        return ""
    name = re.sub(r"\(or.*?\)", "", name, flags=re.IGNORECASE).strip()
    name = re.sub(r"[\[\]\(\)]", "", name).strip()
    tokens = name.split()
    if tokens:
        return tokens[-1].rstrip(");,")
    return name


def extract_params_from_entry(name, data):
    """
    Dynamically extract parameter names from a function entry in JSON data.
    Inspects structured 'parameters' list, 'fullSignature', and 'syntax'.
    """
    # 1. Structured parameters array from JSON
    params = data.get("parameters")
    if params and isinstance(params, list) and len(params) > 0:
        names = [clean_param_name(p.get("name")) for p in params if isinstance(p, dict) and p.get("name")]
        names = [n for n in names if n]
        if names:
            return names

    # 2. Dynamic parse from fullSignature or syntax
    sig = data.get("fullSignature") or data.get("syntax") or ""
    match = re.search(r"\(([^)]*)\)", sig)
    if match:
        inner = match.group(1).strip()
        if not inner:
            return []
        parts = inner.split(",")
        names = []
        for part in parts:
            clean = re.sub(r"[\[\]]", "", part).strip()
            # If snippet format ${1:paramName}
            snip_match = re.search(r"\$\{\d+:([^}]+)\}", clean)
            if snip_match:
                names.append(clean_param_name(snip_match.group(1)))
            else:
                tokens = clean.split()
                if tokens:
                    names.append(clean_param_name(tokens[-1]))
        return [n for n in names if n]

    return []


def should_skip_key(key):
    """Filter out non-function constants, keywords, or array constructs."""
    return (
        key.startswith("BM_")
        or key in {"NaN", "jNaN", "break", "continue", "if...", "if...else", "if...else...if", "for...loop"}
        or key.endswith("[n]")
        or key.endswith("[n][n]")
    )


def generate_curated_params(root_dir):
    """
    Dynamically generates app/lang/intellisense/curated-params.json
    by aggregating parameter signatures across all intellisense JSON files.
    """
    intellisense_dir = os.path.join(root_dir, 'app', 'lang', 'intellisense')
    funcs_path = os.path.join(intellisense_dir, 'bml-functions-api-usage.json')
    cpqjs_path = os.path.join(intellisense_dir, 'bml-cpq-js-api-usage.json')
    output_path = os.path.join(intellisense_dir, 'curated-params.json')

    curated = {}

    # 1. Ingest built-in BML functions
    if os.path.exists(funcs_path):
        with open(funcs_path, 'r', encoding='utf-8') as f:
            funcs_data = json.load(f)
        for k, v in funcs_data.items():
            if should_skip_key(k):
                continue
            curated[k.lower()] = extract_params_from_entry(k, v)

    # 2. Ingest CPQJS client-side functions
    if os.path.exists(cpqjs_path):
        with open(cpqjs_path, 'r', encoding='utf-8') as f:
            cpqjs_data = json.load(f)
        for k, v in cpqjs_data.items():
            if should_skip_key(k):
                continue
            curated[k.lower()] = extract_params_from_entry(k, v)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(curated, f, indent=4, ensure_ascii=False)

    print(f"[generateCuratedParams] ok: {len(curated)} parameter signatures dynamically generated -> {os.path.relpath(output_path, root_dir)}")
