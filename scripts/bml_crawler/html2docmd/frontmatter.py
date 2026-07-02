"""
frontmatter.py - Generates Docusaurus YAML frontmatter from a BeautifulSoup page.
"""
import os
import re


def generate_frontmatter(soup, url: str, body_text: str, base_url: str) -> str:
    """
    Generate YAML frontmatter block for a Docusaurus page.

    Args:
        soup: BeautifulSoup object of the full page.
        url: Canonical URL of the page.
        body_text: Plain text extracted from the main content area.
        base_url: Base URL prefix used to derive relative path.

    Returns:
        A string starting with '---\n' and ending with '---\n\n'.
    """
    # --- Title ---
    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text().strip()
        # Remove " - Oracle CPQ" suffix
        title = re.split(r"\s+-\s+Oracle", title)[0].strip()

    h1 = soup.find("h1")
    if not title:
        if h1:
            title = h1.get_text().strip()
    elif h1:
        # Oracle's <title> tag is occasionally a stale copy-paste from an
        # unrelated page (e.g. ArraysOverview.htm's <title> says
        # "Commerce UI Settings"). If it shares no words with the page's
        # own <h1>, trust the on-page heading instead.
        h1_text = h1.get_text().strip()
        title_words = set(re.findall(r"\w+", title.lower()))
        h1_words = set(re.findall(r"\w+", h1_text.lower()))
        if h1_text and title_words and h1_words and not (title_words & h1_words):
            title = h1_text

    # --- Doc ID from URL filename ---
    relative_path = url[len(base_url):] if url.startswith(base_url) else url
    filename = os.path.basename(relative_path.split("?")[0])
    doc_id, _ = os.path.splitext(filename)
    if not doc_id:
        doc_id = "doc"

    if not title:
        title = doc_id

    # --- Description (first 200 non-whitespace chars) ---
    clean_body = re.sub(r"\s+", " ", body_text).strip()
    description = clean_body[:200].rstrip()
    if len(clean_body) > 200:
        description += "..."

    # --- Tags ---
    tags = ["BML", "CPQ"]
    path_lower = relative_path.lower()
    if "functionsscripts" in path_lower or "functions" in path_lower:
        tags.append("Functions")
    elif "functioneditor" in path_lower or "editor" in path_lower:
        tags.append("Editor")
    elif "overview" in path_lower:
        tags.append("Overview")

    # --- Escape YAML strings ---
    def _esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace('"', '\\"')

    fm = "---\n"
    fm += f'id: {doc_id}\n'
    fm += f'title: "{_esc(title)}"\n'
    fm += f'sidebar_label: "{_esc(title)}"\n'
    if description:
        fm += f'description: "{_esc(description)}"\n'
    fm += f'tags: {tags}\n'
    fm += "---\n\n"
    return fm