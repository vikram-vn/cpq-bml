"""
generate_cloud_icons.py
Generates the 14 clean, theme-adaptive greyscale outline Cloud Explorer icons in app/icons/cloud/:
- Simple outline style (fill="none", 1.2px stroke)
- Non-solid stroke rendering (no heavy solid blocks)
- Exact VS Code theme parity:
    app/icons/cloud/dark/   -> #C5C5C5 (Dark Theme, matches native VS Code UI)
    app/icons/cloud/light/  -> #424242 (Light Theme, matches native VS Code UI)
    app/icons/cloud/        -> Theme-adaptive fallback
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLOUD_ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'cloud')
DARK_DIR = os.path.join(CLOUD_ICONS_DIR, 'dark')
LIGHT_DIR = os.path.join(CLOUD_ICONS_DIR, 'light')

ICONS_DEF = {
  "refresh.svg": """
  <path d="M13.5 6A5.5 5.5 0 0 0 3 5.5M3 2v3.5H6.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2.5 10a5.5 5.5 0 0 0 10.5.5M13 14v-3.5H9.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>""",

  "pull.svg": """
  <path d="M12.5 7.2C12.5 4.5 10.3 2.3 7.6 2.3C5.4 2.3 3.5 3.7 2.8 5.8C1.2 6.3 0 7.8 0 9.6C0 11.9 1.8 13.8 4.1 13.8H12.3C14.3 13.8 16 12.2 16 10.2C16 8.5 14.6 7.4 12.5 7.2Z" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 5.5v5.5m0 0L5.5 8.5M8 11l2.5-2.5" stroke="{stroke}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>""",

  "diff.svg": """
  <rect x="1.5" y="2.5" width="5" height="11" rx="1" stroke="{stroke}" stroke-width="1.2"/>
  <rect x="9.5" y="2.5" width="5" height="11" rx="1" stroke="{stroke}" stroke-width="1.2"/>
  <line x1="3.5" y1="5.5" x2="5" y2="5.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="3.5" y1="8" x2="5" y2="8" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11.5" y1="5.5" x2="13" y2="5.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11.5" y1="8" x2="13" y2="8" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>""",

  "sync.svg": """
  <path d="M13.5 5A5.5 5.5 0 0 0 3.5 3L2 4.5M2 2v2.5h2.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2.5 11a5.5 5.5 0 0 0 10 2l1.5-1.5M14 14v-2.5h-2.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>""",

  "switch-process.svg": """
  <path d="M10.5 2.5l3 3-3 3M13.5 5.5H2.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.5 13.5l-3-3 3-3M2.5 10.5h11" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>""",

  "query.svg": """
  <ellipse cx="7.5" cy="3.5" rx="5.5" ry="2" stroke="{stroke}" stroke-width="1.2"/>
  <path d="M2 3.5v7c0 1.1 2.5 2 5.5 2 .7 0 1.4-.05 2-.15" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M13 3.5V7" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M2 7c0 1.1 2.5 2 5.5 2 .7 0 1.4-.05 2-.15" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="11.5" cy="11.5" r="2.5" stroke="{stroke}" stroke-width="1.2"/>
  <line x1="13.3" y1="13.3" x2="15" y2="15" stroke="{stroke}" stroke-width="1.3" stroke-linecap="round"/>""",

  "export-csv.svg": """
  <path d="M9 1.5H3.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 1.5L13.5 6V9" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 1.5V6h4.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 11v4m0 0l-1.5-1.5m1.5 1.5l1.5-1.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="4.5" y1="6" x2="7" y2="6" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.5" y1="8.5" x2="8" y2="8.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>""",

  "search.svg": """
  <circle cx="6.5" cy="6.5" r="4.5" stroke="{stroke}" stroke-width="1.2"/>
  <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="{stroke}" stroke-width="1.3" stroke-linecap="round"/>""",

  "filter.svg": """
  <path d="M1.5 2.5h13l-5 6v5l-3-1.5v-3.5l-5-6z" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>""",

  "clear-filter.svg": """
  <path d="M1.5 2.5h13l-5 6v4.5l-2-1V8.5l-6-6z" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" stroke="{stroke}" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="14.5" y1="10.5" x2="10.5" y2="14.5" stroke="{stroke}" stroke-width="1.3" stroke-linecap="round"/>""",

  "inspect-tx.svg": """
  <path d="M8 1.5H3.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 1.5L12.5 6v2" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 1.5V6h4.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="11.5" cy="11.5" r="2.5" stroke="{stroke}" stroke-width="1.2"/>
  <line x1="13.3" y1="13.3" x2="15" y2="15" stroke="{stroke}" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4.5" y1="6" x2="6.5" y2="6" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.5" y1="8.5" x2="7.5" y2="8.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>""",

  "debug-tx.svg": """
  <ellipse cx="8" cy="9" rx="3.5" ry="4.5" stroke="{stroke}" stroke-width="1.2"/>
  <path d="M6 4.5a2 2 0 0 1 4 0v1H6v-1z" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8" y1="6" x2="8" y2="13.5" stroke="{stroke}" stroke-width="1.2"/>
  <line x1="6.5" y1="2.5" x2="5" y2="1" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="9.5" y1="2.5" x2="11" y2="1" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.5" y1="7.5" x2="2" y2="7" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11.5" y1="7.5" x2="14" y2="7" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.5" y1="10.5" x2="2" y2="11" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11.5" y1="10.5" x2="14" y2="11" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>""",

  "copy-id.svg": """
  <rect x="4.5" y="1.5" width="9" height="10" rx="1" stroke="{stroke}" stroke-width="1.2"/>
  <path d="M2.5 4.5v9a1 1 0 0 0 1 1h8" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="7" y1="4.5" x2="11" y2="4.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="7" y1="7" x2="10" y2="7" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>""",

  "task-details.svg": """
  <rect x="2.5" y="3.5" width="11" height="11" rx="1" stroke="{stroke}" stroke-width="1.2"/>
  <path d="M6 2h4a.5.5 0 0 1 .5.5v1H5.5v-1A.5.5 0 0 1 6 2z" stroke="{stroke}" stroke-width="1.2"/>
  <path d="M5.5 7l1.5 1.5 3-3" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="5.5" y1="11.5" x2="10.5" y2="11.5" stroke="{stroke}" stroke-width="1.2" stroke-linecap="round"/>"""
}

DARK_COLOR = '#C5C5C5'
LIGHT_COLOR = '#424242'

def main():
    os.makedirs(CLOUD_ICONS_DIR, exist_ok=True)

    for name, path_template in ICONS_DEF.items():
        root_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <style>
    path, line, circle, rect, ellipse {{ stroke: {DARK_COLOR}; }}
    @media (prefers-color-scheme: light) {{
      path, line, circle, rect, ellipse {{ stroke: {LIGHT_COLOR}; }}
    }}
  </style>{path_template.format(stroke=DARK_COLOR)}
</svg>
'''
        with open(os.path.join(CLOUD_ICONS_DIR, name), 'w', encoding='utf-8') as f:
            f.write(root_content)
        print(f'  [OK] {name}')

    print(f'\\nSuccessfully generated {len(ICONS_DEF)} outline cloud icons in app/icons/cloud/.')

if __name__ == '__main__':
    main()
