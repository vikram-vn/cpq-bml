"""
generate_editor_icons.py
Generates the 22 dedicated Editor Toolbar & Command icons in app/icons/editor/.
All files strictly under 500 lines.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EDITOR_ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'editor')

EDITOR_ICONS = {
  # Clean, cute, friendly AI assistant robot with solid white eyes and gold sparkle
  "ai-setup.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="aiGrad" x1="2" y1="3.5" x2="14" y2="14.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="aiVisor" x1="4" y1="7" x2="12" y2="9.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <line x1="8" y1="4" x2="8" y2="1.5" stroke="#818cf8" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="8" cy="1.5" r="1.4" fill="#f43f5e"/>
  <rect x="2" y="4" width="12" height="10" rx="3.0" fill="url(#aiGrad)" stroke="#6366f1" stroke-width="0.9"/>
  <rect x="3.8" y="6.8" width="8.4" height="3.4" rx="1.7" fill="url(#aiVisor)"/>
  <circle cx="6.0" cy="8.5" r="1.0" fill="#ffffff"/>
  <circle cx="10.0" cy="8.5" r="1.0" fill="#ffffff"/>
  <line x1="5.5" y1="12" x2="10.5" y2="12" stroke="#818cf8" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M13.5 1L14.1 2.3L15.4 2.9L14.1 3.5L13.5 4.8L12.9 3.5L11.6 2.9L12.9 2.3L13.5 1Z" fill="#fbbf24"/>
</svg>
""",

  "beautify.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="wandShaft" x1="1.5" y1="14.5" x2="9" y2="7" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <linearGradient id="sparkGold" x1="9" y1="0" x2="16" y2="7" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <line x1="1.8" y1="14.2" x2="8.6" y2="7.4" stroke="url(#wandShaft)" stroke-width="2.6" stroke-linecap="round"/>
  <line x1="3.2" y1="12.8" x2="4.4" y2="11.6" stroke="#fbbf24" stroke-width="2.6"/>
  <line x1="8.6" y1="7.4" x2="11.8" y2="4.2" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M13.2 0.4L14.0 2.4L16.0 3.2L14.0 4.0L13.2 6.0L12.4 4.0L10.4 3.2L12.4 2.4L13.2 0.4Z" fill="url(#sparkGold)"/>
  <path d="M5.4 2.2L5.9 3.4L7.1 3.9L5.9 4.4L5.4 5.6L4.9 4.4L3.7 3.9L4.9 3.4L5.4 2.2Z" fill="#fbbf24"/>
  <path d="M12.4 9.0L12.8 10.0L13.8 10.4L12.8 10.8L12.4 11.8L12.0 10.8L11.0 10.4L12.0 10.0L12.4 9.0Z" fill="#fde047"/>
</svg>
""",

  "change-env.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="serverBlade" x1="1" y1="0.8" x2="15" y2="6.2" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/><stop offset="50%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="0.8" width="14.0" height="5.2" rx="1.6" fill="url(#serverBlade)" stroke="#475569" stroke-width="0.7"/>
  <circle cx="3.6" cy="3.4" r="1.1" fill="#34d399"/>
  <line x1="6.5" y1="3.4" x2="12.8" y2="3.4" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <rect x="1.0" y="10.0" width="14.0" height="5.2" rx="1.6" fill="url(#serverBlade)" stroke="#475569" stroke-width="0.7"/>
  <circle cx="3.6" cy="12.6" r="1.1" fill="#38bdf8"/>
  <line x1="6.5" y1="12.6" x2="12.8" y2="12.6" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M10.2 6.8L12.4 8.0L10.2 9.2" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.8 9.2L3.6 8.0L5.8 6.8" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "clear.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="termFrame" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="delBadge" x1="9" y1="9" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#9f1239"/>
    </linearGradient>
  </defs>
  <rect x="0.8" y="1.2" width="14.4" height="13.6" rx="2.5" fill="url(#termFrame)" stroke="#475569" stroke-width="0.8"/>
  <path d="M3.4 5.8L6.2 8.0L3.4 10.2" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="7.8" y1="10.2" x2="10.6" y2="10.2" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="url(#delBadge)" stroke="#0f172a" stroke-width="1"/>
  <path d="M10.4 12.2H14.0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "create-bml.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="bmlDoc" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/><stop offset="50%" stop-color="#e11d48"/><stop offset="100%" stop-color="#9f1239"/>
    </linearGradient>
  </defs>
  <path d="M2.0 2.2C2.0 1.4 2.6 0.8 3.5 0.8H10.0L14.0 4.8V13.8C14.0 14.6 13.4 15.2 12.5 15.2H3.5C2.6 15.2 2.0 14.6 2.0 13.8V2.2Z" fill="url(#bmlDoc)"/>
  <path d="M10.0 0.8V4.8H14.0L10.0 0.8Z" fill="#fda4af"/>
  <path d="M5.5 6.5C4.8 6.5 4.5 7.2 4.5 8.0C4.5 8.8 4.8 9.5 5.5 9.5M8.5 6.5C9.2 6.5 9.5 7.2 9.5 8.0C9.5 8.8 9.2 9.5 8.5 9.5" stroke="#fde047" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="#4f46e5" stroke="#0f172a" stroke-width="0.9"/>
  <path d="M12.2 10.4V14.0M10.4 12.2H14.0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "create-override.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="ovrDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#ovrDoc)" stroke="#64748b" stroke-width="0.6"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#94a3b8"/>
  <line x1="4.0" y1="6.8" x2="9.8" y2="6.8" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4.0" y1="9.2" x2="8.2" y2="9.2" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="#059669" stroke="#0f172a" stroke-width="1.0"/>
  <path d="M12.2 10.4V14.0M10.4 12.2H14.0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "debug.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M6.8 3 C6.2 1.6 5.2 1.2 4.2 1.2M9.2 3 C9.8 1.6 10.8 1.2 11.8 1.2" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M4 6.6 C2.6 6 1.8 5 1.2 3.8M12 6.6 C13.4 6 14.2 5 14.8 3.8M3.4 9.8 H1M12.6 9.8 H15M4 13 C2.6 13.6 1.8 14.5 1.2 15.2M12 13 C13.4 13.6 14.2 14.5 14.8 15.2" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="8" cy="3.6" r="2.1" fill="#ea580c"/>
  <path d="M7.4 5 C4.2 5 3.2 7 3.2 9.8 C3.2 12.6 4.6 14.6 7.4 14.6 Z" fill="url(#orangeGrad)"/>
  <path d="M8.6 5 C11.8 5 12.8 7 12.8 9.8 C12.8 12.6 11.4 14.6 8.6 14.6 Z" fill="url(#orangeGrad)"/>
  <defs><linearGradient id="orangeGrad" x1="3.2" y1="5" x2="12.8" y2="14.6" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs>
</svg>
""",

  "debug-configure.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M6.8 3 C6.2 1.6 5.2 1.2 4.2 1.2M9.2 3 C9.8 1.6 10.8 1.2 11.8 1.2" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M4 6.6 C2.6 6 1.8 5 1.2 3.8M12 6.6 C13.4 6 14.2 5 14.8 3.8M3.4 9.8 H1M12.6 9.8 H15M4 13 C2.6 13.6 1.8 14.5 1.2 15.2" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="8" cy="3.6" r="2.1" fill="#ea580c"/>
  <path d="M7.4 5 C4.2 5 3.2 7 3.2 9.8 C3.2 12.6 4.6 14.6 7.4 14.6 Z" fill="url(#orangeGrad)"/>
  <path d="M8.6 5 C11.8 5 12.8 7 12.8 9.8 C12.8 12.6 11.4 14.6 8.6 14.6 Z" fill="url(#orangeGrad)"/>
  <circle cx="11.6" cy="11.6" r="3.8" fill="#0f172a" stroke="#ea580c" stroke-width="0.8"/>
  <g transform="translate(11.6, 11.6) scale(0.38) translate(-8, -8)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 0.8H9.5L9.9 2.8C10.5 3.1 11.1 3.5 11.6 3.9L13.5 3.1L15.0 5.7L13.5 7.2C13.6 7.5 13.6 7.7 13.6 8C13.6 8.3 13.6 8.5 13.5 8.8L15.0 10.3L13.5 12.9L11.6 12.1C11.1 12.5 10.5 12.9 9.9 13.2L9.5 15.2H6.5L6.1 13.2C5.5 12.9 4.9 12.5 4.4 12.1L2.5 12.9L1.0 10.3L2.5 8.8C2.4 8.5 2.4 8.3 2.4 8C2.4 7.7 2.4 7.5 2.5 7.2L1.0 5.7L2.5 3.1L4.4 3.9C4.9 3.5 5.5 3.1 6.1 2.8L6.5 0.8ZM8 5.6C6.67 5.6 5.6 6.67 5.6 8C5.6 9.33 6.67 10.4 8 10.4C9.33 10.4 10.4 9.33 10.4 8C10.4 6.67 9.33 5.6 8 5.6Z" fill="#38bdf8"/>
  </g>
  <defs><linearGradient id="orangeGrad" x1="3.2" y1="5" x2="12.8" y2="14.6" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs>
</svg>
""",

  "deploy.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="depHull" x1="5" y1="2" x2="15" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#bae6fd"/><stop offset="30%" stop-color="#38bdf8"/><stop offset="70%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <path d="M4.8 6.8L1.2 8.4L2.0 11.6L3.8 9.8ZM9.2 11.2L7.6 14.8L4.4 14.0L6.2 12.2Z" fill="#e11d48"/>
  <path d="M3.8 10.2C3.0 11.4 2.0 12.6 0.6 15.4C3.4 14.0 4.6 13.0 5.8 12.2C5.0 11.8 4.2 11.0 3.8 10.2Z" fill="#f97316"/>
  <path d="M3.5 10.8C3.0 11.6 2.4 12.4 1.5 14.2C3.2 13.4 4.0 12.8 4.8 12.2Z" fill="#fef08a"/>
  <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#depHull)"/>
  <circle cx="10" cy="6" r="2.0" fill="#ffffff"/>
  <circle cx="10" cy="6" r="1.3" fill="#0284c7"/>
</svg>
""",

  "deploy-commerce.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="commGrad" x1="5" y1="2" x2="15" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fde047"/><stop offset="50%" stop-color="#f97316"/><stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
  </defs>
  <path d="M4.8 6.8L1.2 8.4L2.0 11.6L3.8 9.8ZM9.2 11.2L7.6 14.8L4.4 14.0L6.2 12.2Z" fill="#ef4444"/>
  <path d="M3.8 10.2C3.0 11.4 2.0 12.6 0.6 15.4C3.4 14.0 4.6 13.0 5.8 12.2Z" fill="#f97316"/>
  <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#commGrad)"/>
  <circle cx="10" cy="6" r="1.8" fill="#ffffff"/>
  <circle cx="12.4" cy="12.4" r="3.4" fill="#b45309" stroke="#0f172a" stroke-width="0.8"/>
  <circle cx="12.4" cy="12.4" r="1.3" fill="#fde047"/>
</svg>
""",

  "deploy-mass.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="fleetGold" x1="4" y1="2" x2="15" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <g id="fleet-cruiser">
      <path d="M4.8 6.8L1.2 8.4L2.0 11.6L3.8 9.8ZM9.2 11.2L7.6 14.8L4.4 14.0L6.2 12.2Z" fill="#ef4444"/>
      <path d="M3.8 10.2C3.0 11.4 2.0 12.6 0.6 15.4C3.4 14.0 4.6 13.0 5.8 12.2Z" fill="#f97316"/>
      <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#fleetGold)"/>
    </g>
  </defs>
  <use href="#fleet-cruiser" xlink:href="#fleet-cruiser" opacity="0.45" transform="translate(-2.4, 2.8) scale(0.72)"/>
  <use href="#fleet-cruiser" xlink:href="#fleet-cruiser" opacity="0.65" transform="translate(2.8, -2.4) scale(0.72)"/>
  <use href="#fleet-cruiser" xlink:href="#fleet-cruiser" transform="translate(0.3, 0.3) scale(0.88)"/>
</svg>
""",

  "metrics.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <circle cx="8" cy="8.5" r="7.0" fill="#1e293b" stroke="#64748b" stroke-width="0.8"/>
  <path d="M3.2 10.8A5.2 5.2 0 0 1 4.5 5.5" stroke="#10b981" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M5.5 4.5A5.2 5.2 0 0 1 10.5 4.5" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M11.5 5.5A5.2 5.2 0 0 1 12.8 10.8" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="8" cy="9.2" r="1.6" fill="#334155" stroke="#94a3b8" stroke-width="0.5"/>
  <line x1="8" y1="9.2" x2="12.2" y2="4.8" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "preview.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="eyeLens" x1="8" y1="4" x2="8" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <path d="M1.2 8.0C3.0 4.2 6.5 2.2 8.0 2.2C9.5 2.2 13.0 4.2 14.8 8.0C13.0 11.8 9.5 13.8 8.0 13.8C6.5 13.8 3.0 11.8 1.2 8.0Z" fill="#0f172a" stroke="#64748b" stroke-width="1.2"/>
  <circle cx="8" cy="8" r="4.2" fill="url(#eyeLens)" stroke="#7dd3fc" stroke-width="0.5"/>
  <circle cx="8" cy="8" r="1.6" fill="#0f172a"/>
  <circle cx="7.0" cy="6.8" r="0.7" fill="#ffffff"/>
</svg>
""",

  "pull.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="pullCloud" x1="2" y1="1" x2="14" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5eead4"/><stop offset="50%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <path d="M12.5 6.4C12.5 4.0 10.5 2.0 8.0 2.0C6.0 2.0 4.2 3.2 3.5 5.0C1.8 5.4 0.6 6.8 0.6 8.6C0.6 10.8 2.4 12.6 4.6 12.6H12.3C14.3 12.6 16.0 11.0 16.0 9.0C16.0 7.3 14.5 6.6 12.5 6.4Z" fill="url(#pullCloud)"/>
  <path d="M8.0 4.2V11.2M8.0 11.2L5.2 8.4M8.0 11.2L10.8 8.4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.0 14.6H13.0" stroke="#14b8a6" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "remove-override.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="#334155" stroke="#64748b" stroke-width="0.6"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#94a3b8"/>
  <line x1="4.0" y1="6.8" x2="9.8" y2="6.8" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4.0" y1="9.2" x2="8.2" y2="9.2" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="#e11d48" stroke="#0f172a" stroke-width="1.0"/>
  <path d="M10.4 12.2H14.0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "run-tests.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="flaskLiquid" x1="4" y1="8" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#c084fc"/><stop offset="50%" stop-color="#9333ea"/><stop offset="100%" stop-color="#581c87"/>
    </linearGradient>
  </defs>
  <path d="M5.5 1.0H10.5M6.6 1.0V5.2L2.6 12.8C1.8 14.4 3.0 15.5 4.8 15.5H11.2C13.0 15.5 14.2 14.4 13.4 12.8L9.4 5.2V1.0" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.8 12.6C3.4 13.4 4.0 14.6 5.0 14.6H11.0C12.0 14.6 12.6 13.4 12.2 12.6L9.8 8.2H6.2L3.8 12.6Z" fill="url(#flaskLiquid)"/>
  <ellipse cx="8" cy="8.2" rx="1.8" ry="0.6" fill="#d8b4fe"/>
  <circle cx="8.0" cy="10.8" r="1.0" fill="#ffffff" opacity="0.85"/>
  <circle cx="6.2" cy="12.4" r="1.2" fill="#ffffff" opacity="0.85"/>
</svg>
""",

  "save.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="diskBody" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3b82f6"/><stop offset="50%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#172554"/>
    </linearGradient>
    <linearGradient id="metalShutter" x1="4" y1="1" x2="12" y2="6.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <path d="M1.5 2.5C1.5 1.7 2.1 1.0 2.9 1.0H12.5L14.5 3.0V13.5C14.5 14.3 13.9 15.0 13.1 15.0H2.9C2.1 15.0 1.5 14.3 1.5 13.5V2.5Z" fill="url(#diskBody)" stroke="#60a5fa" stroke-width="0.6"/>
  <rect x="4.2" y="1.0" width="7.6" height="5.6" rx="0.8" fill="url(#metalShutter)" stroke="#475569" stroke-width="0.4"/>
  <rect x="6.0" y="2.2" width="2.0" height="3.4" rx="0.9" fill="#1e293b"/>
  <rect x="3.4" y="8.8" width="9.2" height="5.6" rx="1.0" fill="#f8fafc"/>
  <rect x="3.4" y="8.8" width="9.2" height="1.4" rx="0.6" fill="#0284c7"/>
  <line x1="4.6" y1="11.8" x2="11.4" y2="11.8" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <circle cx="13.2" cy="7.2" r="0.9" fill="#10b981"/>
</svg>
""",

  "settings.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="setGrad" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#a78bfa"/><stop offset="50%" stop-color="#818cf8"/><stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 0.8H9.5L9.9 2.8C10.5 3.1 11.1 3.5 11.6 3.9L13.5 3.1L15.0 5.7L13.5 7.2C13.6 7.5 13.6 7.7 13.6 8C13.6 8.3 13.6 8.5 13.5 8.8L15.0 10.3L13.5 12.9L11.6 12.1C11.1 12.5 10.5 12.9 9.9 13.2L9.5 15.2H6.5L6.1 13.2C5.5 12.9 4.9 12.5 4.4 12.1L2.5 12.9L1.0 10.3L2.5 8.8C2.4 8.5 2.4 8.3 2.4 8C2.4 7.7 2.4 7.5 2.5 7.2L1.0 5.7L2.5 3.1L4.4 3.9C4.9 3.5 5.5 3.1 6.1 2.8L6.5 0.8ZM8 5.6C6.67 5.6 5.6 6.67 5.6 8C5.6 9.33 6.67 10.4 8 10.4C9.33 10.4 10.4 9.33 10.4 8C10.4 6.67 9.33 5.6 8 5.6Z" fill="url(#setGrad)"/>
</svg>
""",

  "snapshot-compare.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="1.0" y="1.2" width="6.2" height="13.6" rx="1.6" fill="#1d4ed8" stroke="#60a5fa" stroke-width="0.7"/>
  <line x1="2.4" y1="4.2" x2="5.8" y2="4.2" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
  <line x1="2.4" y1="7.2" x2="5.8" y2="7.2" stroke="#f87171" stroke-width="1.1" stroke-linecap="round"/>
  <rect x="8.8" y="1.2" width="6.2" height="13.6" rx="1.6" fill="#047857" stroke="#34d399" stroke-width="0.7"/>
  <line x1="10.2" y1="4.2" x2="13.6" y2="4.2" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
  <line x1="10.2" y1="7.2" x2="13.6" y2="7.2" stroke="#34d399" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M6.8 7.2L9.2 7.2" stroke="#fde047" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "snapshot-update.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <rect x="1.0" y="3.8" width="14.0" height="10.2" rx="2.5" fill="#334155" stroke="#64748b" stroke-width="0.8"/>
  <path d="M4.5 3.8L6.0 1.6H10.0L11.5 3.8" fill="#1e293b" stroke="#64748b" stroke-width="0.6"/>
  <circle cx="8" cy="8.9" r="3.2" fill="#0f172a" stroke="#94a3b8" stroke-width="0.6"/>
  <circle cx="8" cy="8.9" r="2.2" fill="#0284c7"/>
  <circle cx="7.3" cy="8.2" r="0.7" fill="#ffffff" opacity="0.8"/>
  <circle cx="12.8" cy="5.8" r="1.0" fill="#34d399"/>
</svg>
""",

  "switch-file.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M1.8 4.8H12.2M12.2 4.8L9.2 1.8M12.2 4.8L9.2 7.8" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.2 11.2H3.8M3.8 11.2L6.8 8.2M3.8 11.2L6.8 14.2" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "validate.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="valBase" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="35%" stop-color="#10b981"/>
      <stop offset="75%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="valRim" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="50%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <radialGradient id="valGloss" cx="8" cy="3.5" r="6.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="65%" stop-color="#ffffff" stop-opacity="0.0"/>
    </radialGradient>
  </defs>
  <circle cx="8" cy="8" r="7.2" fill="#047857"/>
  <circle cx="8" cy="8" r="6.7" fill="url(#valBase)" stroke="url(#valRim)" stroke-width="0.8"/>
  <circle cx="8" cy="8" r="6.3" fill="url(#valGloss)"/>
  <circle cx="8" cy="8" r="5.2" fill="none" stroke="#6ee7b7" stroke-width="0.5" stroke-dasharray="2.5 1.0" opacity="0.75"/>
  <path d="M3.5 6.6C3.9 4.2 5.8 2.5 8.0 2.5C10.2 2.5 12.1 4.2 12.5 6.6C11.2 5.1 9.7 4.4 8.0 4.4C6.3 4.4 4.8 5.1 3.5 6.6Z" fill="#ffffff" opacity="0.38"/>
  <path d="M4.6 8.3L6.9 10.7L11.5 5.6" stroke="#064e3b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4.6 8.1L6.9 10.5L11.5 5.4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""
}

def main():
    os.makedirs(EDITOR_ICONS_DIR, exist_ok=True)
    for filename, content in EDITOR_ICONS.items():
        filepath = os.path.join(EDITOR_ICONS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated: app/icons/editor/{filename}")
    # Also write debug-config.svg alias
    with open(os.path.join(EDITOR_ICONS_DIR, 'debug-config.svg'), 'w', encoding='utf-8') as f:
        f.write(EDITOR_ICONS['debug-configure.svg'])
    print(f"All {len(EDITOR_ICONS)} editor icons generated successfully.")

if __name__ == '__main__':
    main()
