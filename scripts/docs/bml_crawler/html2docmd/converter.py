"""
converter.py - Main HtmlToDocusaurus orchestrator.

Dispatches each BeautifulSoup element to the appropriate handler module
in the following priority order:
  1. BML-specific patterns (accordion, admonitions, param tables)
  2. Standard element handlers (block, code, inline, image, list, table)
  3. Fallback: recurse into children

Entry points:
  HtmlToDocusaurus.convert(element) -> str
  HtmlToDocusaurus.generate_frontmatter(soup, url, body_text) -> str
"""

import re
import os
import urllib.parse
from bs4 import NavigableString

from .frontmatter import generate_frontmatter as _gen_frontmatter
from .elements.block  import convert_block
from .elements.code   import convert_pre, convert_code
from .elements.inline import convert_inline
from .elements.image  import convert_image
from .elements.list_  import convert_list, convert_listitem
from .elements.table  import convert_table
from .bml.accordion   import is_accordion_header, convert_accordion
from .bml.admonitions import detect_admonition
from .bml.syntax      import format_syntax_line, format_return_type, format_example_line

# Tags whose content should be completely ignored
_SKIP_TAGS = frozenset(["script", "style", "noscript", "head", "meta", "link", "iframe"])

# Tags that produce no wrapper but recurse into children
_TRANSPARENT_TAGS = frozenset([
    "span", "font", "label", "form", "fieldset", "legend",
    "main", "header", "footer", "nav", "aside",
    "tbody", "thead", "tfoot",  # handled by table.py already
])


class HtmlToDocusaurus:
    """
    Converts a BeautifulSoup element tree to Docusaurus-flavoured Markdown.

    Args:
        base_url: Base URL of the documentation site (used for link resolution).
        output_dir: Local path to the knowledge output directory.
        current_url: URL of the page currently being converted.
        current_output_path: Absolute local path where the .md file will be written.
        download_image_callback: Optional callable(img_url) -> local_path | None.
    """

    def __init__(
        self,
        base_url: str,
        output_dir: str,
        current_url: str = "",
        current_output_path: str = "",
        download_image_callback=None,
    ):
        self.base_url = base_url
        self.output_dir = output_dir
        self.current_url = current_url
        self.current_output_path = current_output_path
        self.download_image_callback = download_image_callback

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_frontmatter(self, soup, url: str, body_text: str) -> str:
        return _gen_frontmatter(soup, url, body_text, self.base_url)

    def convert(self, element) -> str:
        """Recursively convert a BS4 element to Docusaurus markdown."""
        # Plain text node
        if isinstance(element, NavigableString):
            return str(element) if element.string else ""

        tag = element.name
        if not tag:
            return ""

        # 1. Skip unwanted tags entirely
        if tag in _SKIP_TAGS:
            return ""

        # 2. BML: accordion header (transparent.gif)
        if is_accordion_header(element):
            return convert_accordion(element)

        # 3. Build children markdown (needed by most handlers)
        children_md = "".join(self.convert(child) for child in element.children)

        # 4. BML: admonition detection (div/p with class or text prefix)
        admonition = detect_admonition(element, children_md)
        if admonition is not None:
            return admonition

        # 5. Standard: block elements
        result = convert_block(tag, children_md, element)
        if result is not None:
            return self._apply_bml_line_transforms(result) if tag == "p" else result

        # 6. Standard: code / pre
        if tag == "pre":
            return convert_pre(element, children_md)
        if tag == "code":
            if element.parent and element.parent.name == "pre":
                return children_md  # raw content inside pre — let pre handle it
            return convert_code(element, children_md)

        # 7. Standard: image
        if tag == "img":
            return convert_image(element, self)

        # 8. Standard: inline elements
        result = convert_inline(tag, children_md, element, self)
        if result is not None:
            return result

        # 9. Standard: lists
        list_result = convert_list(tag, children_md)
        if list_result is not None:
            return list_result
        if tag == "li":
            return convert_listitem(element, children_md)

        # 10. Standard: table
        if tag == "table":
            return convert_table(element, self.convert)
        if tag in ("td", "th"):
            return children_md.strip()

        # 11. Transparent wrappers
        if tag in _TRANSPARENT_TAGS:
            return children_md

        # 12. Fallback: recurse children
        return children_md

    # ------------------------------------------------------------------
    # BML line-level transforms (applied to <p> paragraph text)
    # ------------------------------------------------------------------

    def _apply_bml_line_transforms(self, paragraph_md: str) -> str:
        """
        Apply BML-specific line transforms to the text of a <p> element:
          - Syntax: ...       -> fenced code block
          - Return Type: ...  -> blockquote badge
          - Example: code     -> fenced code block
          - Example:          -> heading
        """
        text = paragraph_md.strip()
        if not text:
            return "\n\n"

        result = format_syntax_line(text)
        if result:
            return result

        result = format_return_type(text)
        if result:
            return result

        result = format_example_line(text)
        if result:
            return result

        return f"\n\n{text}\n\n"

    # ------------------------------------------------------------------
    # URL utilities (used by inline.py and image.py)
    # ------------------------------------------------------------------

    def normalize_url(self, url: str) -> str:
        parsed = urllib.parse.urlparse(url)
        return urllib.parse.urlunparse(parsed._replace(fragment="", query=""))

    def resolve_url(self, url: str, context_url: str = "") -> str:
        context = context_url or self.current_url
        parsed = urllib.parse.urlparse(url)

        if parsed.fragment:
            fragment = parsed.fragment
            if "?" in fragment:
                fragment = fragment.split("?")[0]
            fragment = fragment.lstrip("/")
            return urllib.parse.urljoin(self.base_url, fragment)

        if not parsed.scheme and context:
            return self.normalize_url(urllib.parse.urljoin(context, url))

        return self.normalize_url(url)

    def get_workspace_path(self, url: str) -> str | None:
        if not url.startswith(self.base_url):
            return None
        relative = url[len(self.base_url):]
        filename = os.path.basename(relative)
        base_name, _ = os.path.splitext(filename)
        out = os.path.join(self.output_dir, "BML", base_name + ".md")
        return os.path.abspath(out)

    # ------------------------------------------------------------------
    # Post-processing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def cleanup(markdown: str) -> str:
        """
        Clean up the raw output markdown:
          - Collapse 3+ consecutive blank lines -> 2
          - Strip trailing whitespace on each line
          - Ensure file ends with single newline
        """
        lines = [l.rstrip() for l in markdown.splitlines()]
        # Collapse excessive blank lines
        cleaned: list[str] = []
        blank_count = 0
        for line in lines:
            if line == "":
                blank_count += 1
                if blank_count <= 2:
                    cleaned.append(line)
            else:
                blank_count = 0
                cleaned.append(line)
        return "\n".join(cleaned).strip() + "\n"