"""
release.py - Automates the CPQ-BML release process.

Run via `yarn release` (wraps this script in package.json). On each run it:

  1. Reads the current version from package.json.
  2. Collects commits since the last "vX.Y.Z" git tag (or full history if
     there is no tag yet).
  3. Categorizes commits by their Conventional Commit prefix
     (feat/fix/refactor/perf/style/docs/...).
  4. Determines the next semver version: any breaking-change commit bumps
     major, any 'feat' bumps minor, otherwise patch. An explicit version can
     also be passed on the command line to skip auto-detection.
  5. Prepends a new "## [x.y.z] - YYYY-MM-DD" entry to CHANGELOG.md, grouped
     into Keep a Changelog style sections (Added / Fixed / Changed / Docs).
     This file stays plain Markdown - it's what the VS Code Marketplace
     "Changelog" tab and GitHub render, and neither supports MDX syntax.
  6. Updates the "version" field in package.json.
  7. Replaces the marked "Latest Release" section in README.md with a short
     summary of the new version's highlights (also plain GitHub Markdown).
  8. Writes a Docusaurus-flavored versioned release page to
     app/knowledge/Changelog/<version>.md: full frontmatter (id, title,
     sidebar_label, description, tags, slug), an MDX ":::tip Highlights"
     callout, a ":::danger Breaking Changes" callout when applicable, and
     the same sections as headings. This mirrors the frontmatter style
     already used by the BML doc crawler's html2docmd output, so it can be
     dropped straight into a Docusaurus docs/ or blog/ folder. A
     _category_.json is created alongside it once, for Docusaurus's
     auto-generated sidebar.
  9. Runs `yarn build` (falls back to `npm run build`), which minifies
     extension.js/the settings webview and packages a .vsix via
     @vscode/vsce - using the version just written to package.json. Skipped
     entirely for --dry-run or --skip-build.

Nothing is committed, tagged, or pushed automatically - the script only
edits these files, builds the .vsix, and prints the suggested git commands
to run next.

Usage:
    python app/scripts/release/release.py [version] [--dry-run] [--skip-build]

    version       Optional explicit version, e.g. "1.5.0". If omitted, the
                  bump type is auto-detected from commit prefixes.
    --dry-run     Preview the changelog/version/README updates without
                  writing any files or building anything.
    --skip-build  Update the changelog/version/README/docs files but don't
                  run the build/package step.
"""

import os
import re
import shutil
import subprocess
import sys
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PACKAGE_JSON = os.path.join(ROOT, "package.json")
CHANGELOG = os.path.join(ROOT, "CHANGELOG.md")
README = os.path.join(ROOT, "README.md")
DOCS_CHANGELOG_DIR = os.path.join(ROOT, "app", "knowledge", "Changelog")

RECORD_SEP = "\x1e"
FIELD_SEP = "\x1f"

# Conventional Commit type -> Keep a Changelog section
_SECTION_MAP = {
    "feat": "Added",
    "fix": "Fixed",
    "refactor": "Changed",
    "perf": "Changed",
    "style": "Changed",
    "docs": "Documentation",
}
# Types that never surface in the changelog (internal housekeeping)
_SKIP_TYPES = {"chore", "test", "ci", "build"}
_SECTION_ORDER = ["Added", "Fixed", "Changed", "Documentation"]

_COMMIT_RE = re.compile(r"^(?P<type>\w+)(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<desc>.+)$")
_VERSION_RE = re.compile(r'"version":\s*"(\d+\.\d+\.\d+)"')


def run_git(*args):
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def get_current_version():
    with open(PACKAGE_JSON, encoding="utf-8") as f:
        content = f.read()
    m = _VERSION_RE.search(content)
    if not m:
        raise RuntimeError("Could not find a \"version\" field in package.json")
    return m.group(1), content


def get_last_tag():
    result = subprocess.run(
        ["git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"],
        cwd=ROOT, capture_output=True, text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def get_commits(since_tag):
    commit_range = f"{since_tag}..HEAD" if since_tag else "HEAD"
    fmt = f"%H{FIELD_SEP}%s{FIELD_SEP}%b{RECORD_SEP}"
    raw = run_git("log", commit_range, "--no-merges", f"--pretty=format:{fmt}")
    commits = []
    for record in raw.split(RECORD_SEP):
        record = record.strip("\n")
        if not record.strip():
            continue
        parts = record.split(FIELD_SEP)
        if len(parts) != 3:
            continue
        commit_hash, subject, body = parts
        commits.append({"hash": commit_hash, "subject": subject.strip(), "body": body.strip()})
    return commits


def categorize(commits):
    """Return (sections dict, bump_type, breaking_items) from a list of commit dicts."""
    sections = {name: [] for name in _SECTION_ORDER}
    breaking_items = []
    has_feat = False
    has_breaking = False

    for commit in commits:
        m = _COMMIT_RE.match(commit["subject"])
        if not m:
            # Unconventional subject: still worth surfacing under Changed.
            sections["Changed"].append(_format_bullet(None, commit["subject"]))
            continue

        ctype = m.group("type").lower()
        scope = m.group("scope")
        desc = m.group("desc").strip()
        breaking = bool(m.group("breaking")) or "BREAKING CHANGE" in commit["body"]
        bullet = _format_bullet(scope, desc)

        if breaking:
            has_breaking = True
            breaking_items.append(bullet)
        if ctype == "feat":
            has_feat = True
        if ctype in _SKIP_TYPES:
            continue

        section = _SECTION_MAP.get(ctype, "Changed")
        sections[section].append(bullet)

    if has_breaking:
        bump = "major"
    elif has_feat:
        bump = "minor"
    else:
        bump = "patch"

    return sections, bump, breaking_items


def _format_bullet(scope, desc):
    desc = desc.strip()
    desc = desc[0].upper() + desc[1:] if desc else desc
    if not desc.endswith((".", "!", "?")):
        desc += "."
    return f"**{scope}:** {desc}" if scope else desc


def pick_highlights(sections, limit=6):
    highlights = []
    for name in _SECTION_ORDER:
        highlights.extend(sections[name])
    highlights = highlights[:limit]
    return highlights or ["Internal maintenance and housekeeping updates."]


def bump_version(current, bump_type):
    major, minor, patch = (int(part) for part in current.split("."))
    if bump_type == "major":
        return f"{major + 1}.0.0"
    if bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def build_changelog_entry(version, sections):
    lines = [f"## [{version}] - {date.today().isoformat()}", ""]
    any_section = False
    for name in _SECTION_ORDER:
        items = sections[name]
        if not items:
            continue
        any_section = True
        lines.append(f"### {name}")
        lines.extend(f"- {item}" for item in items)
        lines.append("")
    if not any_section:
        lines.append("### Changed")
        lines.append("- Internal maintenance and housekeeping updates.")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def update_changelog(new_entry, dry_run):
    with open(CHANGELOG, encoding="utf-8") as f:
        content = f.read()

    marker = re.search(r"^## \[", content, re.MULTILINE)
    if marker:
        insert_at = marker.start()
        updated = content[:insert_at] + new_entry + "\n" + content[insert_at:]
    else:
        updated = content.rstrip() + "\n\n" + new_entry

    if not dry_run:
        with open(CHANGELOG, "w", encoding="utf-8", newline="\n") as f:
            f.write(updated)
    return updated


def update_package_json(content, current_version, new_version, dry_run):
    updated = content.replace(f'"version": "{current_version}"', f'"version": "{new_version}"', 1)
    if updated == content:
        raise RuntimeError("Failed to update version field in package.json")
    if not dry_run:
        with open(PACKAGE_JSON, "w", encoding="utf-8", newline="\n") as f:
            f.write(updated)
    return updated


_README_START = "<!-- RELEASE:START -->"
_README_END = "<!-- RELEASE:END -->"


def build_readme_section(version, sections):
    highlights = pick_highlights(sections)

    lines = [
        _README_START,
        f"## 🆕 Latest Release — v{version} ({date.today().isoformat()})",
        "",
    ]
    lines.extend(f"- {item}" for item in highlights)
    lines.append("")
    lines.append("See the full [CHANGELOG.md](CHANGELOG.md) for details.")
    lines.append(_README_END)
    return "\n".join(lines)


def update_readme(version, sections, dry_run):
    with open(README, encoding="utf-8") as f:
        content = f.read()

    section = build_readme_section(version, sections)

    if _README_START in content and _README_END in content:
        pattern = re.compile(re.escape(_README_START) + r".*?" + re.escape(_README_END), re.DOTALL)
        updated = pattern.sub(section, content, count=1)
    else:
        # First run: insert right after the badge block (before the first "---").
        hr_match = re.search(r"^---\s*$", content, re.MULTILINE)
        if hr_match:
            insert_at = hr_match.end()
            updated = content[:insert_at] + "\n\n" + section + "\n" + content[insert_at:]
        else:
            updated = content.rstrip() + "\n\n" + section + "\n"

    if not dry_run:
        with open(README, "w", encoding="utf-8", newline="\n") as f:
            f.write(updated)
    return updated


_REPO_URL_RE = re.compile(r'"repository":\s*\{[^}]*"url":\s*"([^"]+)"', re.DOTALL)


def get_repo_url(package_json_content):
    m = _REPO_URL_RE.search(package_json_content)
    if not m:
        return None
    return m.group(1).removesuffix(".git")


def _esc_yaml(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


_CATEGORY_JSON = """{
  "label": "Changelog",
  "position": 99,
  "link": {
    "type": "generated-index",
    "description": "Release notes for every published version of CPQ-BML."
  }
}
"""


def build_docusaurus_changelog_page(version, sections, breaking_items, repo_url):
    today = date.today().isoformat()
    highlights = pick_highlights(sections)
    plain_highlights = [re.sub(r"\*\*(.+?)\*\*", r"\1", h) for h in highlights]
    description = " ".join(plain_highlights)[:200].rstrip()

    tags = ["Changelog", "Release"]
    if breaking_items:
        tags.append("Breaking")

    lines = [
        "---",
        f"id: v{version}",
        f'title: "v{version}"',
        f'sidebar_label: "v{version} ({today})"',
        f'description: "{_esc_yaml(description)}"',
        f"tags: {tags}",
        f"slug: /changelog/{version}",
        "---",
        "",
        f"# v{version} <small>— {today}</small>",
        "",
        ":::tip Highlights",
    ]
    lines.extend(f"- {item}" for item in highlights)
    lines.append(":::")
    lines.append("")

    if breaking_items:
        lines.append(":::danger Breaking Changes")
        lines.extend(f"- {item}" for item in breaking_items)
        lines.append(":::")
        lines.append("")

    for name in _SECTION_ORDER:
        items = sections[name]
        if not items:
            continue
        lines.append(f"## {name}")
        lines.append("")
        lines.extend(f"- {item}" for item in items)
        lines.append("")

    lines.append("---")
    lines.append("")
    if repo_url:
        lines.append(f"Full commit-level detail: see [CHANGELOG.md]({repo_url}/blob/main/CHANGELOG.md).")
    else:
        lines.append("Full commit-level detail: see [CHANGELOG.md](../../../CHANGELOG.md).")

    return "\n".join(lines).rstrip() + "\n"


def update_docusaurus_changelog(version, sections, breaking_items, repo_url, dry_run):
    page_path = os.path.join(DOCS_CHANGELOG_DIR, f"{version}.md")
    category_path = os.path.join(DOCS_CHANGELOG_DIR, "_category_.json")
    page = build_docusaurus_changelog_page(version, sections, breaking_items, repo_url)

    if not dry_run:
        os.makedirs(DOCS_CHANGELOG_DIR, exist_ok=True)
        if not os.path.exists(category_path):
            with open(category_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(_CATEGORY_JSON)
        with open(page_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(page)
    return page_path, page


def run_build():
    """Run `yarn build` (falls back to `npm run build`), streaming output live.

    Raises RuntimeError on failure - callers should let the changelog/version
    updates stand either way, since those are already written to disk by the
    time this runs.
    """
    yarn = shutil.which("yarn")
    cmd = [yarn, "build"] if yarn else None
    if not cmd:
        npm = shutil.which("npm")
        if not npm:
            print("WARNING: neither 'yarn' nor 'npm' found on PATH - skipping build step.")
            return False
        cmd = [npm, "run", "build"]

    print(f"--- Running: {' '.join(cmd)} ---")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        raise RuntimeError(
            f"Build failed (exit code {result.returncode}). CHANGELOG.md/package.json/"
            f"README.md were already updated - fix the issue and re-run `{' '.join(cmd)}` directly."
        )
    return True


def main():
    raw_args = sys.argv[1:]
    dry_run = "--dry-run" in raw_args
    skip_build = "--skip-build" in raw_args
    args = [a for a in raw_args if a not in ("--dry-run", "--skip-build")]
    explicit_version = args[0] if args else None

    if explicit_version and not re.match(r"^\d+\.\d+\.\d+$", explicit_version):
        print(f"ERROR: '{explicit_version}' is not a valid semver version (expected x.y.z).")
        sys.exit(1)

    current_version, package_json_content = get_current_version()
    last_tag = get_last_tag()
    commits = get_commits(last_tag)

    if not commits:
        print(f"No commits since {last_tag or 'the beginning of history'} - nothing to release.")
        sys.exit(0)

    sections, bump_type, breaking_items = categorize(commits)
    new_version = explicit_version or bump_version(current_version, bump_type)
    repo_url = get_repo_url(package_json_content)

    print(f"Current version : {current_version}")
    print(f"Last tag        : {last_tag or '(none)'}")
    print(f"Commits found   : {len(commits)}")
    print(f"Bump type       : {'explicit' if explicit_version else bump_type}")
    print(f"New version     : {new_version}")
    print()

    entry = build_changelog_entry(new_version, sections)
    print("--- CHANGELOG.md entry -------------------------------------")
    print(entry)

    docs_page = build_docusaurus_changelog_page(new_version, sections, breaking_items, repo_url)
    docs_page_path = os.path.join(DOCS_CHANGELOG_DIR, f"{new_version}.md")
    print(f"--- app/knowledge/Changelog/{new_version}.md ------------------------")
    print(docs_page)

    update_changelog(entry, dry_run)
    update_package_json(package_json_content, current_version, new_version, dry_run)
    update_readme(new_version, sections, dry_run)
    update_docusaurus_changelog(new_version, sections, breaking_items, repo_url, dry_run)

    if dry_run:
        print("(dry run - no files were written)")
        return

    print(f"Updated CHANGELOG.md, package.json, README.md, and {os.path.relpath(docs_page_path, ROOT)} for v{new_version}.")
    print()

    built = False
    if skip_build:
        print("Skipping build (--skip-build).")
    else:
        built = run_build()

    print()
    print("Next steps:")
    if built:
        name_match = re.search(r'"name":\s*"([^"]+)"', package_json_content)
        pkg_name = name_match.group(1) if name_match else "extension"
        print(f"  # {pkg_name}-{new_version}.vsix has been built in {ROOT}")
    print(f'  git add CHANGELOG.md package.json README.md app/knowledge/Changelog')
    print(f'  git commit -m "chore: release v{new_version}"')
    print(f'  git tag v{new_version}')
    print(f'  git push origin main --tags')


if __name__ == "__main__":
    main()
