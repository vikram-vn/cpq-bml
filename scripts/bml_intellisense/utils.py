import re

def strip_html(text):
    if not text:
        return ""
    # replace <br/?> with \n
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    # replace HTML entities
    text = text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"').replace('&nbsp;', ' ').replace('&euro;', '€')
    # replace bold/italic/code tags
    text = re.sub(r'</?(b|strong|i|em|tt|code)>', '', text, flags=re.IGNORECASE)
    # strip all other HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # normalize whitespace
    text = text.replace('\r', '')
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def to_snippet_syntax(short_syntax):
    if not short_syntax:
        return ""
    match = re.search(r'\(([^)]*)\)', short_syntax)
    if not match:
        return short_syntax
        
    params_str = match.group(1)
    if not params_str.strip():
        return short_syntax.replace(match.group(0), '()')
        
    params = params_str.split(',')
    idx = 1
    snippet_params = []
    for p in params:
        param_name = p.strip()
        snippet_params.append(f"${{{idx}:{param_name}}}")
        idx += 1
        
    return short_syntax.replace(match.group(0), f"({', '.join(snippet_params)})")

def extract_return_type(full_signature):
    if not full_signature:
        return None
    match = re.match(r'^(\w+(?:\[\])*)\s+\w+\(', full_signature)
    return match.group(1) if match else None
