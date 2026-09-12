"""
generate_sidebar_svg.py
Generates app/icons/sidebar/sidebar.svg and app/icons/sidebar/sidebar-solid.svg.

Follows VS Code product icon guidelines:
- 24x24 viewBox
- Uses `fill="currentColor"` for dynamic dark/light theme matching
- Crisp 1.5px stroke weight matching native Codicons

Run from the project root:
    python scripts/generate/generate_sidebar_svg.py
"""
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'sidebar')
OUTPUT_SIDEBAR_SVG = os.path.join(OUTPUT_DIR, 'sidebar.svg')
OUTPUT_SOLID_SVG = os.path.join(OUTPUT_DIR, 'sidebar-solid.svg')

# Option 1: Outline Cloud + Bold Center B (Codicon style)
SVG_OUTLINE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <!-- Cloud outline (VS Code Codicon standard 1.5px stroke weight) -->
  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18.5H6c-2.48 0-4.5-2.02-4.5-4.5 0-2.33 1.77-4.24 4.09-4.47l.86-.09.39-.77C7.8 6.56 9.77 5.5 12 5.5c2.97 0 5.48 2.15 5.96 5.08l.24 1.48 1.48.11c1.84.14 3.32 1.68 3.32 3.53 0 1.93-1.57 3.5-3.5 3.5z"/>
  <!-- Bold B in center -->
  <path fill-rule="evenodd" d="M9.5 9h3.7c1.3 0 2 0.6 2 1.8 0 0.8-0.4 1.4-1.2 1.7 1 0.3 1.5 1 1.5 2 0 1.3-0.9 2.5-2.3 2.5H9.5V9zm1.8 1.5v1.8h1.5c0.7 0 1-0.3 1-0.9s-0.3-0.9-1-0.9h-1.5zm0 3.2v1.8h1.7c0.7 0 1-0.4 1-1s-0.3-0.8-1-0.8h-1.7z"/>
</svg>
'''

# Option 2: Solid Cloud with Cutout B (Negative Space)
SVG_SOLID = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
  <!-- Solid Cloud with cutout B (negative space) -->
  <path fill-rule="evenodd" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z M9 8.5h4.2c1.5 0 2.3 0.7 2.3 2 0 0.9-0.5 1.6-1.4 1.9 1.1 0.3 1.7 1.1 1.7 2.2 0 1.5-1 2.9-2.6 2.9H9V8.5zm2 1.8v2h2c0.8 0 1.2-0.4 1.2-1s-0.4-1-1.2-1H11zm0 3.6v2.2h2.2c0.8 0 1.3-0.4 1.3-1.1s-0.5-1.1-1.3-1.1H11z"/>
</svg>
'''

def main():
    os.makedirs(os.path.dirname(OUTPUT_SIDEBAR_SVG), exist_ok=True)
    with open(OUTPUT_SIDEBAR_SVG, 'w', encoding='utf-8') as f:
        f.write(SVG_OUTLINE)
    print(f"Generated: {OUTPUT_SIDEBAR_SVG}")

    with open(OUTPUT_SOLID_SVG, 'w', encoding='utf-8') as f:
        f.write(SVG_SOLID)
    print(f"Generated: {OUTPUT_SOLID_SVG}")

if __name__ == '__main__':
    main()
