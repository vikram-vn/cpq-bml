#!/usr/bin/env python3
"""
generate_cpq_rest_knowledge.py

Fetches and converts Oracle CPQ REST API documentation pages into pristine
markdown files in the knowledge/BML/ directory.

Default pages targeted:
- Query.html -> REST_Query_Collections.md
- Sort.html -> REST_Sort_Collections.md
- Paginate.html -> REST_Pagination.md
- Expand.html -> REST_Expand_Objects.md
- Status_Codes.html -> REST_Status_Codes.md
- Resource_Methods.html -> REST_Resource_Methods.md
- Reference.html -> REST_Reference_Catalog.md
- CORS.html -> REST_CORS.md

Supports CLI flags:
  --all               Fetches all configured default CPQ REST pages.
  --url <URL>         Fetches an arbitrary Oracle CPQ doc URL.
  --filename <NAME>   Custom filename when --url is specified.
  --output-dir <DIR>  Output directory (default: knowledge/BML).
"""

import asyncio
import argparse
import os
import re
import sys
from bs4 import BeautifulSoup, NavigableString, Tag
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_KNOWLEDGE_DIR = os.path.join(ROOT, "knowledge", "BML")

DEFAULT_PAGES = [
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Query.html",
        "filename": "REST_Query_Collections.md",
        "title": "REST API Services for Oracle CPQ: Query Collections",
        "id": "REST_Query_Collections",
        "description": "Comprehensive reference for filtering collections in Oracle CPQ REST APIs using the q query parameter and MongoDB-style query operators."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Sort.html",
        "filename": "REST_Sort_Collections.md",
        "title": "REST API Services for Oracle CPQ: Sort Collections",
        "id": "REST_Sort_Collections",
        "description": "Reference for sorting collection items in Oracle CPQ REST APIs using the orderBy query parameter."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Paginate.html",
        "filename": "REST_Pagination.md",
        "title": "REST API Services for Oracle CPQ: Collection Pagination",
        "id": "REST_Pagination",
        "description": "Reference for pagination in Oracle CPQ REST APIs using limit, offset, and totalResults parameters."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Expand.html",
        "filename": "REST_Expand_Objects.md",
        "title": "REST API Services for Oracle CPQ: Expand Hierarchical Objects",
        "id": "REST_Expand_Objects",
        "description": "Reference for expanding hierarchical and child resources in Oracle CPQ REST APIs using the expand parameter."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Status_Codes.html",
        "filename": "REST_Status_Codes.md",
        "title": "REST API Services for Oracle CPQ: HTTP Status Codes & Error Handling",
        "id": "REST_Status_Codes",
        "description": "Reference for HTTP status codes and error payload schemas returned by Oracle CPQ REST API services."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Resource_Methods.html",
        "filename": "REST_Resource_Methods.md",
        "title": "REST API Services for Oracle CPQ: Resource Methods",
        "id": "REST_Resource_Methods",
        "description": "Reference for supported HTTP methods (GET, POST, PUT, PATCH, DELETE) and delta update semantics in Oracle CPQ REST APIs."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/Reference.html",
        "filename": "REST_Reference_Catalog.md",
        "title": "REST API Services for Oracle CPQ: Reference Overview & Common Conventions",
        "id": "REST_Reference_Catalog",
        "description": "Overview of Oracle CPQ REST API endpoints, URI structure, versioning (/rest/v17/, /rest/v19/), and request header standards."
    },
    {
        "url": "https://docs.oracle.com/en/cloud/saas/configure-price-quote/cxcpq/CORS.html",
        "filename": "REST_CORS.md",
        "title": "REST API Services for Oracle CPQ: Cross-Origin Resource Sharing (CORS)",
        "id": "REST_CORS",
        "description": "Reference for CORS headers, preflight requests, and allowed origins in Oracle CPQ REST APIs."
    }
]

def clean_element(tag: Tag):
    """Remove scripts, styles, navigation bars, breadcrumbs, and social links."""
    for unwanted in tag.find_all(["script", "style", "noscript", "nav", "footer"]):
        unwanted.decompose()
    
    for sel in [".breadcrumb", ".page-navigation", ".toc-navigation", ".print-button", ".share-button"]:
        for el in tag.select(sel):
            el.decompose()

def tag_to_markdown(tag) -> str:
    """Convert a BeautifulSoup tag to clean Markdown."""
    if isinstance(tag, NavigableString):
        text = str(tag)
        return re.sub(r'[ \t\r\f\v]+', ' ', text)
    
    if not isinstance(tag, Tag):
        return ""

    tag_name = tag.name.lower()

    if tag_name in ["a", "button", "span", "div"]:
        txt = tag.get_text().strip()
        if txt in ["Previous", "Next", "Table of contents", "Skip to Content", "Skip to Search"]:
            return ""

    if tag_name in ["h1"]:
        content = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f"\n\n# {content}\n\n"
    elif tag_name in ["h2"]:
        content = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f"\n\n## {content}\n\n"
    elif tag_name in ["h3"]:
        content = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f"\n\n### {content}\n\n"
    elif tag_name in ["h4"]:
        content = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f"\n\n#### {content}\n\n"
    elif tag_name in ["h5", "h6"]:
        content = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f"\n\n##### {content}\n\n"
    elif tag_name == "p":
        content = "".join(tag_to_markdown(c) for c in tag.children).strip()
        if not content:
            return ""
        return f"\n\n{content}\n\n"
    elif tag_name in ["pre", "code"]:
        code_text = tag.get_text()
        if tag_name == "pre":
            lang = "json" if "{" in code_text or "[" in code_text else "http"
            return f"\n\n```{lang}\n{code_text.strip()}\n```\n\n"
        else:
            if "\n" in code_text:
                return f"\n\n```\n{code_text.strip()}\n```\n\n"
            return f"`{code_text.strip()}`"
    elif tag_name in ["ul", "ol"]:
        items = []
        is_ol = tag_name == "ol"
        idx = 1
        for child in tag.children:
            if isinstance(child, Tag) and child.name.lower() == "li":
                item_text = "".join(tag_to_markdown(c) for c in child.children).strip()
                if item_text:
                    prefix = f"{idx}." if is_ol else "-"
                    items.append(f"{prefix} {item_text}")
                    idx += 1
        return "\n\n" + "\n".join(items) + "\n\n" if items else ""
    elif tag_name == "table":
        return convert_table_to_markdown(tag)
    elif tag_name in ["b", "strong"]:
        inner = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f" **{inner}** " if inner else ""
    elif tag_name in ["i", "em"]:
        inner = "".join(tag_to_markdown(c) for c in tag.children).strip()
        return f" *{inner}* " if inner else ""
    elif tag_name == "a":
        inner = "".join(tag_to_markdown(c) for c in tag.children).strip()
        href = tag.get("href", "")
        if not inner:
            return ""
        if not href or href.startswith("javascript:"):
            return inner
        return f"[{inner}]({href})"
    elif tag_name == "blockquote":
        inner = "".join(tag_to_markdown(c) for c in tag.children).strip()
        lines = [f"> {line}" for line in inner.split("\n")]
        return "\n\n" + "\n".join(lines) + "\n\n"
    elif tag_name in ["div", "section", "article", "span"]:
        return "".join(tag_to_markdown(c) for c in tag.children)
    else:
        return "".join(tag_to_markdown(c) for c in tag.children)

def convert_table_to_markdown(table_tag: Tag) -> str:
    """Convert HTML table to Markdown table."""
    rows = []
    for tr in table_tag.find_all("tr"):
        cells = []
        is_header = False
        for cell in tr.find_all(["th", "td"]):
            if cell.name.lower() == "th":
                is_header = True
            cell_text = "".join(tag_to_markdown(c) for c in cell.children).strip()
            cell_text = re.sub(r'\s*\n\s*', ' ', cell_text)
            cell_text = cell_text.replace("|", "\\|")
            cells.append(cell_text)
        if cells:
            rows.append((cells, is_header))
    
    if not rows:
        return ""

    num_cols = max(len(r[0]) for r in rows)
    normalized_rows = []
    for r, is_h in rows:
        padded = r + [""] * (num_cols - len(r))
        normalized_rows.append((padded, is_h))

    md_lines = []
    first_row, _ = normalized_rows[0]
    
    md_lines.append("| " + " | ".join(first_row) + " |")
    md_lines.append("| " + " | ".join(["---"] * num_cols) + " |")

    for row, _ in normalized_rows[1:]:
        md_lines.append("| " + " | ".join(row) + " |")

    return "\n\n" + "\n".join(md_lines) + "\n\n"

def post_process_markdown(md: str, page_info: dict) -> str:
    """Add frontmatter and clean duplicate whitespace."""
    md = re.sub(r'\n{3,}', '\n\n', md).strip()
    md = re.sub(r'^(Previous\s*|Table of contents\s*|Next\s*)+', '', md, flags=re.IGNORECASE).strip()
    
    page_id = page_info.get("id") or os.path.splitext(page_info["filename"])[0]
    title = page_info.get("title") or page_id
    desc = page_info.get("description") or title

    frontmatter = f"""---
id: {page_id}
title: "{title}"
sidebar_label: "{page_id}"
description: "{desc}"
tags: ['CPQ', 'REST API', 'Collections', 'Query', 'Integration']
source: {page_info['url']}
---

"""
    return frontmatter + md + "\n"

async def fetch_pages(pages, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        for page_info in pages:
            url = page_info["url"]
            filename = page_info["filename"]
            target_path = os.path.join(output_dir, filename)

            print(f"Fetching {url} -> {filename}...", flush=True)
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(3500)

                html = await page.content()
                soup = BeautifulSoup(html, "html.parser")

                article = soup.find("article") or soup.find("main") or soup.find(role="main")
                if not article:
                    print(f"Warning: No article container found for {url}, using body", flush=True)
                    article = soup.find("body")

                clean_element(article)
                raw_md = tag_to_markdown(article)
                final_md = post_process_markdown(raw_md, page_info)

                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(final_md)

                print(f"  Successfully wrote {target_path} ({len(final_md)} chars)", flush=True)
            except Exception as e:
                print(f"  Error processing {url}: {e}", file=sys.stderr, flush=True)
            finally:
                await page.close()

        await browser.close()

def main():
    parser = argparse.ArgumentParser(description="Fetch and generate Oracle CPQ REST documentation.")
    parser.add_argument("--url", help="Fetch a single arbitrary doc URL")
    parser.add_argument("--filename", help="Filename to save when using --url")
    parser.add_argument("--title", help="Title for frontmatter when using --url")
    parser.add_argument("--output-dir", default=DEFAULT_KNOWLEDGE_DIR, help="Destination directory")
    parser.add_argument("--all", action="store_true", help="Fetch all default CPQ REST documentation pages")

    args = parser.parse_args()

    if args.url:
        fname = args.filename or os.path.basename(args.url).replace(".html", ".md").replace(".htm", ".md")
        if not fname.startswith("REST_"):
            fname = f"REST_{fname}"
        page_info = [{
            "url": args.url,
            "filename": fname,
            "title": args.title or fname.replace(".md", ""),
            "id": fname.replace(".md", ""),
            "description": f"Documentation fetched from {args.url}"
        }]
    else:
        page_info = DEFAULT_PAGES

    asyncio.run(fetch_pages(page_info, os.path.abspath(args.output_dir)))

if __name__ == "__main__":
    main()
