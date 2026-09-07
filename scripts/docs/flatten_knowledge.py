#!/usr/bin/env python3
"""
flatten_knowledge.py

Flattens nested markdown documentation trees into a single flat directory,
normalizes markdown internal links, and dynamically cleans up nested subdirectories.
"""

import os
import re
import shutil
import argparse

def rewrite_content(content):
    """Rewrites image paths and internal markdown links for a flattened directory."""
    def replace_link(match):
        full_match = match.group(0)
        text = match.group(1)
        path = match.group(2)
        
        # Handle images
        if full_match.startswith('!'):
            if 'images/' in path:
                filename = path.split('images/')[-1]
                return f"![{text}](images/{filename})"
            return full_match
            
        # Handle standard hyperlinks pointing to local .md files
        if '.md' in path and not (path.startswith('http://') or path.startswith('https://')):
            # Separate anchor if present
            anchor = ""
            base_path = path
            if '#' in path:
                base_path, anchor = path.split('#', 1)
                anchor = f"#{anchor}"

            if base_path.endswith('.md'):
                filename = os.path.basename(base_path)
                return f"[{text}](./{filename}{anchor})"
            
        return full_match

    # Matches ![alt](path) or [text](path)
    pattern = r'!?\[([^\]]*?)\]\(([^)]*?)\)'
    return re.sub(pattern, replace_link, content)

def flatten_directory(bml_dir, dry_run=False):
    """Recursively flattens markdown files in bml_dir and cleans up empty subdirectories."""
    if not os.path.exists(bml_dir):
        print(f"Directory not found: {bml_dir}")
        return

    md_files = []
    for root, dirs, files in os.walk(bml_dir):
        # Skip the images directory itself
        if "images" in root:
            continue
        for file in files:
            if file.endswith('.md'):
                md_files.append(os.path.join(root, file))
                
    print(f"Found {len(md_files)} markdown files in {bml_dir}.")
    
    processed_files = []
    for filepath in md_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = rewrite_content(content)
        filename = os.path.basename(filepath)
        target_path = os.path.join(bml_dir, filename)
        
        if dry_run:
            print(f"[Dry Run] Would flatten: {filepath} -> {target_path}")
        else:
            with open(target_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Flattened and saved: {filename}")
        
        processed_files.append(filepath)
        
    if dry_run:
        return

    # Clean up original files in subdirectories
    for filepath in processed_files:
        parent_dir = os.path.dirname(filepath)
        if parent_dir != bml_dir and os.path.exists(filepath):
            os.remove(filepath)
                
    # Bottom-up cleanup of all empty subdirectories (except images)
    for root, dirs, files in os.walk(bml_dir, topdown=False):
        if root == bml_dir or "images" in root:
            continue
        try:
            if not os.listdir(root):
                os.rmdir(root)
                rel_path = os.path.relpath(root, bml_dir)
                print(f"Removed empty directory: {rel_path}")
        except Exception as e:
            print(f"Notice: Could not remove {root}: {e}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
    
    # Default to official knowledge/BML if it exists, otherwise scratch/knowledge/BML
    default_dir = os.path.join(root_dir, "knowledge", "BML")
    if not os.path.exists(default_dir):
        default_dir = os.path.join(root_dir, "scratch", "knowledge", "BML")

    parser = argparse.ArgumentParser(description="Flatten nested markdown knowledge directories.")
    parser.add_argument(
        "--target-dir", "-d",
        default=default_dir,
        help=f"Target directory to flatten (default: {default_dir})"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate the flattening without writing or deleting files"
    )

    args = parser.parse_args()
    flatten_directory(os.path.abspath(args.target_dir), dry_run=args.dry_run)

if __name__ == '__main__':
    main()
