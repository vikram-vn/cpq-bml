"""
generate_cloud_icons.py
Generates the dedicated Cloud Explorer and view action icons in app/icons/cloud/:
- refresh.svg         (Refresh cloud functions / datatables / transactions)
- search.svg          (Search cloud explorer)
- filter.svg          (Filter explorer functions)
- clear-filter.svg    (Clear explorer active filter)
- sync.svg            (Sync cloud BML definitions)
- pull.svg            (Pull cloud function to workspace)
- diff.svg            (Diff function against cloud server)
- switch-process.svg  (Switch active commerce process / document)
- query.svg           (Query datatable in BMQL live console)
- export-csv.svg      (Export datatable as CSV)
- inspect-tx.svg      (Inspect recent transaction JSON)
- debug-tx.svg        (Debug current BML on transaction)
- copy-id.svg         (Copy transaction ID to clipboard)
- task-details.svg    (View deployment task details)

Fully self-contained with no external dependencies beyond Python standard library.
All icons styled with currentColor for seamless theme integration.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLOUD_ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'cloud')

CLOUD_ICONS = {
  "refresh.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M13.5 8c0 3.038-2.462 5.5-5.5 5.5-2.228 0-4.149-1.32-5.02-3.21m-0.48-2.29C2.5 4.962 4.962 2.5 8 2.5c2.228 0 4.149 1.32 5.02 3.21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M14 2.5v3.5h-3.5M2 13.5V10h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "search.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
  <line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>
""",

  "filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M1.5 2.5h13l-5 6v5.5l-3-1.5v-4l-5-6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
</svg>
""",

  "clear-filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M1.5 2.5h13l-5 6v5.5l-3-1.5v-4l-5-6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
  <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="15" y1="11" x2="11" y2="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "sync.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M2.5 8a5.5 5.5 0 0 1 9.39-3.89l1.61-1.61v4.5H9l1.83-1.83A3.5 3.5 0 0 0 4.5 8h-2zm11 0a5.5 5.5 0 0 1-9.39 3.89l-1.61 1.61v-4.5H7l-1.83 1.83A3.5 3.5 0 0 0 11.5 8h2z"/>
</svg>
""",

  "pull.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M12.5 7.2C12.5 4.5 10.3 2.3 7.6 2.3C5.4 2.3 3.5 3.7 2.8 5.8C1.2 6.3 0 7.8 0 9.6C0 11.9 1.8 13.8 4.1 13.8H12.3C14.3 13.8 16 12.2 16 10.2C16 8.5 14.6 7.4 12.5 7.2Z" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <path d="M8 5.5v5.5m0 0L5.5 8.5M8 11l2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "diff.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="1.5" y="2" width="5.5" height="12" rx="1.2" stroke="currentColor" stroke-width="1.2"/>
  <rect x="9" y="2" width="5.5" height="12" rx="1.2" stroke="currentColor" stroke-width="1.2"/>
  <line x1="3.5" y1="5.5" x2="5" y2="5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="3.5" y1="8" x2="5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="3.5" y1="10.5" x2="5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11" y1="5.5" x2="12.5" y2="5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11" y1="8" x2="12.5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11" y1="10.5" x2="12.5" y2="10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "switch-process.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M3.5 5h8.5m0 0L9.5 2.5M12 5l-2.5 2.5M12.5 11H4m0 0l2.5-2.5M4 11l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "query.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M4.5 2.5l8.5 5.5-8.5 5.5V2.5z"/>
</svg>
""",

  "export-csv.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" stroke-width="1.2"/>
  <path d="M8 7v5m0 0l-2-2m2 2l2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "inspect-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M3 1.5h6.5l3.5 3.5V14.5H3V1.5z" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <path d="M6 6.5c-.8 0-1.2.4-1.2 1.2 0 .4-.4.8-.8.8.4 0 .8.4.8.8 0 .8.4 1.2 1.2 1.2M10 6.5c.8 0 1.2.4 1.2 1.2 0 .4.4.8.8.8-.4 0-.8.4-.8.8 0 .8-.4 1.2-1.2 1.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "debug-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <circle cx="8" cy="3.5" r="1.8"/>
  <path d="M4 6.5c0 2.2 1.8 4 4 4s4-1.8 4-4H4z"/>
  <line x1="2" y1="4.5" x2="4.5" y2="6.5" stroke="currentColor" stroke-width="1.2"/>
  <line x1="14" y1="4.5" x2="11.5" y2="6.5" stroke="currentColor" stroke-width="1.2"/>
  <line x1="1.5" y1="7.5" x2="4" y2="7.5" stroke="currentColor" stroke-width="1.2"/>
  <line x1="14.5" y1="7.5" x2="12" y2="7.5" stroke="currentColor" stroke-width="1.2"/>
  <path d="M10 9.5l4.5 3-4.5 3v-6z"/>
</svg>
""",

  "copy-id.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="4.5" y="4.5" width="9" height="10" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
  <path d="M3.5 11.5H2.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.2" fill="none"/>
</svg>
""",

  "task-details.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3" fill="none"/>
  <line x1="8" y1="7" x2="8" y2="11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="8" cy="4.8" r="0.9" fill="currentColor"/>
</svg>
"""
}

def main():
    os.makedirs(CLOUD_ICONS_DIR, exist_ok=True)
    for filename, content in CLOUD_ICONS.items():
        filepath = os.path.join(CLOUD_ICONS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated: app/icons/cloud/{filename}")
    print(f"All {len(CLOUD_ICONS)} cloud icons generated successfully.")

if __name__ == '__main__':
    main()
