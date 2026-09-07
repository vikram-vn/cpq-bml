import os
import sys
import re
import asyncio
import urllib.parse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

# Ensure the parent of this package is on sys.path when run as a script
_script_dir = os.path.dirname(os.path.abspath(__file__))
_package_parent = os.path.abspath(os.path.join(_script_dir, ".."))
if _package_parent not in sys.path:
    sys.path.insert(0, _package_parent)

from bml_crawler.html2docmd import HtmlToDocusaurus

EXTRA_BML_PAGES = [
    "Commerce_Process/Attributes/TransactionArrays/TransactionArraysBML.htm",
    "DeveloperToolkit/BMLT.htm",
    "BML/UseSOAPwithBML.htm",
    "RestAPIs/cpqAPIs/bml.htm",
    "Manage_Pricing/pricingBML.htm",
    "Integrating_With_BigMachines/UseCases/Use_BML_to_Connect_to_an_External_Service.htm"
]


class BmlDocCrawler:
    def __init__(self, base_url="https://help-cxsales.oraclecloud.com/cpq/Content/", max_depth=3, output_dir=None, concurrency=8):
        self.base_url = base_url
        self.max_depth = max_depth
        self.concurrency = concurrency
        self.visited = set()
        
        if output_dir:
            self.output_dir = output_dir
        else:
            # Resolve to knowledge/ relative to the repository root.
            # This is the version-controlled source of truth for the Agent Skills
            # and IntelliSense documentation.
            script_dir = os.path.dirname(os.path.abspath(__file__))
            self.output_dir = os.path.abspath(os.path.join(script_dir, "..", "..", "..", "knowledge"))
            
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
        parts = relative_path.split('/')
        module_folder = parts[0] if parts else "BML"
        
        if module_folder != "BestPractices":
            module_folder = "BML"
            
        filename = os.path.basename(relative_path)
        base_name, _ = os.path.splitext(filename)
        
        if "cpqapis/bml" in relative_path.lower():
            base_name = "RestAPIs_BML"
            
        out_path = os.path.join(self.output_dir, module_folder, base_name + ".md")
        return os.path.abspath(out_path)

    async def download_image(self, img_url, request_context=None, module_folder="BML"):
        parsed = urllib.parse.urlparse(img_url)
        img_filename = os.path.basename(parsed.path)
        if not img_filename:
            return None
            
        img_dir = os.path.join(self.output_dir, module_folder, "images")
        local_path = os.path.join(img_dir, img_filename)
        if os.path.exists(local_path):
            return local_path
            
        os.makedirs(img_dir, exist_ok=True)
        try:
            print(f"  [Image] Downloading: {img_url}", flush=True)
            if request_context:
                r = await request_context.get(img_url)
                if r.status == 200:
                    body = await r.body()
                    with open(local_path, 'wb') as f:
                        f.write(body)
                    return local_path
        except Exception as e:
            err_msg = str(e).encode('ascii', 'replace').decode('ascii')
            print(f"  [Image] Error downloading {img_url}: {err_msg}", flush=True)
        return None

    async def crawl_page(self, page, url, depth):
        url = self.normalize_url(url)
        workspace_path = self.get_workspace_path(url)
        if not workspace_path:
            return []
            
        relative_path = url[len(self.base_url):] if url.startswith(self.base_url) else ""
        module_folder = relative_path.split('/')[0] if relative_path else "BML"
        
        # Exclude non-BML topics from BestPractices
        if module_folder == "BestPractices":
            excluded = ["ApprovalSequences", "FOtoXLS", "ImageBestPractices", "ParticipantProfile", "EnsurelLtestVersion", "UpgradeJS", "UsejQuery", "Security"]
            if any(ex.lower() in url.lower() for ex in excluded):
                return []

        print(f"[Depth {depth}] Crawling [{module_folder}] with Playwright: {url}", flush=True)
        
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            if response and response.status >= 400:
                print(f"Error: Failed to fetch {url}, status code {response.status}", flush=True)
                return []
            
            # Wait for main content or timeout gracefully
            try:
                await page.wait_for_selector("#mc-main-content, div[role='main']", timeout=3000)
            except Exception:
                pass
                
            rendered_html = await page.content()
        except Exception as e:
            err_msg = str(e).encode('ascii', 'replace').decode('ascii')
            print(f"Error fetching {url}: {err_msg}", flush=True)
            return []
            
        soup = BeautifulSoup(rendered_html, 'html.parser')
        main_content = soup.find('div', role='main') or soup.find(id='mc-main-content')
        if not main_content:
            main_content = soup.body if soup.body else soup
            
        # Instantiate HTML to Docusaurus Markdown converter (no images)
        parser = HtmlToDocusaurus(
            base_url=self.base_url,
            output_dir=self.output_dir,
            current_url=url,
            current_output_path=workspace_path,
            download_image_callback=False
        )
        
        # Convert content to Docusaurus Markdown
        markdown = parser.convert(main_content)
        markdown = HtmlToDocusaurus.cleanup(markdown)
        
        # Get raw body text for description generation
        body_text = main_content.get_text()
        
        # Generate Docusaurus frontmatter
        frontmatter = parser.generate_frontmatter(soup, url, body_text)
        full_markdown = frontmatter + markdown
        
        # Ensure output directory exists and save file
        os.makedirs(os.path.dirname(workspace_path), exist_ok=True)
        with open(workspace_path, 'w', encoding='utf-8') as f:
            f.write(full_markdown)
        print(f"  -> Saved to: {workspace_path}", flush=True)
        
        # Extract links for recursive crawling
        links_to_crawl = []
        if depth < self.max_depth:
            for anchor in main_content.find_all('a', href=True):
                href = anchor['href']
                if href.startswith('javascript:') or href.startswith('#'):
                    continue
                resolved_url = self.resolve_url(href, url)
                if any(resolved_url.lower().endswith(ext) for ext in ['.zip', '.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.exe']):
                    continue
                if resolved_url.startswith(self.base_url):
                    is_target = any(x in resolved_url for x in ['/BML/', '/FunctionsScripts/', '/FunctionEditor/', 'UtilBml', '/BestPractices/'])
                    if is_target and resolved_url not in self.visited:
                        links_to_crawl.append(resolved_url)
                        
        return links_to_crawl

    async def fetch_toc_urls(self, request_context, module="BML"):
        toc_urls = []
        try:
            print(f"Fetching help system Master TOC configuration for {module} via Playwright...", flush=True)
            master_url = "https://help-cxsales.oraclecloud.com/cpq/Data/Tocs/Master.js"
            r = await request_context.get(master_url)
            if r.status != 200:
                print(f"Error: Failed to fetch Master.js (status code {r.status})", flush=True)
                return []
            
            master_text = await r.text()
            match = re.search(r'numchunks\s*:\s*(\d+)', master_text)
            num_chunks = int(match.group(1)) if match else 1
            
            print(f"Discovered {num_chunks} TOC chunk files. Fetching {module} pages...", flush=True)
            for c in range(num_chunks):
                chunk_url = f"https://help-cxsales.oraclecloud.com/cpq/Data/Tocs/Master_Chunk{c}.js"
                chunk_r = await request_context.get(chunk_url)
                if chunk_r.status == 200:
                    chunk_text = await chunk_r.text()
                    matches = re.findall(rf"['\"]/Content/{re.escape(module)}/([^'\"]+)['\"]", chunk_text)
                    for m in matches:
                        toc_urls.append(f"https://help-cxsales.oraclecloud.com/cpq/Content/{module}/{m}")
                        
            print(f"Successfully resolved {len(toc_urls)} {module} module URLs dynamically.", flush=True)
        except Exception as e:
            err_msg = str(e).encode('ascii', 'replace').decode('ascii')
            print(f"Error resolving TOC URLs dynamically for {module}: {err_msg}", flush=True)
            
        return toc_urls

    async def start_async(self, seed_url=None, modules=None):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                ignore_https_errors=True,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )

            # Abort heavy unneeded assets to make page loading ultra-fast
            async def block_assets(route):
                req = route.request
                if req.resource_type in ["image", "media", "font"]:
                    await route.abort()
                else:
                    await route.continue_()

            await context.route("**/*", block_assets)

            queue = asyncio.Queue()
            queued_set = set()

            async def add_to_queue(u, d):
                norm = self.normalize_url(u)
                if norm not in queued_set and norm not in self.visited:
                    queued_set.add(norm)
                    await queue.put((norm, d))

            if seed_url:
                resolved = self.resolve_url(seed_url)
                norm_seed = self.normalize_url(resolved)
                if norm_seed.lower().endswith(('.htm', '.html')):
                    print(f"Seeding single page crawl with: {norm_seed}", flush=True)
                    await add_to_queue(norm_seed, 1)
                elif "BestPractices" in norm_seed:
                    toc_urls = await self.fetch_toc_urls(context.request, "BestPractices")
                    if toc_urls:
                        print(f"Pre-seeding queue with all {len(toc_urls)} BestPractices pages from TOC...", flush=True)
                        for u in toc_urls:
                            await add_to_queue(u, 1)
                    else:
                        await add_to_queue(norm_seed, 1)
                elif "BML" in norm_seed:
                    toc_urls = await self.fetch_toc_urls(context.request, "BML")
                    if toc_urls:
                        print(f"Pre-seeding queue with all {len(toc_urls)} BML pages from TOC...", flush=True)
                        for u in toc_urls:
                            await add_to_queue(u, 1)
                    else:
                        await add_to_queue(norm_seed, 1)
                else:
                    await add_to_queue(norm_seed, 1)
            elif modules:
                for mod in modules:
                    urls = await self.fetch_toc_urls(context.request, mod)
                    for u in urls:
                        await add_to_queue(u, 1)
            else:
                for mod in ["BML", "BestPractices"]:
                    urls = await self.fetch_toc_urls(context.request, mod)
                    for u in urls:
                        await add_to_queue(u, 1)

            if not seed_url and (modules is None or "BML" in modules):
                for rel_path in EXTRA_BML_PAGES:
                    full_url = urllib.parse.urljoin(self.base_url, rel_path)
                    await add_to_queue(full_url, 1)

            print(f"Starting Playwright crawl with {queue.qsize()} initial pages in queue (workers: {self.concurrency})...", flush=True)

            # Worker pool with graceful sentinel completion
            async def worker(worker_id):
                page = await context.new_page()
                try:
                    while True:
                        item = await queue.get()
                        if item is None:
                            queue.task_done()
                            break

                        current_url, depth = item
                        if current_url in self.visited:
                            queue.task_done()
                            continue

                        self.visited.add(current_url)
                        try:
                            next_links = await self.crawl_page(page, current_url, depth)
                            for link in next_links:
                                await add_to_queue(link, depth + 1)
                        except Exception as e:
                            err_msg = str(e).encode('ascii', 'replace').decode('ascii')
                            print(f"[Worker {worker_id}] Error crawling {current_url}: {err_msg}", flush=True)
                        finally:
                            queue.task_done()
                finally:
                    await page.close()

            workers = [asyncio.create_task(worker(i)) for i in range(self.concurrency)]
            await queue.join()

            # Signal workers to cleanly shut down
            for _ in range(self.concurrency):
                await queue.put(None)
            await asyncio.gather(*workers, return_exceptions=True)
            await browser.close()

            print(f"\nPlaywright crawl complete! Visited {len(self.visited)} pages across modules.", flush=True)

    def start(self, seed_url=None, modules=None):
        asyncio.run(self.start_async(seed_url=seed_url, modules=modules))


if __name__ == '__main__':
    depth = 3
    modules = None
    seed = None
    concurrency = 8

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--all":
            modules = ["BML", "BestPractices"]
        elif arg == "--best-practices":
            modules = ["BestPractices"]
        elif arg == "--bml":
            modules = ["BML"]
        elif arg in ["--concurrency", "-c"] and i + 1 < len(args):
            concurrency = int(args[i + 1])
            i += 1
        elif arg.startswith("http"):
            seed = arg
        else:
            seed = arg
        i += 1

    if not seed and not modules:
        modules = ["BML", "BestPractices"]

    crawler = BmlDocCrawler(max_depth=depth, concurrency=concurrency)
    crawler.start(seed_url=seed, modules=modules)

    # Post-process: fix image refs, promote function headers, convert param tables
    print("\n[postprocess] Applying post-processing fixes to generated markdown...", flush=True)
    from bml_crawler.postprocess import postprocess_bml_docs
    for mod in ["BML", "BestPractices"]:
        mod_dir = os.path.join(crawler.output_dir, mod)
        if os.path.isdir(mod_dir):
            postprocess_bml_docs(mod_dir, strip_images=True)
