"""
bml/param_table.py - Oracle Help parameter table detector.

Oracle CPQ help pages describe function parameters as a flat sequence of
<p> elements (one per cell):

  <p>Parameter</p>
  <p>Data Type</p>
  <p>Description</p>
  <p>date</p>
  <p></p>         ← blank row between param and type on some pages
  <p>Date</p>
  <p>Represents the given date.</p>
  ...

This module detects the three-header sentinel and consumes the subsequent
sibling elements to produce a proper Markdown table, stopping when it hits
a "Return Type:", "Example:", or the next ## heading.
"""

import re

_STOP_PREFIXES = (
    "Return Type:",
    "Example",
    "## ",
    "---",
)

_HEADER_WORDS = ("Parameter", "Data Type", "Description")


def is_param_table_header(elements: list) -> bool:
    """
    Given a list of 3 consecutive element texts, return True if they match
    the Oracle parameter table header pattern.
    """
    if len(elements) < 3:
        return False
    texts = [e.strip() if isinstance(e, str) else e.get_text().strip()
             for e in elements[:3]]
    return tuple(texts) == _HEADER_WORDS


def consume_param_table(sibling_iter) -> str:
    """
    Consume parameter row elements from an iterator of siblings,
    building and returning a Markdown parameter table string.

    The iterator should be positioned AFTER the three header elements.
    """
    raw: list[str] = []
    for sib in sibling_iter:
        text = sib.get_text().strip() if hasattr(sib, "get_text") else str(sib).strip()
        if not text:
            continue
        # Stop at sentinel lines
        if any(text.startswith(p) for p in _STOP_PREFIXES):
            break
        raw.append(text)

    # Group into triplets: (name, type, description)
    rows = []
    for i in range(0, len(raw) - 2, 3):
        rows.append((raw[i], raw[i + 1], raw[i + 2]))

    if not rows:
        return ""

    lines = [
        "| Parameter | Data Type | Description |",
        "| --- | --- | --- |",
    ]
    for param, dtype, desc in rows:
        # Wrap param in backtick if it looks like an identifier
        param_fmt = f"`{param}`" if re.match(r'^[\w\[\]_]+$', param) else param
        lines.append(f"| {param_fmt} | {dtype} | {desc} |")

    return "\n\n" + "\n".join(lines) + "\n\n"