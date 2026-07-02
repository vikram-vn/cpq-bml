"""
elements/block.py - Block-level HTML element handlers.
Covers: h1-h6, p, blockquote, hr, div (generic wrapper).
"""


def convert_block(tag_name: str, children_md: str, element) -> str | None:
    """
    Convert a block-level element to Docusaurus markdown.

    Returns the markdown string, or None if tag_name is not handled here
    (caller should fall through to next handler).
    """
    if tag_name in ("h1", "h2", "h3", "h4", "h5", "h6"):
        level = int(tag_name[1])
        text = children_md.strip()
        return f"\n\n{'#' * level} {text}\n\n" if text else ""

    if tag_name == "p":
        text = children_md.strip()
        return f"\n\n{text}\n\n" if text else "\n\n"

    if tag_name == "blockquote":
        lines = children_md.strip().splitlines()
        quoted = "\n".join(f"> {l}" for l in lines)
        return f"\n\n{quoted}\n\n"

    if tag_name == "hr":
        return "\n\n---\n\n"

    if tag_name == "div":
        return f"\n{children_md}\n"

    if tag_name == "section":
        return f"\n{children_md}\n"

    if tag_name == "article":
        return f"\n{children_md}\n"

    return None  # not handled