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
  8. Runs `yarn build` (falls back to `npm run build`), which minifies
     extension.js/the settings webview and packages a .vsix via
     @vscode/vsce - using the version just written to package.json. Skipped
     entirely for --dry-run or --skip-build.

Nothing is committed, tagged, or pushed automatically - the script only
edits these files, builds the .vsix, and prints the suggested git commands
to run next.

Usage:
    python scripts/release/release.py [version] [--dry-run] [--skip-build]

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

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACKAGE_JSON = os.path.join(ROOT, "package.json")
CHANGELOG = os.path.join(ROOT, "CHANGELOG.md")
README = os.path.join(ROOT, "README.md")

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

    # Keep only up to 10 releases
    matches = list(re.finditer(r"^## \[", updated, re.MULTILINE))
    if len(matches) > 10:
        truncate_at = matches[10].start()
        updated = updated[:truncate_at].rstrip() + "\n"

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


_REPO_URL_RE = re.compile(r'"repository":\s*\{[^}]*"url":\s*"([^"]+)"', re.DOTALL)


def get_repo_url(package_json_content):
    m = _REPO_URL_RE.search(package_json_content)
    if not m:
        return None
    return m.group(1).removesuffix(".git")


def _esc_yaml(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')





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
            f"Build failed (exit code {result.returncode}). changes.md/package.json "
            f"were already updated - fix the issue and re-run `{' '.join(cmd)}` directly."
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
    changelog_content = update_changelog(entry, dry_run)
    print("--- CHANGELOG.md entry -------------------------------------")
    print(entry)

    update_package_json(package_json_content, current_version, new_version, dry_run)

    if dry_run:
        print("(dry run - no files were written)")
        return

    print(f"Updated CHANGELOG.md and package.json for v{new_version}.")
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
    print(f'  git add CHANGELOG.md package.json')
    print(f'  git commit -m "chore: release v{new_version}"')
    print(f'  git tag v{new_version}')
    print(f'  git push origin main --tags')


if __name__ == "__main__":
    main()
