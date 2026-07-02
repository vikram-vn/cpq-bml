"""
html2docmd - HTML to Docusaurus Markdown converter library for BML Oracle Help pages.

Public API:
    from bml_crawler.html2docmd import HtmlToDocusaurus
    converter = HtmlToDocusaurus(base_url, output_dir, current_url, current_output_path, download_image_callback)
    markdown = converter.convert(soup_element)
    frontmatter = converter.generate_frontmatter(soup, url, body_text)
"""
from .converter import HtmlToDocusaurus

__all__ = ["HtmlToDocusaurus"]