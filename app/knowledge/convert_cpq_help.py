import sys
import re
import urllib.parse
import requests
from bs4 import BeautifulSoup, NavigableString

class BmlDocConverter:
    def __init__(self, base_url="https://help-cxsales.oraclecloud.com/cpq/Content/"):
        self.base_url = base_url

    def resolve_url(self, url):
        # Extract the page name from hash if present, e.g.:
        # https://help-cxsales.oraclecloud.com/cpq/#BML/BMLOverview.htm?TocPath=BML%257C_____0
        # -> https://help-cxsales.oraclecloud.com/cpq/Content/BML/BMLOverview.htm
        parsed = urllib.parse.urlparse(url)
        if parsed.fragment:
            fragment = parsed.fragment
            # Remove query parameters like ?TocPath=...
            if '?' in fragment:
                fragment = fragment.split('?')[0]
            # Strip leading slashes
            fragment = fragment.lstrip('/')
            return urllib.parse.urljoin(self.base_url, fragment)
        
        # If there's no fragment but it contains cpq/Content/, return as is
        if 'Content/' in url:
            return url
            
        # Fallback/guess
        return url

    def convert_to_markdown(self, element):
        if isinstance(element, NavigableString):
            return element.string if element.string else ""

        tag_name = element.name
        if not tag_name:
            return ""

        # Skip script and style tags
        if tag_name in ['script', 'style']:
            return ""

        # Process children
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
            return f"\n```\n{children_md.strip()}\n```\n"

        elif tag_name == 'a':
            text = children_md.strip()
            href = element.get('href', '')
            if text and href:
                if href.startswith('javascript:'):
                    return text
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
            if 'Note' in class_list:
                return f"\n\n> [!NOTE]\n> " + children_md.strip().replace('\n', '\n> ') + "\n\n"
            return f"\n{children_md}\n"

        return children_md

    def clean_text(self, text):
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def fetch_and_convert(self, url):
        target_url = self.resolve_url(url)
        print(f"Original URL: {url}")
        print(f"Fetching resolved direct URL: {target_url}")
        
        response = requests.get(target_url, headers={'User-Agent': 'Mozilla/5.0'})
        if response.status_code != 200:
            raise Exception(f"Failed to fetch content, status code: {response.status_code}")
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        main_content = soup.find('div', role='main') or soup.find(id='mc-main-content')
        if not main_content:
            main_content = soup.body if soup.body else soup
            
        markdown = self.convert_to_markdown(main_content)
        markdown = re.sub(r'\n{3,}', '\n\n', markdown)
        return markdown.strip()

def main():
    default_url = "https://help-cxsales.oraclecloud.com/cpq/#BML/BMLOverview.htm?TocPath=BML%257C_____0"
    url = sys.argv[1] if len(sys.argv) > 1 else default_url
    output_filename = sys.argv[2] if len(sys.argv) > 2 else "BMLOverview.md"
    
    converter = BmlDocConverter()
    try:
        md = converter.fetch_and_convert(url)
        with open(output_filename, 'w', encoding='utf-8') as f:
            f.write(md)
        print(f"Success! Document converted and saved as {output_filename}")
    except Exception as e:
        print(f"Error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
