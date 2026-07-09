"""Extracts and sanitizes per-function reference sections from the crawled
knowledge base (scratch/knowledge/BML/**/*.md - see scripts/docs/bml_crawler),
for embedding directly into bml-functions-api-usage.json's "docs" field.

scratch/ is gitignored on purpose: the crawled markdown is a disposable
intermediate, not something we want committed. Only the JSON this produces is
kept in git. That means a fresh clone has no markdown to extract from -
generate_bml_functions() in functions.py checks knowledge_source_available()
and falls back to preserving whatever "docs" values are already in the
existing output file, rather than silently wiping them out to None.

This replaces what used to be a runtime feature (a separate offline-docs
webview panel, plus JS code that read+parsed the markdown on every hover).
Doing the extraction once here means the extension ships a single JSON file
and needs zero markdown parsing, file reads, or webview machinery at runtime -
the hover just reads info["docs"] directly. Images are dropped entirely (not
shipped, not rendered) - only their alt text remains, so the hover stays
readable without needing to package any screenshots.
"""
import os
import re

# Maps bml-functions-api-usage.json's "functionCategory" field to the knowledge
# base file that documents it. Categories not listed here (e.g. "logical",
# which covers control-flow keyword docs like "if..."/"if...else") have no
# per-function reference page - generate_bml_functions() should simply not
# set "docs" for those.
CATEGORY_MAP = {
    'string': 'string/string.md',
    'math': 'math/math.md',
    'date': 'date/date.md',
    'json': 'json/json.md',
    'xml': 'xml/xml.md',
    'dictionary': 'dictionary/dictionary.md',
    'array': 'array/arrays.md',
    'arrays': 'array/arrays.md',
    'bmql': 'bmql/bmql.md',
    'url': 'url-access/urlAccess.md',
    'others': 'others/others.md',
    'direct_db_access': 'direct-db-access/directDbAccess.md',
}

ADMONITION_ICON = {'note': '📝', 'tip': '💡', 'info': 'ℹ️', 'warning': '⚠️', 'danger': '🚫'}

_md_cache = {}


def _knowledge_dir(root_dir):
    return os.path.join(root_dir, 'scratch', 'knowledge', 'BML')


def knowledge_source_available(root_dir):
    """True if the crawled markdown is present (e.g. scripts/docs/bml_crawler
    was just run). False on a fresh clone, where scratch/ is gitignored and
    empty - callers should treat that as "can't refresh, preserve existing
    docs values" rather than "no docs exist"."""
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
    up to the next "## " heading. Docs that aren't structured this way (e.g.
    bmql.md, a prose guide with no per-function headings) simply won't match -
    callers should treat None as "no excerpt available"."""
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
    """VS Code's hover popover renders markdown tables poorly (cramped width,
    no real column-alignment support) - especially bad for code-heavy cells
    like parameter tables. Converts each data row into a
    "**Header:** value · **Header:** value" bullet instead."""
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
    """Converts a raw per-function doc section into hover-safe markdown:
    - strips the redundant "**Syntax:**" line (already shown via the code
      block the hover renders above this excerpt)
    - replaces images with an italicized placeholder built from their alt
      text instead of shipping/rendering them - dropping them silently would
      leave the lead-in sentence dangling ("...you will see:" followed by
      nothing), so the placeholder stays purely descriptive.
    - turns ":::type ... :::" admonition containers (not standard markdown,
      markdown-it-container syntax used by the crawled docs) into a
      blockquote so they render as *something* instead of literal "::: " text
    - trims a leading/trailing "---" (the section's own divider before the
      next heading in the source file, meaningless once excerpted alone)
    - converts parameter tables into bullets (see _convert_tables_to_list)
    """
    text = _convert_tables_to_list(section)
    text = re.sub(r'^\*\*Syntax:\*\*.*$', '', text, count=1, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r'!\[([^\]]*)\]\([^)]*\)', lambda m: f'*🖼️ {m.group(1)}*' if m.group(1) else '', text)
    text = re.sub(r':::(\w+)\r?\n([\s\S]*?):::', _replace_admonition, text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'^-{3,}\s*|\s*-{3,}$', '', text)
    return text.strip()


def get_docs_excerpt(root_dir, category, name):
    """Returns the sanitized "## <name>" section for a function, or None if
    the category has no matching knowledge base file or heading."""
    md_body = _load_markdown(root_dir, category)
    if not md_body:
        return None
    section = extract_function_section(md_body, name)
    if not section:
        return None
    return sanitize_section_for_hover(section)
