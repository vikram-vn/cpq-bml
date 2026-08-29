"""
elements/inline.py - Inline HTML element handlers.

Covers: strong/b, em/i, a, span, br, sub, sup, del/s.
"""
import os
import urllib.parse


def convert_inline(tag_name: str, children_md: str, element, context) -> str | None:
    """
    Convert an inline element.  context is the HtmlToDocusaurus converter instance
    (used for URL resolution).

    Returns markdown string or None if not handled.
    """
    if tag_name in ("strong", "b"):
        text = children_md.strip()
        return f"**{text}**" if text else ""

    if tag_name in ("em", "i"):
        text = children_md.strip()
        return f"*{text}*" if text else ""

    if tag_name in ("del", "s", "strike"):
        text = children_md.strip()
        return f"~~{text}~~" if text else ""

    if tag_name == "sub":
        text = children_md.strip()
        return f"<sub>{text}</sub>" if text else ""

    if tag_name == "sup":
        text = children_md.strip()
        return f"<sup>{text}</sup>" if text else ""

    if tag_name == "br":
        return "\n"

    if tag_name == "span":
        return children_md  # transparent wrapper

    if tag_name == "a":
        return _convert_anchor(children_md, element, context)

    if tag_name == "abbr":
        text = children_md.strip()
        title = element.get("title", "")
        return f'<abbr title="{title}">{text}</abbr>' if title else text

    return None  # not handled


def _convert_anchor(children_md: str, element, context) -> str:
    """Resolve <a href> to a relative local path or keep as-is."""
    text = children_md.strip()
    href = element.get("href", "")

    if not href or href.startswith("javascript:") or href == "#":
        return text

    # Try to resolve to local workspace file
    resolved = context.resolve_url(href)
    local_path = context.get_workspace_path(resolved)
    if local_path and context.current_output_path:
        rel = os.path.relpath(local_path, os.path.dirname(context.current_output_path))
        rel = rel.replace("\\", "/")
        return f"[{text}]({rel})" if text else rel

    # External link
    return f"[{text}]({href})" if text else href