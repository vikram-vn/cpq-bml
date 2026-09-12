"""
generate_views_svg.py
Generates vibrant, colorful 24x24 VS Code icons for each sidebar view in app/icons/views/:
- app/icons/views/datatables.svg     (Vibrant emerald structured grid table)
- app/icons/views/transactions.svg   (Vibrant azure quote document with gold clock badge)
- app/icons/views/deployment.svg     (Vibrant orange/crimson rocket with cyan flame)
- app/icons/views/util-libraries.svg (Vibrant indigo, cyan & amber library books)
- app/icons/views/commerce.svg       (Vibrant orange commerce cart with document badge)
- app/icons/views/config.svg         (Vibrant cyan family tree with emerald models)
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VIEWS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'views')

def generate_datatables_svg():
    """24x24 Data Tables icon: vibrant emerald grid table with header and columns."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="vDtBorder" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="vDtHeader" x1="3" y1="4" x2="21" y2="9" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect x="3" y="4" width="18" height="5" rx="1.5" fill="url(#vDtHeader)"/>
  <rect x="3" y="4" width="18" height="16" rx="2" stroke="url(#vDtBorder)" stroke-width="1.6"/>
  <line x1="3" y1="9" x2="21" y2="9" stroke="#34d399" stroke-width="1.4"/>
  <line x1="3" y1="15" x2="21" y2="15" stroke="#059669" stroke-width="1.2" opacity="0.6"/>
  <line x1="9" y1="9" x2="9" y2="20" stroke="#059669" stroke-width="1.2" opacity="0.6"/>
  <line x1="15" y1="9" x2="15" y2="20" stroke="#059669" stroke-width="1.2" opacity="0.6"/>
  <circle cx="6" cy="6.5" r="1.2" fill="#ffffff"/>
  <circle cx="12" cy="6.5" r="1.2" fill="#ffffff"/>
  <circle cx="18" cy="6.5" r="1.2" fill="#ffffff"/>
</svg>'''

def generate_transactions_svg():
    """24x24 Recent Transactions / Quotes icon: vibrant azure document with gold clock badge."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="vTxDoc" x1="5" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="vTxClock" x1="13" y1="13" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <path d="M5 4C5 3.44772 5.44772 3 6 3H13.5L18 7.5V12M5 4V20C5 20.5523 5.44772 21 6 21H12" stroke="url(#vTxDoc)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13 3V8H18" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8" y1="11" x2="11" y2="11" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="8" y1="15" x2="11" y2="15" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="17.5" cy="17.5" r="4.25" fill="#0f172a" stroke="url(#vTxClock)" stroke-width="1.6"/>
  <path d="M17.5 15.5V17.5H19.5" stroke="#fde047" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

def generate_deployment_svg():
    """24x24 Deployment Center & Task Monitor icon: vibrant orange rocket with cyan flame."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="vRktBody" x1="8" y1="2" x2="16" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/><stop offset="50%" stop-color="#ea580c"/><stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="vRktFlame" x1="10" y1="15" x2="14" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <path d="M12 2.5C9.5 5 8.5 9 8.5 13.5H15.5C15.5 9 14.5 5 12 2.5Z" fill="url(#vRktBody)" stroke="#ea580c" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M8.5 11.5L5 14V17.5L8.5 15.5" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M15.5 11.5L19 14V17.5L15.5 15.5" fill="#ea580c" stroke="#c2410c" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="12" cy="8.5" r="1.6" fill="#ffffff"/>
  <path d="M10 15C10.5 17 11.5 19 12 21.5C12.5 19 13.5 17 14 15" stroke="url(#vRktFlame)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

def generate_util_libraries_svg():
    """24x24 Util Libraries icon: vibrant indigo, cyan & amber library books."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="vBk1" x1="4" y1="4" x2="9" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="vBk2" x1="7" y1="4" x2="14" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="vBk3" x1="15" y1="5" x2="20" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <path d="M4 19.5V5.5C4 4.67157 4.67157 4 5.5 4H7.5C8.32843 4 9 4.67157 9 5.5V19.5" fill="url(#vBk1)" stroke="#6366f1" stroke-width="1.4"/>
  <line x1="4" y1="8" x2="9" y2="8" stroke="#ffffff" stroke-width="1.2"/>
  <path d="M10.5 4.5L14 5.5L11 19.5L7.5 18.5" fill="url(#vBk2)" stroke="#0284c7" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M15 19.5V7C15 6.17157 15.6716 5.5 16.5 5.5H18.5C19.3284 5.5 20 6.17157 20 7V19.5" fill="url(#vBk3)" stroke="#b45309" stroke-width="1.4"/>
  <line x1="15" y1="10" x2="20" y2="10" stroke="#ffffff" stroke-width="1.2"/>
  <line x1="2.5" y1="20" x2="21.5" y2="20" stroke="#818cf8" stroke-width="1.6" stroke-linecap="round"/>
</svg>'''

def generate_commerce_svg():
    """24x24 Commerce icon: vibrant orange shopping cart with cyan item badge."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="vCart" x1="3" y1="4" x2="20" y2="18" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <path d="M3 4H5.5L8 14.5H18L20.5 6.5H6.5" stroke="url(#vCart)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="9" cy="18.5" r="1.6" fill="#ea580c"/>
  <circle cx="17" cy="18.5" r="1.6" fill="#ea580c"/>
  <path d="M11 8.5H15M11 11.5H14" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
</svg>'''

def generate_config_svg():
    """24x24 Configuration / Product Families icon: vibrant cyan family tree with emerald models."""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="vCfgRoot" x1="9" y1="3" x2="15" y2="8" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="vCfgNode" x1="3" y1="15" x2="9" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect x="9" y="3" width="6" height="5" rx="1.2" fill="url(#vCfgRoot)" stroke="#7dd3fc" stroke-width="1.3"/>
  <path d="M12 8V12M12 12H6V15M12 12H18V15" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="3" y="15" width="6" height="5" rx="1.2" fill="url(#vCfgNode)" stroke="#6ee7b7" stroke-width="1.3"/>
  <rect x="15" y="15" width="6" height="5" rx="1.2" fill="url(#vCfgNode)" stroke="#6ee7b7" stroke-width="1.3"/>
</svg>'''

def main():
    os.makedirs(VIEWS_DIR, exist_ok=True)
    
    view_files = {
        'util-libraries.svg': generate_util_libraries_svg(),
        'commerce.svg': generate_commerce_svg(),
        'config.svg': generate_config_svg(),
        'datatables.svg': generate_datatables_svg(),
        'transactions.svg': generate_transactions_svg(),
        'deployment.svg': generate_deployment_svg()
    }
    
    for filename, content in view_files.items():
        filepath = os.path.join(VIEWS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated: app/icons/views/{filename}")

if __name__ == '__main__':
    main()
