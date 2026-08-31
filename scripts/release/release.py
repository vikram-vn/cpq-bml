#!/usr/bin/env python3
"""
release.py - Semantic Versioning (MAJOR.MINOR.PATCH) & Release Automation for CPQ-BML

Automates version bumping, Keep a Changelog generation, package.json updates,
and .vsix extension packaging according to SemVer standards:

  MAJOR (X.0.0): Incompatible API or breaking architectural changes.
  MINOR (X.Y.0): Backward-compatible new features and language capabilities.
  PATCH (X.Y.Z): Backward-compatible bug fixes, performance optimizations, and maintenance.

Usage:
    python scripts/release/release.py [version] [options]
    yarn release [version] [options]
    npm run release -- [version] [options]

Options:
    --patch, -p       Force a PATCH version bump (e.g. 1.70.0 -> 1.70.1)
    --minor, -m       Force a MINOR version bump (e.g. 1.70.0 -> 1.71.0)
    --major, -M       Force a MAJOR version bump (e.g. 1.70.0 -> 2.0.0)
    --dry-run, -d     Preview version calculation & changelog entry without writing files
    --skip-build, -s  Update CHANGELOG.md and package.json but skip packaging .vsix
    --help, -h        Show this help message and exit

Examples:
    python scripts/release/release.py                # Auto-detects bump (patch/minor/major) from commits
    python scripts/release/release.py --patch        # Increments patch: 1.70.0 -> 1.70.1
    python scripts/release/release.py --minor        # Increments minor: 1.70.0 -> 1.71.0
    python scripts/release/release.py --major        # Increments major: 1.70.0 -> 2.0.0
    python scripts/release/release.py 1.70.5         # Sets explicit version 1.70.5
    python scripts/release/release.py --dry-run      # Preview without writing files
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from typing import Dict, List, Optional, Tuple, Any

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACKAGE_JSON = os.path.join(ROOT, "package.json")
CHANGELOG = os.path.join(ROOT, "CHANGELOG.md")
README = os.path.join(ROOT, "README.md")

RECORD_SEP = "\x1e"
FIELD_SEP = "\x1f"

# Section mappings for Keep a Changelog
_SECTION_MAP = {
    "feat": "Added",
    "feature": "Added",
    "add": "Added",
    "new": "Added",
    "implement": "Added",
    "fix": "Fixed",
    "bugfix": "Fixed",
    "hotfix": "Fixed",
    "patch": "Fixed",
    "resolve": "Fixed",
    "perf": "Changed",
    "performance": "Changed",
    "optimize": "Changed",
    "refactor": "Changed",
    "style": "Changed",
    "change": "Changed",
    "update": "Changed",
    "enhance": "Changed",
    "docs": "Documentation",
    "doc": "Documentation",
    "sec": "Security",
    "security": "Security",
}

_SKIP_TYPES = {"chore", "test", "ci", "build", "bench", "benchmark"}
_SECTION_ORDER = ["Added", "Fixed", "Changed", "Security", "Documentation"]

# Regexes
_CONVENTIONAL_COMMIT_RE = re.compile(r"^(?P<type>[a-zA-Z]+)(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<desc>.+)$")
_VERSION_RE = re.compile(r'"version":\s*"(\d+\.\d+\.\d+)"')


def run_git(*args: str) -> str:
    """Execute git command and return stdout string."""
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def get_current_version() -> Tuple[str, str]:
    """Read current version string and full text from package.json."""
    if not os.path.exists(PACKAGE_JSON):
        raise FileNotFoundError(f"package.json not found at {PACKAGE_JSON}")
    with open(PACKAGE_JSON, encoding="utf-8") as f:
        content = f.read()
    m = _VERSION_RE.search(content)
    if not m:
        raise RuntimeError('Could not find a valid "version": "x.y.z" field in package.json')
    return m.group(1), content


def get_last_tag() -> Optional[str]:
    """Find the most recent semantic version git tag."""
    result = subprocess.run(
        ["git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None


def get_commits(since_tag: Optional[str]) -> List[Dict[str, str]]:
    """Retrieve commits since the last tag."""
    commit_range = f"{since_tag}..HEAD" if since_tag else "HEAD"
    fmt = f"%H{FIELD_SEP}%s{FIELD_SEP}%b{RECORD_SEP}"
    try:
        raw = run_git("log", commit_range, "--no-merges", f"--pretty=format:{fmt}")
    except RuntimeError:
        # If tag doesn't exist in local repo, fetch full log
        raw = run_git("log", "-n", "30", "--no-merges", f"--pretty=format:{fmt}")

    commits = []
    for record in raw.split(RECORD_SEP):
        record = record.strip("\n")
        if not record.strip():
            continue
        parts = record.split(FIELD_SEP)
        if len(parts) != 3:
            continue
        commit_hash, subject, body = parts
        commits.append({
            "hash": commit_hash.strip(),
            "subject": subject.strip(),
            "body": body.strip()
        })
    return commits


def _format_bullet(scope: Optional[str], desc: str) -> str:
    """Format a bullet point with clean capitalization and punctuation."""
    desc = desc.strip()
    if not desc:
        return ""
    desc = desc[0].upper() + desc[1:]
    if not desc.endswith((".", "!", "?")):
        desc += "."
    return f"**{scope}:** {desc}" if scope else desc


def classify_commit(subject: str, body: str) -> Tuple[str, Optional[str], str, bool]:
    """
    Classify a commit message into (type, scope, clean_description, is_breaking).
    Supports Conventional Commits and natural language fallbacks.
    """
    is_breaking = False
    if "BREAKING CHANGE" in body or "BREAKING CHANGES" in body or "BREAKING:" in body:
        is_breaking = True

    m = _CONVENTIONAL_COMMIT_RE.match(subject)
    if m:
        ctype = m.group("type").lower()
        scope = m.group("scope")
        desc = m.group("desc").strip()
        if m.group("breaking"):
            is_breaking = True
        return ctype, scope, desc, is_breaking

    # Natural language heuristics fallback
    subject_lower = subject.lower().strip()
    words = subject_lower.split()
    first_word = words[0] if words else ""

    if any(k in subject_lower for k in ["breaking", "breaking change", "incompatible"]):
        is_breaking = True

    if first_word in ["feat", "feature", "add", "added", "new", "implement", "implemented", "introduce"]:
        return "feat", None, subject, is_breaking
    elif first_word in ["fix", "fixed", "bugfix", "patch", "resolve", "resolved", "correct"]:
        return "fix", None, subject, is_breaking
    elif first_word in ["perf", "optimize", "speed", "refactor", "style", "update", "enhance", "improve"]:
        return "perf", None, subject, is_breaking
    elif first_word in ["doc", "docs", "readme", "guide"]:
        return "docs", None, subject, is_breaking
    elif first_word in ["security", "sec", "auth", "token"]:
        return "security", None, subject, is_breaking
    elif first_word in ["chore", "test", "tests", "ci", "build", "bench", "benchmark"]:
        return "chore", None, subject, is_breaking

    return "change", None, subject, is_breaking


def categorize(commits: List[Dict[str, str]]) -> Tuple[Dict[str, List[str]], str, List[str]]:
    """
    Categorize commits into changelog sections and determine automatic SemVer bump type:
      - 'major': if breaking changes detected
      - 'minor': if any new features ('feat', 'add', 'new') detected
      - 'patch': if bug fixes, performance, refactor, docs, or chores detected
    """
    sections = {name: [] for name in _SECTION_ORDER}
    breaking_items = []
    has_feat = False
    has_breaking = False

    for commit in commits:
        ctype, scope, desc, breaking = classify_commit(commit["subject"], commit["body"])
        bullet = _format_bullet(scope, desc)

        if breaking:
            has_breaking = True
            breaking_items.append(bullet)
            sections["Changed"].append(f"⚠️ **BREAKING:** {bullet}")
            continue

        if ctype in ["feat", "feature", "add", "new", "implement"]:
            has_feat = True

        if ctype in _SKIP_TYPES:
            continue

        section = _SECTION_MAP.get(ctype, "Changed")
        if section not in sections:
            section = "Changed"

        if bullet and bullet not in sections[section]:
            sections[section].append(bullet)

    if has_breaking:
        bump = "major"
    elif has_feat:
        bump = "minor"
    else:
        bump = "patch"

    return sections, bump, breaking_items


def bump_version(current: str, bump_type: str) -> str:
    """
    Apply Semantic Versioning increment:
      - major: (X.Y.Z) -> (X+1).0.0
      - minor: (X.Y.Z) -> X.(Y+1).0
      - patch: (X.Y.Z) -> X.Y.(Z+1)
    """
    parts = [int(p) for p in current.split(".")]
    if len(parts) != 3:
        raise ValueError(f"Invalid semver version format: '{current}' (expected X.Y.Z)")

    major, minor, patch = parts
    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    else:
        raise ValueError(f"Unknown bump type: '{bump_type}'")


def build_changelog_entry(version: str, sections: Dict[str, List[str]]) -> str:
    """Generate a clean Keep a Changelog Markdown block."""
    lines = [f"## [{version}] - {date.today().isoformat()}", ""]
    any_section = False

    for name in _SECTION_ORDER:
        items = sections.get(name, [])
        if not items:
            continue
        any_section = True
        lines.append(f"### {name}")
        lines.append("")
        for item in items:
            lines.append(f"- {item}")
        lines.append("")

    if not any_section:
        lines.append("### Changed")
        lines.append("")
        lines.append("- Performance optimizations, benchmark fixtures, and stability enhancements.")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def update_changelog(new_entry: str, dry_run: bool) -> str:
    """Prepend the new entry to CHANGELOG.md, keeping up to 10 releases."""
    if not os.path.exists(CHANGELOG):
        header = "# Changelog\n\nAll notable changes to the \"CPQ-BML\" extension will be documented in this file.\n\nCheck [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.\n\n"
        content = header
    else:
        with open(CHANGELOG, encoding="utf-8") as f:
            content = f.read()

    marker = re.search(r"^## \[", content, re.MULTILINE)
    if marker:
        insert_at = marker.start()
        updated = content[:insert_at] + new_entry + "\n" + content[insert_at:]
    else:
        updated = content.rstrip() + "\n\n" + new_entry

    # Keep only up to 10 recent releases
    matches = list(re.finditer(r"^## \[", updated, re.MULTILINE))
    if len(matches) > 10:
        truncate_at = matches[10].start()
        updated = updated[:truncate_at].rstrip() + "\n"

    if not dry_run:
        with open(CHANGELOG, "w", encoding="utf-8", newline="\n") as f:
            f.write(updated)
    return updated


def update_package_json(content: str, current_version: str, new_version: str, dry_run: bool) -> str:
    """Update version property in package.json."""
    updated = re.sub(r'"version":\s*"[^"]+"', f'"version": "{new_version}"', content, count=1)
    if updated == content:
        raise RuntimeError("Failed to update version field in package.json")
    if not dry_run:
        with open(PACKAGE_JSON, "w", encoding="utf-8", newline="\n") as f:
            f.write(updated)
    return updated


def run_build() -> bool:
    """Run package build via npm/yarn."""
    yarn = shutil.which("yarn")
    cmd = [yarn, "build"] if yarn else None
    if not cmd:
        npm = shutil.which("npm")
        if not npm:
            print("WARNING: Neither 'yarn' nor 'npm' found on PATH - skipping .vsix build.")
            return False
        cmd = [npm, "run", "build"]

    print(f"\n--- Running: {' '.join(cmd)} ---")
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        raise RuntimeError(f"Build step failed with exit code {result.returncode}.")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="CPQ-BML Release Automation & SemVer Incrementer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("version", nargs="?", default=None, help="Explicit target version (e.g. 1.70.1)")
    parser.add_argument("--patch", "-p", action="store_true", help="Force a PATCH bump (e.g. 1.70.0 -> 1.70.1)")
    parser.add_argument("--minor", "-m", action="store_true", help="Force a MINOR bump (e.g. 1.70.0 -> 1.71.0)")
    parser.add_argument("--major", "-M", action="store_true", help="Force a MAJOR bump (e.g. 1.70.0 -> 2.0.0)")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Preview version calculation without writing files")
    parser.add_argument("--skip-build", "-s", action="store_true", help="Skip packaging the .vsix file")

    args = parser.parse_args()

    current_version, package_json_content = get_current_version()
    last_tag = get_last_tag()
    commits = get_commits(last_tag)

    sections, auto_bump_type, breaking_items = categorize(commits)

    # Determine bump type
    if args.version:
        if not re.match(r"^\d+\.\d+\.\d+$", args.version):
            print(f"ERROR: '{args.version}' is not a valid semver string (expected X.Y.Z).", file=sys.stderr)
            sys.exit(1)
        new_version = args.version
        effective_bump = "explicit"
    elif args.major:
        effective_bump = "major"
        new_version = bump_version(current_version, "major")
    elif args.minor:
        effective_bump = "minor"
        new_version = bump_version(current_version, "minor")
    elif args.patch:
        effective_bump = "patch"
        new_version = bump_version(current_version, "patch")
    else:
        effective_bump = auto_bump_type
        new_version = bump_version(current_version, auto_bump_type)

    print("=" * 60)
    print(" 🚀 CPQ-BML RELEASE ORCHESTRATOR")
    print("=" * 60)
    print(f"  Current Version : {current_version}")
    print(f"  Last Git Tag    : {last_tag or '(none)'}")
    print(f"  Commits Scanned : {len(commits)}")
    print(f"  Bump Applied    : {effective_bump.upper()} (SemVer: MAJOR.MINOR.PATCH)")
    print(f"  Target Version  : {new_version}")
    print("=" * 60)

    entry = build_changelog_entry(new_version, sections)
    print("\n--- Preview: CHANGELOG.md Entry ---")
    print(entry)

    if args.dry_run:
        print("\n🔍 [Dry Run Mode] No files were modified.")
        return

    update_changelog(entry, dry_run=False)
    update_package_json(package_json_content, current_version, new_version, dry_run=False)
    print(f"✅ Updated CHANGELOG.md and package.json to v{new_version}.")

    built = False
    if args.skip_build:
        print("⏩ Skipping .vsix build (--skip-build specified).")
    else:
        built = run_build()

    print("\n" + "=" * 60)
    print(" 🎉 Release Preparation Complete!")
    print("=" * 60)
    print("Next Git Steps:")
    print(f"  git add CHANGELOG.md package.json")
    print(f'  git commit -m "chore: release v{new_version}"')
    print(f"  git tag v{new_version}")
    print(f"  git push origin main --tags")
    print("=" * 60)


if __name__ == "__main__":
    main()
