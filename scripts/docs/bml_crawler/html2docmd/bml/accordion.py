"""
bml/accordion.py - Oracle Help Site accordion header detector.

Oracle CPQ Help pages use an <img src="...transparent.gif"> trick for
collapsible accordion section headers. The image is a 1px transparent GIF
and the surrounding text is the section/function name.

This module detects those patterns and converts them to ## Markdown headers.
"""

# Tags that may wrap an accordion header image
_ACCORDION_TAGS = frozenset(["p", "div", "b", "strong", "h3", "h4", "span"])


def is_accordion_header(element) -> bool:
    """
    Return True if this element is an Oracle accordion header
    (directly wraps a transparent.gif toggle <img>, e.g. <p><img></p>
    or <p><a><img></a></p>).

    The toggle icon must be a close descendant (at most one wrapper level
    away, like the <a> link). Using a fully recursive search would also
    match large container elements (e.g. the page's main content <div>)
    that merely happen to contain a toggle icon somewhere deep inside —
    which would swallow the entire subtree as a single flattened heading.
    """
    if element.name not in _ACCORDION_TAGS:
        return False
    for img in element.find_all("img"):
        src = img.get("src", "")
        if "transparent.gif" not in src:
            continue
        parent = img.parent
        if parent is element or (parent is not None and parent.parent is element):
            return True
    return False


def convert_accordion(element) -> str:
    """
    Convert an accordion header element to a Docusaurus ## heading.
    The image is stripped; remaining text becomes the header text.
    """
    # Clone and remove img tags to get clean text
    import copy
    clone = copy.copy(element)
    for img in clone.find_all("img"):
        img.decompose()
    text = clone.get_text(separator=" ").strip()
    if not text:
        return ""
    return f"\n\n## {text}\n\n"