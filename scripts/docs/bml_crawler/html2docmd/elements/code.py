"""
elements/code.py - Code block and inline code element handlers.

Handles:
  <pre><code>...</code></pre>  -> fenced ```lang title="..." block
  <code>...</code>             -> `inline code`

Language detection heuristics:
  - BML (default)
  - SQL  (select ... from ...)
  - XML  (<tag> ... </tag>)
  - JSON ({ ... } or [ ... ])
  - JavaScript (function / var / const / let / =>;)
"""
import re


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

def detect_language(code: str) -> str:
    """Heuristically detect the language of a code block."""
    stripped = code.strip()

    # XML / HTML
    if re.search(r"<[a-zA-Z][^>]*>", stripped) and ("</" in stripped or "/>" in stripped):
        return "xml"

    # SQL
    if re.search(r"\bselect\b.+\bfrom\b", stripped, re.IGNORECASE):
        return "sql"

    # JSON
    if (stripped.startswith("{") or stripped.startswith("[")) and (
        re.search(r'"[^"]+"\s*:', stripped)
    ):
        return "json"

    # JavaScript / TypeScript
    if re.search(r"\b(function|const|let|var|=>|import|export)\b", stripped):
        return "javascript"

    # Default: BML
    return "bml"


# ---------------------------------------------------------------------------
# Title extraction from sibling context
# ---------------------------------------------------------------------------

def extract_title_from_sibling(element) -> str:
    """
    Look at the previous sibling element. If it looks like an example or
    syntax label, use its short text as the code block title.
    """
    prev = element.find_previous_sibling()
    if prev and prev.name in ("p", "h4", "h5", "h6", "div"):
        text = prev.get_text().strip()
        kw = text.lower()
        if "example" in kw or "syntax" in kw or "usage" in kw:
            title = re.split(r"[:\n.]", text)[0].strip()
            if 0 < len(title) <= 60:
                return title
    return ""


# ---------------------------------------------------------------------------
# Public handlers
# ---------------------------------------------------------------------------

def convert_pre(element, children_md: str) -> str:
    """Convert a <pre> block to a fenced Docusaurus code block."""
    code_text = children_md.strip()
    lang = detect_language(code_text)
    title = extract_title_from_sibling(element)
    title_attr = f' title="{title}"' if title else ""
    return f"\n```{lang}{title_attr}\n{code_text}\n```\n"


def convert_code(element, children_md: str) -> str:
    """Convert an inline <code> element (not inside <pre>) to backtick syntax."""
    text = children_md.strip()
    if not text:
        return ""
    # Multi-line inline code → convert to fenced block
    if "\n" in text:
        lang = detect_language(text)
        return f"\n```{lang}\n{text}\n```\n"
    return f"`{text}`"