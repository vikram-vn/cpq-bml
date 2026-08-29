"""
Python module to extract and sanitize documentation excerpts and code examples from
the crawled markdown files under `knowledge/BML/` for hover IntelliSense generation.
"""
import os
import re

CATEGORY_MAP = {
    'string': 'String.md',
    'math': 'Math.md',
    'date': 'Date.md',
    'json': 'Json.md',
    'xml': 'XML.md',
    'dictionary': 'Dictionary.md',
    'array': 'Arrays.md',
    'arrays': 'Arrays.md',
    'bmql': 'BMQL.md',
    'url': 'URLAccess.md',
    'others': 'Others.md',
    'others-bom': 'Others-BOM.md',
    'others-constants': 'Others-Constants.md',
    'others-globaldict': 'Others-GlobalDict.md',
    'others-sysconfig': 'Others-SysConfig.md',
    'others-usersessions': 'Others-UserSessions.md',
    'direct_db_access': 'DirectDBAccess.md',
}

ADMONITION_ICON = {'note': '📝', 'tip': '💡', 'info': 'ℹ️', 'warning': '⚠️', 'danger': '🚫'}

_md_cache = {}


def _knowledge_dir(root_dir):
    return os.path.join(root_dir, 'knowledge', 'BML')


def knowledge_source_available(root_dir):
    """True if the crawled markdown is present."""
    return os.path.isdir(_knowledge_dir(root_dir))


def _load_markdown(root_dir, category):
    """Reads (and caches) the raw markdown source for a category, or None if missing."""
    rel_path = CATEGORY_MAP.get(category.lower()) if category else None
    if not rel_path:
        return None
    if rel_path in _md_cache:
        return _md_cache[rel_path]

    abs_path = os.path.join(_knowledge_dir(root_dir), rel_path)
    if not os.path.exists(abs_path):
        _md_cache[rel_path] = None
        return None

    with open(abs_path, encoding='utf-8') as f:
        content = f.read()
    _md_cache[rel_path] = content
    return content


def extract_function_section(md_body, name):
    """Finds the "## <name>" section (case-insensitive) and returns everything
    up to the next "## " heading."""
    heading_re = re.compile(r'^##\s+' + re.escape(name) + r'\s*$', re.IGNORECASE | re.MULTILINE)
    match = heading_re.search(md_body)
    if not match:
        return None

    rest = md_body[match.end():]
    next_heading = re.search(r'^##\s+', rest, re.MULTILINE)
    section = rest[:next_heading.start()] if next_heading else rest
    section = section.strip()
    return section or None


def _is_table_row(line):
    return bool(re.match(r'^\s*\|.*\|\s*$', line))


def _is_table_separator_row(line):
    return bool(re.match(r'^\s*\|?[\s:|-]+\|?\s*$', line)) and '-' in line


def _parse_table_row(line):
    return [c.strip() for c in line.strip().lstrip('|').rstrip('|').split('|')]


def _convert_tables_to_list(text):
    lines = text.split('\n')
    out = []
    i = 0
    while i < len(lines):
        if _is_table_row(lines[i]) and i + 1 < len(lines) and _is_table_separator_row(lines[i + 1]):
            headers = _parse_table_row(lines[i])
            i += 2
            while i < len(lines) and _is_table_row(lines[i]):
                cells = _parse_table_row(lines[i])
                parts = [f"**{h}:** {cells[idx] if idx < len(cells) else ''}" for idx, h in enumerate(headers)]
                out.append(f"- {' · '.join(parts)}")
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return '\n'.join(out)


def _replace_admonition(match):
    admonition_type = match.group(1).lower()
    body = match.group(2).strip()
    icon = ADMONITION_ICON.get(admonition_type, 'ℹ️')
    label = admonition_type.capitalize()
    return f"> {icon} **{label}:** {body}"


def sanitize_section_for_hover(section):
    """Sanitizes raw markdown section for clean VS Code Hover tooltips."""
    text = _convert_tables_to_list(section)
    text = re.sub(r'^\*\*Syntax:\*\*.*$', '', text, count=1, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r'!\[([^\]]*)\]\([^)]*\)', lambda m: f'*🖼️ {m.group(1)}*' if m.group(1) else '', text)
    text = re.sub(r':::(\w+)\s*\r?\n?([\s\S]*?):::', _replace_admonition, text)
    text = re.sub(r'\*\*Example:\*\*[\s\S]*$', '', text, flags=re.IGNORECASE).strip()
    text = re.sub(r'```(?:bml|json|xml)?[\s\S]*?```', '', text).strip()
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'^-{3,}\s*|\s*-{3,}$', '', text)
    return text.strip()


def get_raw_doc_section(root_dir, category, name):
    """Returns the raw "## <name>" markdown section for a function, with fallback search."""
    md_body = _load_markdown(root_dir, category)
    if md_body:
        section = extract_function_section(md_body, name)
        if section:
            return section

    kdir = _knowledge_dir(root_dir)
    if os.path.exists(kdir):
        for fname in os.listdir(kdir):
            if fname.endswith('.md'):
                fpath = os.path.join(kdir, fname)
                try:
                    with open(fpath, encoding='utf-8') as f:
                        content = f.read()
                    section = extract_function_section(content, name)
                    if section:
                        return section
                except Exception:
                    continue
    return None


def extract_examples_from_section(section):
    """Extracts code blocks (```bml ... ```, ```json ... ```, or ```xml ... ```) from a markdown section."""
    if not section:
        return []

    pattern = re.compile(r'```(?:bml|json|xml|text|java)?(?:\s+title="[^"]*")?\s*\n([\s\S]*?)\n```', re.IGNORECASE)
    matches = pattern.findall(section)
    examples = []
    for match in matches:
        code = match.strip()
        if code and code not in examples:
            examples.append(code)
    return examples


def extract_parameters_from_section(section):
    """Extracts parameter descriptions from tables in the markdown section."""
    if not section:
        return {}
    params = {}
    lines = section.split('\n')
    in_table = False
    headers = []
    for line in lines:
        if '|' in line and not in_table:
            if 'parameter' in line.lower() or 'data type' in line.lower():
                in_table = True
                headers = [h.strip().lower() for h in line.strip().strip('|').split('|')]
                continue
        elif in_table:
            if not line.strip() or not line.strip().startswith('|'):
                in_table = False
                continue
            if _is_table_separator_row(line):
                continue
            cells = _parse_table_row(line)
            if len(cells) >= len(headers):
                row = dict(zip(headers, cells))
                pname = row.get('parameter', '').replace('`', '').strip()
                ptype = row.get('data type', '').replace('`', '').strip()
                pdesc = row.get('description', '').strip()
                if pname:
                    params[pname.lower()] = {
                        'name': pname,
                        'type': ptype,
                        'description': pdesc
                    }
    return params


def get_docs_excerpt(root_dir, category, name):
    section = get_raw_doc_section(root_dir, category, name)
    if not section:
        return None
    return sanitize_section_for_hover(section)

