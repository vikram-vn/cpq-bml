"""
bml/syntax.py - BML Oracle Help Site function documentation formatter.

Converts plain-text patterns emitted by the crawler into Docusaurus-style
formatted sections:

  "Syntax: signature(args)"   ->  **Syntax:**\n```bml\nsignature(args)\n```
  "Return Type: Float"        ->  > **Return Type:** `Float`
  "Example: code_line;"       ->  **Example:**\n```bml title="Example"\ncode\n```
  "Example:"                  ->  **Example:**
"""

import re

# Compiled patterns for fast matching
_SYNTAX_RE      = re.compile(r'^\s*Syntax:\s*(.+)$',     re.IGNORECASE)
_RETURN_RE      = re.compile(r'^\s*Return Type:\s*(.+)$', re.IGNORECASE)
_EX_CODE_RE     = re.compile(r'^\s*Example:\s*(.+)$',    re.IGNORECASE)
_EX_HEADING_RE  = re.compile(r'^\s*Example:\s*$',        re.IGNORECASE)


def format_syntax_line(text: str) -> str | None:
    """
    If text matches 'Syntax: <signature>', return a fenced BML code block.
    Otherwise return None.
    """
    m = _SYNTAX_RE.match(text)
    if not m:
        return None
    sig = m.group(1).strip()
    return f"\n**Syntax:**\n```bml\n{sig}\n```\n"


def format_return_type(text: str) -> str | None:
    """
    If text matches 'Return Type: <type>', return a Docusaurus blockquote badge.
    Otherwise return None.
    """
    m = _RETURN_RE.match(text)
    if not m:
        return None
    rtype = m.group(1).strip()
    return f"\n> **Return Type:** `{rtype}`\n"


def format_example_line(text: str, peek_next_lines: list[str] | None = None) -> str | None:
    """
    If text matches 'Example: <code>', return a fenced BML code block.
    If text matches 'Example:' alone, return just the heading.
    Otherwise return None.

    peek_next_lines: optional list of subsequent lines for multi-line examples.
    """
    # Single-line code example
    m = _EX_CODE_RE.match(text)
    if m:
        code = m.group(1).strip()
        return f'\n**Example:**\n```bml title="Example"\n{code}\n```\n'

    # Heading-only "Example:"
    if _EX_HEADING_RE.match(text):
        return "\n**Example:**\n"

    return None