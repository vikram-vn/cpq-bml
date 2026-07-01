import os
import sys
import re
import urllib.parse
import urllib3
import requests
from bs4 import BeautifulSoup

# Ensure the parent of this package is on sys.path when run as a script
_script_dir = os.path.dirname(os.path.abspath(__file__))
_package_parent = os.path.abspath(os.path.join(_script_dir, ".."))
if _package_parent not in sys.path:
    sys.path.insert(0, _package_parent)

from bml_crawler.parser import HtmlToMarkdown

# Suppress insecure request warnings from urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class BmlDocCrawler:
    def __init__(self, base_url="https://help-cxsales.oraclecloud.com/cpq/Content/", max_depth=3, output_dir=None):
        self.base_url = base_url
        self.max_depth = max_depth
        self.visited = set()
        
        if output_dir:
            self.output_dir = output_dir
        else:
            # Resolve to app/knowledge/ relative to this file's folder (app/scripts/bml_crawler/)
            script_dir = os.path.dirname(os.path.abspath(__file__))
            self.output_dir = os.path.abspath(os.path.join(script_dir, "..", "..", "knowledge"))
            
        self.images_dir = os.path.join(self.output_dir, "BML", "images")

    def normalize_url(self, url):
        parsed = urllib.parse.urlparse(url)
        normalized = parsed._replace(fragment='', query='')
        return urllib.parse.urlunparse(normalized)

    def resolve_url(self, url, context_url=None):
        parsed = urllib.parse.urlparse(url)
        if parsed.fragment:
            fragment = parsed.fragment
            if '?' in fragment:
                fragment = fragment.split('?')[0]
            fragment = fragment.lstrip('/')
            return urllib.parse.urljoin(self.base_url, fragment)
        
        if not parsed.scheme and context_url:
            resolved = urllib.parse.urljoin(context_url, url)
            return self.normalize_url(resolved)
            
        return self.normalize_url(url)

    def get_workspace_path(self, url):
        if not url.startswith(self.base_url):
            return None
            
        relative_path = url[len(self.base_url):]
        filename = os.path.basename(relative_path)
        base_name, _ = os.path.splitext(filename)
        out_path = os.path.join(self.output_dir, "BML", base_name + ".md")
        return os.path.abspath(out_path)

    def download_image(self, img_url):
        # Determine image file name and path
        parsed = urllib.parse.urlparse(img_url)
        img_filename = os.path.basename(parsed.path)
        if not img_filename:
            return None
            
        local_path = os.path.join(self.images_dir, img_filename)
        if os.path.exists(local_path):
            return local_path
            
        os.makedirs(self.images_dir, exist_ok=True)
        try:
            print(f"  [Image] Downloading: {img_url}")
            r = requests.get(img_url, headers={'User-Agent': 'Mozilla/5.0'}, verify=False, timeout=10)
            if r.status_code == 200:
                with open(local_path, 'wb') as f:
                    f.write(r.content)
                return local_path
        except Exception as e:
            print(f"  [Image] Error downloading {img_url}: {e}")
        return None

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
            
        # Instantiate HTML to Markdown parser
        parser = HtmlToMarkdown(
            base_url=self.base_url,
            output_dir=self.output_dir,
            current_url=url,
            current_output_path=workspace_path,
            download_image_callback=self.download_image
        )
        
        # Convert content to Markdown
        markdown = parser.convert(main_content)
        markdown = re.sub(r'\n{3,}', '\n\n', markdown)
        
        # Get raw body text for description generation
        body_text = main_content.get_text()
        
        # Generate Docusaurus frontmatter
        frontmatter = parser.generate_frontmatter(soup, url, body_text)
        full_markdown = frontmatter + markdown.strip()
        
        # Ensure output directory exists and save file
        os.makedirs(os.path.dirname(workspace_path), exist_ok=True)
        with open(workspace_path, 'w', encoding='utf-8') as f:
            f.write(full_markdown)
        print(f"  -> Saved to: {workspace_path}")
        
        # Extract links for recursive crawling
        links_to_crawl = []
        if depth < self.max_depth:
            for anchor in main_content.find_all('a', href=True):
                href = anchor['href']
                if href.startswith('javascript:') or href.startswith('#'):
                    continue
                resolved_url = self.resolve_url(href, url)
                if resolved_url.startswith(self.base_url):
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
                
            match = re.search(r'numchunks\s*:\s*(\d+)', r.text)
            num_chunks = int(match.group(1)) if match else 1
            
            print(f"Discovered {num_chunks} TOC chunk files. Fetching pages...")
            for c in range(num_chunks):
                chunk_url = f"https://help-cxsales.oraclecloud.com/cpq/Data/Tocs/Master_Chunk{c}.js"
                chunk_r = requests.get(chunk_url, headers={'User-Agent': 'Mozilla/5.0'}, verify=False, timeout=10)
                if chunk_r.status_code == 200:
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

if __name__ == '__main__':
    import sys
    # Add parent directory of this package to sys.path so bml_crawler imports resolve correctly
    script_dir = os.path.dirname(os.path.abspath(__file__))
    package_parent = os.path.abspath(os.path.join(script_dir, ".."))
    if package_parent not in sys.path:
        sys.path.insert(0, package_parent)
        
    default_url = "https://help-cxsales.oraclecloud.com/cpq/#BML/BMLOverview.htm?TocPath=BML%257C_____0"
    seed = sys.argv[1] if len(sys.argv) > 1 else default_url
    
    depth = 3
    if len(sys.argv) > 2:
        try:
            depth = int(sys.argv[2])
        except ValueError:
            pass
            
    crawler = BmlDocCrawler(max_depth=depth)
    crawler.start(seed)

    # Post-process: fix image refs, promote function headers, convert param tables
    print("\n[postprocess] Applying post-processing fixes to generated markdown...")
    from bml_crawler.postprocess import postprocess_bml_docs
    bml_dir = os.path.join(crawler.output_dir, "BML")
    postprocess_bml_docs(bml_dir)
