"""
transform.py - General-purpose Markdown -> Docusaurus-quality Markdown transformer.

Unlike scripts/bml_crawler/html2docmd (which converts *HTML* pages into
Markdown for the Oracle BML crawler), this tool takes *Markdown that already
exists* anywhere in the repo and upgrades it in place:

  1. Frontmatter: if the file has none, synthesizes one (id, title,
     sidebar_label, description, tags) from the first H1 heading and the
     leading body text - same shape as html2docmd's frontmatter.py, so
     output is consistent across the whole repo. Files that already have
     frontmatter are left untouched.
  2. Admonitions: "Note:", "Tip:", "Warning:", "Caution:", "Important:", and
     "Danger:" prefixed paragraphs become ":::type ... :::" MDX blocks.
     Skips anything already inside a fenced code block or an existing
     ":::" admonition.
  3. Heading hierarchy: a Docusaurus page should have exactly one H1 (the
     page title). Any additional "# " headings after the first are demoted
     to "##" so the doc outline stays sane.
  4. Code fences: bare ``` fences (no language) get a best-effort language
     tag inferred by sniffing the first line inside them.
  5. Whitespace cleanup: collapses 3+ blank lines to 2, strips trailing
     whitespace, ensures a single trailing newline.

Usage:
    python scripts/docmd/transform.py <file-or-dir> [<file-or-dir> ...] [options]

    --in-place        Overwrite the source file(s).
    --out DIR         Write transformed output into DIR instead (mirrors
                       filenames, not the source directory structure).
    --id ID           Explicit frontmatter id (single-file mode only).
    --title TITLE     Explicit frontmatter title (single-file mode only).
    --tags a,b,c      Comma-separated frontmatter tags (used only when
                       synthesizing new frontmatter).

    With neither --in-place nor --out, the transformed Markdown is printed
    to stdout (single file only).

Directories are processed recursively for **/*.md. Running the transform
twice in a row on already-processed output is a no-op (idempotent).
"""

import argparse
import glob
import os
import re
import sys

_FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})(\S*)\s*$")
_FRONTMATTER_RE = re.compile(r"^---\r?\n.*?\r?\n---\r?\n", re.DOTALL)
_H1_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)

_ADMONITION_PREFIXES = [
    ("Note:", "note"),
    ("Tip:", "tip"),
    ("Warning:", "warning"),
    ("Caution:", "warning"),
    ("Important:", "info"),
    ("Info:", "info"),
    ("Danger:", "danger"),
]

# Best-effort language sniffers for bare ``` fences, checked in order.
_LANG_SNIFFERS = [
    (re.compile(r"^\s*<[\w!?]"), "xml"),
    (re.compile(r"^\s*[\[{]\s*[\"'\w]"), "json"),
    (re.compile(r"^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)\s", re.I), "sql"),
    (re.compile(r"^\s*(#!/|\$\s)"), "bash"),
    (re.compile(r"^\s*(def |import |from \S+ import)"), "python"),
]


def split_frontmatter(text):
    """Return (frontmatter_block, body). frontmatter_block is '' if absent."""
    m = _FRONTMATTER_RE.match(text)
    if m:
        return text[: m.end()], text[m.end() :]
    return "", text


def _esc_yaml(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


def build_frontmatter(body, doc_id, title, tags):
    if not title:
        h1 = _H1_RE.search(body)
        title = h1.group(1).strip() if h1 else doc_id

    plain = re.sub(r"```.*?```", " ", body, flags=re.DOTALL)
    plain = re.sub(r"[#*`_>\[\]!:-]", " ", plain)
    plain = re.sub(r"\s+", " ", plain).strip()
    description = plain[:200].rstrip()
    if len(plain) > 200:
        description += "..."

    lines = ["---", f"id: {doc_id}", f'title: "{_esc_yaml(title)}"', f'sidebar_label: "{_esc_yaml(title)}"']
    if description:
        lines.append(f'description: "{_esc_yaml(description)}"')
    if tags:
        lines.append(f"tags: {tags}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def normalize_headings(body):
    """Demote every H1 after the first one to H2, so a doc has a single title heading."""
    lines = body.split("\n")
    out = []
    seen_h1 = False
    in_fence = False
    for line in lines:
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            out.append(line)
            continue
        if not in_fence and re.match(r"^#\s+\S", line):
            if seen_h1:
                out.append("#" + line)
            else:
                seen_h1 = True
                out.append(line)
        else:
            out.append(line)
    return "\n".join(out)


def convert_admonitions(body):
    """Wrap 'Note:'/'Tip:'/... paragraphs in ':::type ... :::' blocks."""
    lines = body.split("\n")
    out = []
    in_fence = False
    in_admonition = False
    i, n = 0, len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        if _FENCE_RE.match(line):
            in_fence = not in_fence
            out.append(line)
            i += 1
            continue

        if stripped.startswith(":::"):
            in_admonition = not in_admonition
            out.append(line)
            i += 1
            continue

        if in_fence or in_admonition or not stripped:
            out.append(line)
            i += 1
            continue

        # Collect a paragraph: consecutive non-blank lines up to the next
        # blank line, fence, or admonition boundary.
        para = []
        while i < n and lines[i].strip() and not _FENCE_RE.match(lines[i]) and not lines[i].strip().startswith(":::"):
            para.append(lines[i])
            i += 1

        first = para[0].strip()
        matched = next((p for p in _ADMONITION_PREFIXES if first.startswith(p[0])), None)
        if matched:
            prefix, adm_type = matched
            para[0] = para[0].replace(prefix, "", 1).lstrip()
            body_lines = [l for l in para if l.strip()] or [""]
            out.append(f":::{adm_type}")
            out.extend(body_lines)
            out.append(":::")
        else:
            out.extend(para)

    return "\n".join(out)


def infer_fence_languages(body):
    """Add a best-effort language tag to bare ``` / ~~~ fences.

    Only opening fences get a language guess - closing fences must stay
    bare (a trailing tag like `text` on a closing fence isn't valid
    CommonMark and would leave the block un-terminated).
    """
    lines = body.split("\n")
    out = []
    i, n = 0, len(lines)
    in_fence = False
    while i < n:
        m = _FENCE_RE.match(lines[i])
        if m and not in_fence:
            in_fence = True
            if m.group(3) == "":
                indent, marker = m.group(1), m.group(2)
                lang = "text"
                j = i + 1
                while j < n and not lines[j].strip().startswith(marker):
                    if lines[j].strip():
                        for pattern, name in _LANG_SNIFFERS:
                            if pattern.match(lines[j]):
                                lang = name
                                break
                        break
                    j += 1
                out.append(f"{indent}{marker}{lang}")
            else:
                out.append(lines[i])
        elif m and in_fence:
            in_fence = False
            out.append(lines[i])
        else:
            out.append(lines[i])
        i += 1
    return "\n".join(out)


def cleanup(text):
    lines = [l.rstrip() for l in text.splitlines()]
    cleaned, blank_count = [], 0
    for line in lines:
        if line == "":
            blank_count += 1
            if blank_count <= 2:
                cleaned.append(line)
        else:
            blank_count = 0
            cleaned.append(line)
    return "\n".join(cleaned).strip() + "\n"


def transform(text, doc_id=None, title=None, tags=None):
    frontmatter, body = split_frontmatter(text)
    body = normalize_headings(body)
    body = convert_admonitions(body)
    body = infer_fence_languages(body)
    body = cleanup(body)

    if not frontmatter:
        frontmatter = build_frontmatter(body, doc_id or "doc", title, tags or [])

    return frontmatter.rstrip("\n") + "\n\n" + body.lstrip("\n")


def process_file(path, in_place, out_dir, doc_id, title, tags):
    with open(path, encoding="utf-8") as f:
        original = f.read()

    inferred_id = doc_id or os.path.splitext(os.path.basename(path))[0]
    result = transform(original, doc_id=inferred_id, title=title, tags=tags)
    changed = result != original

    if in_place:
        if changed:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(result)
        return changed

    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, os.path.basename(path))
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(result)
        return True

    print(result)
    return True


def collect_files(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            files.extend(sorted(glob.glob(os.path.join(p, "**", "*.md"), recursive=True)))
        elif os.path.isfile(p):
            files.append(p)
        else:
            print(f"WARNING: path not found, skipping: {p}")
    return files


def main():
    parser = argparse.ArgumentParser(
        description="Upgrade Markdown files to Docusaurus-quality Markdown (frontmatter, admonitions, heading hierarchy, fenced-code languages)."
    )
    parser.add_argument("paths", nargs="+", help="Markdown file(s), or directories to scan recursively for **/*.md.")
    parser.add_argument("--in-place", action="store_true", help="Overwrite the source file(s).")
    parser.add_argument("--out", metavar="DIR", help="Write transformed output into DIR instead of overwriting.")
    parser.add_argument("--id", help="Explicit frontmatter id (single-file mode only, used only if frontmatter is missing).")
    parser.add_argument("--title", help="Explicit frontmatter title (single-file mode only, used only if frontmatter is missing).")
    parser.add_argument("--tags", help="Comma-separated frontmatter tags, e.g. --tags Guide,API (used only if frontmatter is missing).")
    args = parser.parse_args()

    tags = args.tags.split(",") if args.tags else []
    files = collect_files(args.paths)

    if not files:
        print("No Markdown files found.")
        sys.exit(1)

    if len(files) > 1 and (args.id or args.title):
        print("ERROR: --id/--title only apply to single-file mode.")
        sys.exit(1)

    updated = 0
    for path in files:
        if process_file(path, args.in_place, args.out, args.id, args.title, tags):
            updated += 1
            if args.in_place or args.out:
                print(f"{'Updated' if args.in_place else 'Transformed'}: {path}")

    if args.in_place or args.out:
        print(f"Done: {updated}/{len(files)} file(s) changed.")


if __name__ == "__main__":
    main()
