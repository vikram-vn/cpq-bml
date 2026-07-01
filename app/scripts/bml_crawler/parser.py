import os
import re
import urllib.parse
from bs4 import BeautifulSoup, NavigableString

class HtmlToMarkdown:
    def __init__(self, base_url, output_dir, current_url=None, current_output_path=None, download_image_callback=None):
        self.base_url = base_url
        self.output_dir = output_dir
        self.current_url = current_url
        self.current_output_path = current_output_path
        self.download_image_callback = download_image_callback

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
        base_path, _ = os.path.splitext(relative_path)
        out_path = os.path.join(self.output_dir, base_path + ".md")
        return os.path.abspath(out_path)

    def clean_text(self, text):
        text = text.replace('\n', ' ')
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def generate_frontmatter(self, soup, url, body_text):
        title = ""
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text().strip()
            title = re.split(r'\s+-\s+Oracle', title)[0]
            
        if not title:
            h1_tag = soup.find('h1')
            if h1_tag:
                title = h1_tag.get_text().strip()
                
        relative_path = url[len(self.base_url):]
        filename = os.path.basename(relative_path)
        doc_id, _ = os.path.splitext(filename)
        
        if not title:
            title = doc_id

        # Extract first 150 chars of body text as description
        clean_body = re.sub(r'\s+', ' ', body_text).strip()
        description = clean_body[:150].strip()
        if len(clean_body) > 150:
            description += "..."
            
        # Escape double quotes in frontmatter strings
        description_escaped = description.replace('"', '\\"')
        title_escaped = title.replace('"', '\\"')

        frontmatter = "---\n"
        frontmatter += f"id: {doc_id}\n"
        frontmatter += f"title: \"{title_escaped}\"\n"
        frontmatter += f"sidebar_label: \"{title_escaped}\"\n"
        if description_escaped:
            frontmatter += f"description: \"{description_escaped}\"\n"
        
        # Add smart tags based on path
        tags = ["BML", "CPQ"]
        if "FunctionsScripts" in relative_path:
            tags.append("Functions")
        elif "FunctionEditor" in relative_path:
            tags.append("Editor")
        frontmatter += f"tags: {tags}\n"
        
        frontmatter += "---\n\n"
        return frontmatter

    def convert(self, element):
        if isinstance(element, NavigableString):
            return element.string if element.string else ""

        tag_name = element.name
        if not tag_name:
            return ""

        if tag_name in ['script', 'style']:
            return ""

        children_md = "".join(self.convert(child) for child in element.children)

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
            lang = "bml"
            if "<" in code_text and ">" in code_text and ("</" in code_text or "/>" in code_text):
                lang = "xml"
            elif "select " in code_text.lower() and "from " in code_text.lower():
                lang = "sql"
            elif "{" in code_text and "}" in code_text and (":" in code_text or '"' in code_text):
                if code_text.strip().startswith("{") or code_text.strip().startswith("["):
                    lang = "json"

            # Enhanced feature: Look for a title in the preceding element
            code_title = ""
            prev = element.find_previous_sibling()
            if prev and prev.name in ['p', 'h4', 'h5', 'h6', 'div']:
                prev_text = prev.get_text().strip()
                if "example" in prev_text.lower() or "syntax" in prev_text.lower():
                    code_title = re.split(r'[:\n.]', prev_text)[0].strip()
                    if len(code_title) > 60:
                        code_title = ""

            meta = f" title=\"{code_title}\"" if code_title else ""
            return f"\n```{lang}{meta}\n{code_text}\n```\n"

        elif tag_name == 'img':
            src = element.get('src', '')
            alt = element.get('alt', 'image')
            if src and self.download_image_callback:
                resolved_img_url = self.resolve_url(src, self.current_url)
                local_img_path = self.download_image_callback(resolved_img_url)
                if local_img_path:
                    rel_img_path = os.path.relpath(local_img_path, os.path.dirname(self.current_output_path)).replace('\\', '/')
                    return f"![{alt}]({rel_img_path})"
                return f"![{alt}]({resolved_img_url})"
            elif src:
                return f"![{alt}]({src})"
            return ""

        elif tag_name == 'a':
            text = children_md.strip()
            href = element.get('href', '')
            if text and href:
                if href.startswith('javascript:'):
                    return text
                resolved_url = self.resolve_url(href, self.current_url)
                local_path = self.get_workspace_path(resolved_url)
                if local_path:
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
                    cell_text = self.clean_text(self.convert(cell))
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
