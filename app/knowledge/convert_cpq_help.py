import os
import sys
import re
import urllib.parse
import urllib3
import requests
from bs4 import BeautifulSoup, NavigableString

# Suppress insecure request warnings from urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class BmlDocCrawler:
    def __init__(self, base_url="https://help-cxsales.oraclecloud.com/cpq/Content/", max_depth=3, output_dir="app/knowledge"):
        self.base_url = base_url
        self.max_depth = max_depth
        self.output_dir = output_dir
        self.visited = set()

    def normalize_url(self, url):
        # Remove fragments and query parameters
        parsed = urllib.parse.urlparse(url)
        normalized = parsed._replace(fragment='', query='')
        return urllib.parse.urlunparse(normalized)

    def resolve_url(self, url, context_url=None):
        # Resolves hash-style urls to direct Content/ urls
        parsed = urllib.parse.urlparse(url)
        if parsed.fragment:
            fragment = parsed.fragment
            if '?' in fragment:
                fragment = fragment.split('?')[0]
            fragment = fragment.lstrip('/')
            return urllib.parse.urljoin(self.base_url, fragment)
        
        # If relative URL, resolve against context_url
        if not parsed.scheme and context_url:
            resolved = urllib.parse.urljoin(context_url, url)
            return self.normalize_url(resolved)
            
        return self.normalize_url(url)

    def get_workspace_path(self, url):
        # Convert absolute Content URL to a workspace path mirroring the hierarchy
        # e.g., https://help-cxsales.oraclecloud.com/cpq/Content/BML/BMLOverview.htm
        # -> app/knowledge/BML/BMLOverview.md
        if not url.startswith(self.base_url):
            return None
            
        relative_path = url[len(self.base_url):]
        # Remove extension
        base_path, _ = os.path.splitext(relative_path)
        # Create output file path
        out_path = os.path.join(self.output_dir, base_path + ".md")
        return os.path.abspath(out_path)

    def convert_to_markdown(self, element):
        if isinstance(element, NavigableString):
            return element.string if element.string else ""

        tag_name = element.name
        if not tag_name:
            return ""

        if tag_name in ['script', 'style']:
            return ""

        children_md = "".join(self.convert_to_markdown(child) for child in element.children)

        if tag_name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            level = int(tag_name[1])
            return f"\n\n{'#' * level} {children_md.strip()}\n\n"

        elif tag_name == 'p':
            return f"\n\n{children_md.strip()}\n\n"

        elif tag_name in ['strong', 'b']:
            text = children_md.strip()
            return f"**{text}**" if text else ""

        elif tag_name in ['em', 'i']:
            text = children_md.strip()
            return f"*{text}*" if text else ""

        elif tag_name == 'code':
            text = children_md.strip()
            if element.parent and element.parent.name == 'pre':
                return children_md
            return f"`{text}`" if text else ""

        elif tag_name == 'pre':
            code_text = children_md.strip()
            # Detect language
            lang = "bml"
            if "<" in code_text and ">" in code_text and ("</" in code_text or "/>" in code_text):
                lang = "xml"
            elif "select " in code_text.lower() and "from " in code_text.lower():
                lang = "sql"
            elif "{" in code_text and "}" in code_text and (":" in code_text or '"' in code_text):
                if code_text.strip().startswith("{") or code_text.strip().startswith("["):
                    lang = "json"
            return f"\n```{lang}\n{code_text}\n```\n"

        elif tag_name == 'a':
            text = children_md.strip()
            href = element.get('href', '')
            if text and href:
                if href.startswith('javascript:'):
                    return text
                # We update the href to point to the local .md file structure
                resolved_url = self.resolve_url(href, self.current_url)
                local_path = self.get_workspace_path(resolved_url)
                if local_path:
                    # Make link relative in markdown
                    rel_link = os.path.relpath(local_path, os.path.dirname(self.current_output_path)).replace('\\', '/')
                    return f"[{text}]({rel_link})"
                return f"[{text}]({href})"
            return text

        elif tag_name == 'ul':
            return f"\n{children_md}\n"

        elif tag_name == 'ol':
            return f"\n{children_md}\n"

        elif tag_name == 'li':
            parent = element.parent
            prefix = "* "
            if parent and parent.name == 'ol':
                lis = [sibling for sibling in parent.children if sibling.name == 'li']
                try:
                    idx = lis.index(element) + 1
                    prefix = f"{idx}. "
                except ValueError:
                    prefix = "1. "
            
            indent = ""
            current = parent
            while current and current.parent:
                if current.parent.name in ['ul', 'ol']:
                    indent += "  "
                current = current.parent
                
            return f"{indent}{prefix}{children_md.strip()}\n"

        elif tag_name == 'table':
            rows = []
            headers = []
            
            for tr in element.find_all('tr', recursive=True):
                if tr.find_parent('table') != element:
                    continue
                cells = []
                is_header = False
                for cell in tr.find_all(['th', 'td'], recursive=False):
                    cell_text = self.clean_text(self.convert_to_markdown(cell))
                    cells.append(cell_text)
                    if cell.name == 'th':
                        is_header = True
                if cells:
                    if is_header:
                        headers = cells
                    else:
                        rows.append(cells)
            
            if not headers and rows:
                headers = [f"Col {i+1}" for i in range(len(rows[0]))]
            
            if not headers:
                return ""
                
            col_widths = [len(h) for h in headers]
            for row in rows:
                for idx, cell in enumerate(row):
                    if idx < len(col_widths):
                        col_widths[idx] = max(col_widths[idx], len(cell))
                    else:
                        col_widths.append(len(cell))
            
            header_row = "| " + " | ".join(h.ljust(col_widths[idx]) for idx, h in enumerate(headers)) + " |"
            sep_row = "| " + " | ".join("-" * col_widths[idx] for idx in range(len(headers))) + " |"
            
            markdown_rows = [header_row, sep_row]
            for row in rows:
                while len(row) < len(headers):
                    row.append("")
                r_str = "| " + " | ".join(cell.ljust(col_widths[idx]) for idx, cell in enumerate(row[:len(headers)])) + " |"
                markdown_rows.append(r_str)
                
            return "\n\n" + "\n".join(markdown_rows) + "\n\n"

        elif tag_name in ['td', 'th']:
            return children_md.strip()

        elif tag_name == 'br':
            return "\n"

        elif tag_name == 'div':
            class_list = element.get('class', [])
            admonitions = {
                'Note': 'note',
                'Tip': 'tip',
                'Warning': 'warning',
                'Caution': 'danger',
                'Important': 'info'
            }
            for cls, adm_type in admonitions.items():
                if cls in class_list:
                    return f"\n\n:::{adm_type}\n{children_md.strip()}\n:::\n\n"
            return f"\n{children_md}\n"

        return children_md

    def clean_text(self, text):
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def crawl_page(self, url, depth):
        url = self.normalize_url(url)
        if url in self.visited:
            return []
            
        self.visited.add(url)
        workspace_path = self.get_workspace_path(url)
        if not workspace_path:
            return []
            
        print(f"[Depth {depth}] Crawling: {url}")
        
        try:
            response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, verify=False, timeout=10)
            if response.status_code != 200:
                print(f"Error: Failed to fetch {url}, status code {response.status_code}")
                return []
            response.encoding = 'utf-8'
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        main_content = soup.find('div', role='main') or soup.find(id='mc-main-content')
        if not main_content:
            main_content = soup.body if soup.body else soup
            
        # Set dynamic context for link conversion
        self.current_url = url
        self.current_output_path = workspace_path
        
        markdown = self.convert_to_markdown(main_content)
        markdown = re.sub(r'\n{3,}', '\n\n', markdown)
        
        # Ensure output directory exists and save file
        os.makedirs(os.path.dirname(workspace_path), exist_ok=True)
        with open(workspace_path, 'w', encoding='utf-8') as f:
            f.write(markdown.strip())
        print(f"  -> Saved to: {workspace_path}")
        
        # Extract links for recursive crawling
        links_to_crawl = []
        if depth < self.max_depth:
            for anchor in main_content.find_all('a', href=True):
                href = anchor['href']
                if href.startswith('javascript:') or href.startswith('#'):
                    continue
                resolved_url = self.resolve_url(href, url)
                # Keep crawling restricted to CPQ Content BML-related docs
                if resolved_url.startswith(self.base_url):
                    # Restrict to paths like BML/ or other subpaths linked from BML pages
                    is_bml = any(x in resolved_url for x in ['/BML/', '/FunctionsScripts/', '/FunctionEditor/', 'UtilBml'])
                    if is_bml and resolved_url not in self.visited:
                        links_to_crawl.append(resolved_url)
                        
        return links_to_crawl

    def fetch_bml_toc_urls(self):
        toc_urls = []
        try:
            print("Fetching help system Master TOC configuration...")
            master_url = "https://help-cxsales.oraclecloud.com/cpq/Data/Tocs/Master.js"
            r = requests.get(master_url, headers={'User-Agent': 'Mozilla/5.0'}, verify=False, timeout=10)
            if r.status_code != 200:
                print(f"Error: Failed to fetch Master.js (status code {r.status_code})")
                return []
                
            # Find the number of chunks
            match = re.search(r'numchunks\s*:\s*(\d+)', r.text)
            num_chunks = int(match.group(1)) if match else 1
            
            print(f"Discovered {num_chunks} TOC chunk files. Fetching pages...")
            for c in range(num_chunks):
                chunk_url = f"https://help-cxsales.oraclecloud.com/cpq/Data/Tocs/Master_Chunk{c}.js"
                chunk_r = requests.get(chunk_url, headers={'User-Agent': 'Mozilla/5.0'}, verify=False, timeout=10)
                if chunk_r.status_code == 200:
                    # Find all Content/BML/ paths
                    matches = re.findall(r"['\"]/Content/BML/([^'\"]+)['\"]", chunk_r.text)
                    for m in matches:
                        toc_urls.append(f"https://help-cxsales.oraclecloud.com/cpq/Content/BML/{m}")
                        
            print(f"Successfully resolved {len(toc_urls)} BML module URLs dynamically.")
        except Exception as e:
            print(f"Error resolving TOC URLs dynamically: {e}")
            
        return toc_urls

    def start(self, seed_url):
        normalized_seed = self.normalize_url(self.resolve_url(seed_url))
        default_seed = self.normalize_url(self.resolve_url("https://help-cxsales.oraclecloud.com/cpq/#BML/BMLOverview.htm?TocPath=BML%257C_____0"))
        
        if normalized_seed == default_seed:
            print("No specific URL provided or BMLOverview requested.")
            toc_urls = self.fetch_bml_toc_urls()
            if toc_urls:
                print(f"Pre-seeding queue with all {len(toc_urls)} BML module pages from TOC...")
                queue = [(self.normalize_url(url), 1) for url in toc_urls]
            else:
                print("Fallback: Seed with the overview page only.")
                start_url = self.resolve_url(seed_url)
                queue = [(start_url, 1)]
        else:
            start_url = self.resolve_url(seed_url)
            queue = [(start_url, 1)]
        
        while queue:
            current_url, depth = queue.pop(0)
            next_links = self.crawl_page(current_url, depth)
            for link in next_links:
                if link not in self.visited and not any(link == q[0] for q in queue):
                    queue.append((link, depth + 1))
                    
        print(f"\nCrawling complete! Visited {len(self.visited)} pages under BML module.")

def main():
    default_url = "https://help-cxsales.oraclecloud.com/cpq/#BML/BMLOverview.htm?TocPath=BML%257C_____0"
    seed = sys.argv[1] if len(sys.argv) > 1 else default_url
    
    # Get custom depth if provided
    depth = 3
    if len(sys.argv) > 2:
        try:
            depth = int(sys.argv[2])
        except ValueError:
            pass
            
    crawler = BmlDocCrawler(max_depth=depth)
    crawler.start(seed)

if __name__ == '__main__':
    main()
