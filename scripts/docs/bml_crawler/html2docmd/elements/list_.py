"""
elements/list_.py - List element handlers.

Supports:
- Unordered lists  <ul> -> * item
- Ordered lists    <ol> -> 1. 2. 3.
- Nested lists with 2-space indentation per level
- <li> with nested <ul>/<ol> children
"""


def convert_list(tag_name: str, children_md: str) -> str | None:
    """Wrap list children in appropriate surrounding newlines."""
    if tag_name in ("ul", "ol"):
        return f"\n{children_md}\n"
    return None


def convert_listitem(element, children_md: str) -> str:
    """
    Convert a <li> element to a markdown list item with correct prefix
    and indentation for nesting.
    """
    parent = element.parent
    prefix = "* "  # default: unordered

    if parent and parent.name == "ol":
        # Find 1-based index of this <li> among siblings
        siblings = [s for s in parent.children if getattr(s, "name", None) == "li"]
        try:
            idx = siblings.index(element) + 1
        except ValueError:
            idx = 1
        prefix = f"{idx}. "

    # Calculate nesting depth
    indent_level = 0
    current = parent
    while current and current.parent:
        if getattr(current.parent, "name", None) in ("ul", "ol"):
            indent_level += 1
        current = current.parent

    indent = "  " * indent_level
    content = children_md.strip()
    return f"{indent}{prefix}{content}\n"