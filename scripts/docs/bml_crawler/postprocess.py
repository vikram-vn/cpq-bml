"""
postprocess.py - Repairs and formats BML markdown files in Docusaurus style:
  1. Normalizes CRLF -> LF line endings
  2. Fixes image references to use flat relative path (images/<file>)
  3. Promotes standalone function-name lines to ## headers
  4. Converts flat parameter table text blocks to proper markdown tables
  5. Formats Syntax as fenced ```bml code blocks
  6. Formats Return Type as a styled badge line
  7. Formats single-line Example: code -> fenced ```bml code block with title
  8. Strips bare "Parameters:" and "Functions" label lines (replaced by table/header)

Output matches Docusaurus MDX conventions so files look great both in VS Code
preview and in a Docusaurus site.
"""

import os
import re
import sys


def _load_known_function_names(bml_dir):
    try:
        import json
        json_path = os.path.abspath(
            os.path.join(bml_dir, "..", "..", "..", "lang", "intellisense", "bml-functions-api-usage.json")
        )
        if os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            return set(data.keys())
    except Exception:
        pass
    return set()


# ---------------------------------------------------------------------------
# 1. Fix image paths
# ---------------------------------------------------------------------------

_IMG_RE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')

def _fix_image_refs(content):
    def _replace(m):
        alt, src = m.group(1), m.group(2)
        if src.startswith("http://") or src.startswith("https://"):
            return m.group(0)
        if "transparent.gif" in src:
            return ""
        return f"![{alt}](images/{os.path.basename(src.split('?')[0])})"
    return _IMG_RE.sub(_replace, content)


# ---------------------------------------------------------------------------
# 2. Promote standalone function names -> ## headers
# ---------------------------------------------------------------------------

def _promote_function_headers(content, known_names):
    if not known_names:
        return content
    lines = content.split("\n")
    out = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        prev_blank = (i == 0) or (lines[i - 1].strip() == "")
        if (stripped in known_names and prev_blank
                and not stripped.startswith(("#", "```", "|", "---", "!"))):
            out.append(f"## {stripped}")
        else:
            out.append(line)
    return "\n".join(out)


# ---------------------------------------------------------------------------
# 3. Convert flat parameter blocks -> markdown tables
# ---------------------------------------------------------------------------

def _convert_param_tables(content):
    lines = content.split("\n")
    out = []
    i = 0
    while i < len(lines):
        if (lines[i].strip() == "Parameter"
                and i + 2 < len(lines)
                and lines[i + 1].strip() == "Data Type"
                and lines[i + 2].strip() == "Description"):
            j = i + 3
            raw = []
            while j < len(lines):
                s = lines[j].strip()
                if re.match(r'^(Return Type:|Example|## |---)', s):
                    break
                raw.append(s)
                j += 1
            non_blank = [t for t in raw if t]
            rows = [(non_blank[k], non_blank[k+1], non_blank[k+2])
                    for k in range(0, len(non_blank) - 2, 3)]
            if rows:
                out.extend(["", "| Parameter | Data Type | Description |", "| --- | --- | --- |"])
                for p, d, desc in rows:
                    out.append(f"| `{p}` | {d} | {desc} |")
                out.append("")
                i = j
                continue
        out.append(lines[i])
        i += 1
    return "\n".join(out)


# ---------------------------------------------------------------------------
# 4. Docusaurus-style formatting pass
# ---------------------------------------------------------------------------
# Line-by-line state machine to format:
#   Syntax: sig          ->  **Syntax:**\n```bml\nsig\n```
#   Return Type: T       ->  > **Return Type:** `T`
#   Example: code        ->  **Example:**\n```bml title="Example"\ncode\n```
#   Example:             ->  **Example:**
#   Parameters:          ->  (removed - redundant before table)
#   "Functions" alone    ->  (removed)
# ---------------------------------------------------------------------------

_SYNTAX_RE   = re.compile(r'^\s*Syntax:\s*(.+)$')
_RETURN_RE   = re.compile(r'^\s*Return Type:\s*(.+)$')
_EX_CODE_RE  = re.compile(r'^\s*Example:\s*(.+)$')
_EX_HEAD_RE  = re.compile(r'^\s*Example:\s*$')
_PARAMS_RE   = re.compile(r'^\s*Parameters?:\s*$')


def _docusaurus_format(content):
    lines = content.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Remove bare "Parameters:" line (table already added below it)
        if _PARAMS_RE.match(line):
            i += 1
            continue

        # Syntax: signature  ->  **Syntax:** fenced code block
        m = _SYNTAX_RE.match(line)
        if m:
            sig = m.group(1).strip()
            out.append("")
            out.append("**Syntax:**")
            out.append("```bml")
            out.append(sig)
            out.append("```")
            out.append("")
            i += 1
            continue

        # Return Type: T  ->  blockquote badge
        m = _RETURN_RE.match(line)
        if m:
            rtype = m.group(1).strip()
            out.append(f"> **Return Type:** `{rtype}`")
            out.append("")
            i += 1
            continue

        # Example: some_code()  ->  fenced code block with title
        m = _EX_CODE_RE.match(line)
        if m:
            code = m.group(1).strip()
            out.append("")
            out.append('**Example:**')
            out.append('```bml title="Example"')
            out.append(code)
            out.append("```")
            out.append("")
            i += 1
            continue

        # Example:  alone  ->  heading only
        if _EX_HEAD_RE.match(line):
            out.append("")
            out.append("**Example:**")
            out.append("")
            i += 1
            continue

        out.append(line)
        i += 1
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def postprocess_bml_docs(bml_dir, known_names=None, strip_images=False):
    if known_names is None:
        known_names = _load_known_function_names(bml_dir)
    md_files = []
    for root, _, files in os.walk(bml_dir):
        for f in files:
            if f.endswith(".md"):
                md_files.append(os.path.join(root, f))
    fixed = 0
    for path in md_files:
        with open(path, encoding="utf-8") as f:
            original = f.read()
        content = original.replace("\r\n", "\n").replace("\r", "\n")
        if strip_images:
            content = _IMG_RE.sub("", content)
        else:
            content = _fix_image_refs(content)
        content = _promote_function_headers(content, known_names)
        content = _convert_param_tables(content)
        content = _docusaurus_format(content)
        content = re.sub(r'\n{4,}', '\n\n\n', content)
        if content != original:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)
            print(f"  [postprocess] Fixed: {os.path.basename(path)}")
            fixed += 1
    print(f"[postprocess] Done: {fixed}/{len(md_files)} files updated in {os.path.basename(bml_dir)}.")


if __name__ == "__main__":
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _package_parent = os.path.abspath(os.path.join(_script_dir, ".."))
    if _package_parent not in sys.path:
        sys.path.insert(0, _package_parent)
    _bml_dir = os.path.abspath(os.path.join(_script_dir, "..", "..", "..", "scratch", "knowledge", "BML"))
    if not os.path.isdir(_bml_dir):
        print(f"ERROR: BML docs directory not found: {_bml_dir}")
        sys.exit(1)
    print(f"[postprocess] Processing: {_bml_dir}")
    postprocess_bml_docs(_bml_dir)