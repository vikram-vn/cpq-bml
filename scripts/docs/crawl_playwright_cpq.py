#!/usr/bin/env python3
"""
crawl_playwright_cpq.py

Crawls the entire Oracle CPQ documentation web application using Playwright
in a real headless browser. Extracts the visible rendered innerText from
each article's `#mc-main-content` container across all 566 documentation pages,
eliminating all HTML markup, base64 data, hex artifacts, and internal anchors.

Produces pristine cpq-words.txt for the CPQ-BML extension spell-check system.
"""

import asyncio
import os
import re
import sys
import time
import urllib.request
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_FILE = os.path.join(ROOT, "app", "lang", "spell-check", "cpq-words.txt")

BASE_URL = "https://help-cxsales.oraclecloud.com/cpq"
TOC_BASE = f"{BASE_URL}/Data/Tocs/"


import ssl

def get_all_page_urls():
    """Extracts all content URLs from the MadCap TOC chunks."""
    urls = set()
    ctx = ssl._create_unverified_context()
    for chunk_name in ["Master_Chunk0.js", "Master_Chunk1.js"]:
        req = urllib.request.Request(
            f"{TOC_BASE}{chunk_name}",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        try:
            with urllib.request.urlopen(req, context=ctx) as resp:
                data = resp.read().decode("utf-8")
                matches = re.findall(r'/Content/[a-zA-Z0-9_/.-]+\.htm', data)
                for m in matches:
                    urls.add(m)
        except Exception as e:
            print(f"Error fetching {chunk_name}: {e}")
    return sorted(list(urls))


async def crawl_all_pages(urls, concurrency=14):
    """Crawls all pages using Playwright with controlled concurrency."""
    print(f"Starting Playwright browser to crawl {len(urls)} pages (concurrency: {concurrency})...")
    
    unique_words = set()
    total = len(urls)
    completed = 0
    t0 = time.time()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        sem = asyncio.Semaphore(concurrency)
        
        async def fetch_page(rel_url):
            nonlocal completed
            full_url = f"{BASE_URL}{rel_url}"
            async with sem:
                page = await context.new_page()
                try:
                    # Block heavy media assets to maximize crawling speed
                    await page.route(
                        "**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,css}",
                        lambda r: r.abort()
                    )
                    await page.goto(full_url, wait_until="domcontentloaded", timeout=25000)
                    
                    # Extract rendered text from the main article container
                    if await page.locator("#mc-main-content").count() > 0:
                        text = await page.inner_text("#mc-main-content")
                    else:
                        text = await page.inner_text("body")
                    
                    return text
                except Exception:
                    return ""
                finally:
                    await page.close()
                    completed += 1
                    elapsed = time.time() - t0
                    rate = completed / elapsed if elapsed > 0 else 0
                    sys.stdout.write(
                        f"\r   Crawled: {completed}/{total} pages | {len(unique_words)} words | {elapsed:.1f}s ({rate:.1f} p/s)"
                    )
                    sys.stdout.flush()

        # Batch in groups of 50 to avoid overloading memory
        batch_size = 50
        for i in range(0, len(urls), batch_size):
            batch = urls[i : i + batch_size]
            batch_texts = await asyncio.gather(*[fetch_page(u) for u in batch])
            
            for text in batch_texts:
                if not text:
                    continue
                # Extract clean words
                for raw_word in re.findall(r"[a-zA-Z]{2,}", text):
                    # CamelCase splitting
                    parts = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)", raw_word)
                    for p_word in parts:
                        clean_w = p_word.strip().lower()
                        if len(clean_w) >= 2 and not re.match(r"^(.)\1+$", clean_w):
                            unique_words.add(clean_w)
                    
                    clean_raw = raw_word.strip().lower()
                    if len(clean_raw) >= 2 and not re.match(r"^(.)\1+$", clean_raw):
                        unique_words.add(clean_raw)
                        
        await browser.close()
        
    total_time = time.time() - t0
    print(f"\nCrawling complete in {total_time:.1f}s! Total unique words: {len(unique_words)}")
    return unique_words


def main():
    urls = get_all_page_urls()
    print(f"Discovered {len(urls)} documentation pages across Oracle CPQ Help.")
    
    words = asyncio.run(crawl_all_pages(urls, concurrency=14))
    
    # Filter out single-letter repeats (e.g. 'aaa', 'bbb')
    valid_words = set()
    for w in words:
        if len(w) < 2 or len(w) > 45:
            continue
        if re.match(r"^(.)\1+$", w):
            continue
        valid_words.add(w)
        
    sorted_words = sorted(list(valid_words))
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(sorted_words) + "\n")
        
    print(f"Saved {len(sorted_words)} clean CPQ words to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
