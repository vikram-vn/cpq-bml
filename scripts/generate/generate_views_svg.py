"""
generate_views_svg.py
Generates 24x24 monochrome VS Code icons for each sidebar view:
- app/icons/datatables.svg   (CPQ Data Tables view)
- app/icons/transactions.svg (Recent Transactions / Quotes view)
- app/icons/deployment.svg   (Deployment Center & Task Monitor view)
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons')

def generate_datatables_svg():
    """24x24 Data Tables icon: structured grid table with header and columns."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <!-- Table Outer Border -->
  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
  <!-- Header Divider -->
  <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/>
  <!-- Row Divider -->
  <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" stroke-width="1.5"/>
  <!-- Column 1 Divider -->
  <line x1="9" y1="9" x2="9" y2="20" stroke="currentColor" stroke-width="1.5"/>
  <!-- Column 2 Divider -->
  <line x1="15" y1="9" x2="15" y2="20" stroke="currentColor" stroke-width="1.5"/>
  <!-- Header Indicators -->
  <circle cx="6" cy="6.5" r="1" fill="currentColor"/>
  <circle cx="12" cy="6.5" r="1" fill="currentColor"/>
  <circle cx="18" cy="6.5" r="1" fill="currentColor"/>
</svg>
'''

def generate_transactions_svg():
    """24x24 Recent Transactions / Quotes icon: document quote with clock / history badge."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <!-- Document Outline -->
  <path d="M5 4C5 3.44772 5.44772 3 6 3H13.5L18 7.5V12M5 4V20C5 20.5523 5.44772 21 6 21H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Corner Fold -->
  <path d="M13 3V8H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Document Lines -->
  <line x1="8" y1="11" x2="11" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="8" y1="15" x2="11" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- History / Clock Badge in Bottom-Right -->
  <circle cx="17.5" cy="17.5" r="4.25" stroke="currentColor" stroke-width="1.5"/>
  <path d="M17.5 15.5V17.5H19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''

def generate_deployment_svg():
    """24x24 Deployment Center & Task Monitor icon: launch rocket with telemetry."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <!-- Rocket Body -->
  <path d="M12 2.5C9.5 5 8.5 9 8.5 13.5H15.5C15.5 9 14.5 5 12 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Left Fin -->
  <path d="M8.5 11.5L5 14V17.5L8.5 15.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Right Fin -->
  <path d="M15.5 11.5L19 14V17.5L15.5 15.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Porthole Window -->
  <circle cx="12" cy="8.5" r="1.5" fill="currentColor"/>
  <!-- Exhaust Flame -->
  <path d="M10 15C10.5 17 11.5 19 12 21.5C12.5 19 13.5 17 14 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''

def generate_util_libraries_svg():
    """24x24 Util Libraries icon: clean library books with function symbol."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <!-- Book 1 -->
  <path d="M4 19.5V5.5C4 4.67157 4.67157 4 5.5 4H7.5C8.32843 4 9 4.67157 9 5.5V19.5" stroke="currentColor" stroke-width="1.5"/>
  <line x1="4" y1="8" x2="9" y2="8" stroke="currentColor" stroke-width="1.5"/>
  <!-- Book 2 (slanted) -->
  <path d="M10.5 4.5L14 5.5L11 19.5L7.5 18.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Book 3 -->
  <path d="M15 19.5V7C15 6.17157 15.6716 5.5 16.5 5.5H18.5C19.3284 5.5 20 6.17157 20 7V19.5" stroke="currentColor" stroke-width="1.5"/>
  <line x1="15" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="1.5"/>
  <!-- Shelf Base -->
  <line x1="2.5" y1="20" x2="21.5" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
'''

def generate_commerce_svg():
    """24x24 Commerce icon: shopping cart with document / pipeline badge."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <!-- Cart Handle & Basket -->
  <path d="M3 4H5.5L8 14.5H18L20.5 6.5H6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Wheels -->
  <circle cx="9" cy="18.5" r="1.5" fill="currentColor"/>
  <circle cx="17" cy="18.5" r="1.5" fill="currentColor"/>
  <!-- Document / Tag Inside Cart -->
  <path d="M11 8.5H15M11 11.5H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
'''

def generate_config_svg():
    """24x24 Configuration / Product Families icon: hierarchy tree with product models."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <!-- Root Family Node -->
  <rect x="9" y="3" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
  <!-- Branch lines -->
  <path d="M12 8V12M12 12H6V15M12 12H18V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Left Model Node -->
  <rect x="3" y="15" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
  <!-- Right Model Node -->
  <rect x="15" y="15" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
</svg>
'''

def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    
    files = {
        'util-libraries.svg': generate_util_libraries_svg(),
        'commerce.svg': generate_commerce_svg(),
        'config.svg': generate_config_svg(),
        'datatables.svg': generate_datatables_svg(),
        'transactions.svg': generate_transactions_svg(),
        'deployment.svg': generate_deployment_svg()
    }
    
    for filename, content in files.items():
        filepath = os.path.join(ICONS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated: app/icons/{filename}")

if __name__ == '__main__':
    main()

