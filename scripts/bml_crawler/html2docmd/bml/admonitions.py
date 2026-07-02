"""
bml/admonitions.py - Oracle Help Site admonition (callout) detection.

Converts both:
1. CSS-class-based admonitions:  <div class="Note">...</div>
2. Text-pattern admonitions:     <p>Note: some important text.</p>

Docusaurus output:
    :::note
    content
    :::
"""

# CSS class -> Docusaurus admonition type mapping
_CLASS_MAP: dict[str, str] = {
    # Note variants
    "note":       "note",
    "Note":       "note",
    "note-box":   "note",
    "callout":    "note",
    # Tip variants
    "tip":        "tip",
    "Tip":        "tip",
    "hint":       "tip",
    # Warning variants
    "warning":    "warning",
    "Warning":    "warning",
    "caution":    "warning",
    "Caution":    "warning",
    # Info variants
    "info":       "info",
    "Info":       "info",
    "important":  "info",
    "Important":  "info",
    # Danger variants
    "danger":     "danger",
    "Danger":     "danger",
    "error":      "danger",
}

# Text-prefix -> Docusaurus admonition type mapping
_PREFIX_MAP: list[tuple[str, str]] = [
    ("Note:",      "note"),
    ("Tip:",       "tip"),
    ("Warning:",   "warning"),
    ("Caution:",   "warning"),
    ("Important:", "info"),
    ("Info:",      "info"),
]


def detect_admonition(element, children_md: str) -> str | None:
    """
    If element is a recognized admonition container (by CSS class or text prefix),
    return a Docusaurus :::type ... ::: block.

    Returns None if not an admonition.
    """
    tag = element.name

    # 1. CSS class detection (works on div, aside, section, p)
    classes = element.get("class", [])
    for cls in classes:
        adm_type = _CLASS_MAP.get(cls)
        if adm_type:
            body = children_md.strip()
            return f"\n\n:::{adm_type}\n{body}\n:::\n\n"

    # 2. Text-prefix detection (only for <p> and short block elements)
    if tag in ("p", "div", "aside"):
        text = element.get_text().strip()
        for prefix, adm_type in _PREFIX_MAP:
            if text.startswith(prefix):
                body = children_md.strip()
                # Rewrite first line: strip the "Note:" prefix from the md output
                body_lines = body.splitlines()
                if body_lines:
                    first = body_lines[0]
                    for pfx, _ in _PREFIX_MAP:
                        if first.strip().startswith(pfx):
                            body_lines[0] = first.strip()[len(pfx):].strip()
                            break
                body = "\n".join(body_lines).strip()
                return f"\n\n:::{adm_type}\n{body}\n:::\n\n"

    return None