import re

def strip_html(text):
    if not text:
        return ""
    # replace <br/?> with \n
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    # strip HTML tags like <b>, <i>, <code>, <span>, <div>, <p>, <a>, etc.
    text = re.sub(r'</?(?:b|strong|i|em|tt|code|p|div|span|table|thead|tbody|tr|td|th|ul|ol|li|a)\b[^>]*>', '', text, flags=re.IGNORECASE)
    # replace HTML entities so <Type> and other entities are preserved
    text = text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"').replace('&nbsp;', ' ').replace('&euro;', '€')
    # normalize whitespace
    text = text.replace('\r', '')
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def to_snippet_syntax(short_syntax):
    if not short_syntax:
        return ""
    # If already a formatted snippet with tab-stops, preserve as-is
    if "${1:" in short_syntax or "${0}" in short_syntax:
        return short_syntax

    match = re.search(r'(\w+)\s*\(([^)]*)\)', short_syntax)
    if not match:
        return short_syntax
        
    func_name = match.group(1)
    params_str = match.group(2)
    if not params_str.strip():
        return f"{func_name}()"
        
    # Clean optional parameter brackets: [, ], etc.
    cleaned_params_str = params_str.replace('[', '').replace(']', '').strip()
    if not cleaned_params_str:
        return f"{func_name}()"

    params = [p.strip() for p in cleaned_params_str.split(',') if p.strip()]
    snippet_params = []
    for idx, p in enumerate(params, start=1):
        param_parts = p.split()
        param_name = param_parts[-1] if param_parts else p
        param_name = re.sub(r'[^a-zA-Z0-9_]', '', param_name) or f"param{idx}"
        snippet_params.append(f"${{{idx}:{param_name}}}")
        
    return f"{func_name}({', '.join(snippet_params)})"

def extract_return_type(full_signature):
    if not full_signature:
        return None
    match = re.match(r'^(\w+(?:\[\])*)\s+\w+\(', full_signature)
    return match.group(1) if match else None
