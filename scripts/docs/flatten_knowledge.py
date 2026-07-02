import os
import re
import shutil

def rewrite_content(content):
    # Regex to find markdown links: [text](path)
    # Group 1: text, Group 2: path
    def replace_link(match):
        text = match.group(1)
        path = match.group(2)
        
        # Handle images
        if match.group(0).startswith('!'):
            # Convert any relative images path (e.g. ../images/foo.png) to images/foo.png
            if 'images/' in path:
                filename = path.split('images/')[-1]
                return f"![{text}](images/{filename})"
            return match.group(0)
            
        # Handle standard hyperlinks
        # If it points to a local .md file, flatten it to ./FileName.md
        if path.endswith('.md') or '.md#' in path:
            filename = os.path.basename(path)
            return f"[{text}](./{filename})"
            
        return match.group(0)

    # We match ![alt](path) first, then [text](path)
    # To handle both correctly, we can use a regex that matches either
    pattern = r'!?\[([^\]]*?)\]\(([^)]*?)\)'
    new_content = re.sub(pattern, replace_link, content)
    return new_content

def main():
    root_dir = r"c:\Users\Vikram-N\Downloads\cpq-bml"
    bml_dir = os.path.join(root_dir, "app", "knowledge", "BML")
    
    # 1. Traverse all .md files recursively
    md_files = []
    for root, dirs, files in os.walk(bml_dir):
        # Skip the images directory itself
        if "images" in root:
            continue
        for file in files:
            if file.endswith('.md'):
                md_files.append(os.path.join(root, file))
                
    print(f"Found {len(md_files)} markdown files.")
    
    # 2. Process and rewrite each file
    processed_files = []
    for filepath in md_files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = rewrite_content(content)
        
        # Determine target flat path
        filename = os.path.basename(filepath)
        target_path = os.path.join(bml_dir, filename)
        
        # Write to the flat directory
        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print(f"Flattened and saved: {filename}")
        processed_files.append(filepath)
        
    # 3. Clean up the original nested directories (only if they are subdirectories, not BML root)
    for filepath in processed_files:
        parent_dir = os.path.dirname(filepath)
        if parent_dir != bml_dir:
            # It is a nested subdirectory (e.g. FunctionEditor or FunctionsScripts)
            if os.path.exists(filepath):
                os.remove(filepath)
                
    # Remove empty subdirectories
    subdirs = ["FunctionEditor", "FunctionsScripts"]
    for subdir in subdirs:
        subdir_path = os.path.join(bml_dir, subdir)
        if os.path.exists(subdir_path):
            shutil.rmtree(subdir_path)
            print(f"Removed subdirectory: {subdir}")

if __name__ == '__main__':
    main()
