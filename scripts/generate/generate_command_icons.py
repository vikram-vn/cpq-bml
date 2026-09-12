"""
generate_command_icons.py
Generates the 22 command and toolbar action icons in app/icons/:
- ai-setup.svg, beautify.svg, change-env.svg, clear.svg, create-bml.svg
- create-override.svg, debug.svg, debug-configure.svg, deploy-commerce.svg
- deploy-mass.svg, deploy.svg, metrics.svg, preview.svg, pull.svg
- remove-override.svg, run-tests.svg, save.svg, settings.svg
- snapshot-compare.svg, snapshot-update.svg, switch-file.svg, validate.svg

Fully self-contained: no external dependencies beyond standard library.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons')

ICONS = {
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
  <rect x="2" y="4" width="12" height="10" rx="2.8" fill="url(#aiGrad)" stroke="#6366f1" stroke-width="0.9"/>
  <rect x="4" y="7" width="8" height="3" rx="1.5" fill="url(#aiVisor)"/>
  <circle cx="6" cy="8.5" r="0.9" fill="#ffffff"/>
  <circle cx="10" cy="8.5" r="0.9" fill="#ffffff"/>
  <line x1="5.5" y1="12" x2="10.5" y2="12" stroke="#818cf8" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M13.5 1L14.1 2.3L15.4 2.9L14.1 3.5L13.5 4.8L12.9 3.5L11.6 2.9L12.9 2.3L13.5 1Z" fill="#fbbf24"/>
</svg>
""",

  "beautify.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="wandGrad" x1="2" y1="14" x2="11" y2="5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="60%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="sparkleGrad" x1="10" y1="0" x2="16" y2="6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <line x1="2" y1="14" x2="8.5" y2="7.5" stroke="url(#wandGrad)" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="8.5" y1="7.5" x2="11.5" y2="4.5" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M13 0.5L13.8 2.5L15.8 3.3L13.8 4.1L13 6.1L12.2 4.1L10.2 3.3L12.2 2.5L13 0.5Z" fill="url(#sparkleGrad)"/>
  <path d="M5.5 2.5L6 3.6L7.1 4.1L6 4.6L5.5 5.7L5 4.6L3.9 4.1L5 3.6L5.5 2.5Z" fill="#fbbf24"/>
  <path d="M12 9L12.4 9.9L13.3 10.3L12.4 10.7L12 11.6L11.6 10.7L10.7 10.3L11.6 9.9L12 9Z" fill="#fbbf24"/>
</svg>
""",

  "change-env.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="envGrad" x1="1.2" y1="0.8" x2="14.8" y2="15.2" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3730a3"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="arrowGrad" x1="4" y1="6" x2="12" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect x="1.2" y="0.8" width="13.6" height="5.2" rx="1.6" fill="url(#envGrad)" stroke="#4f46e5" stroke-width="0.8"/>
  <circle cx="4" cy="3.4" r="1.1" fill="#34d399"/>
  <line x1="7" y1="3.4" x2="12.5" y2="3.4" stroke="#818cf8" stroke-width="1.4" stroke-linecap="round"/>
  <rect x="1.2" y="10" width="13.6" height="5.2" rx="1.6" fill="url(#envGrad)" stroke="#4f46e5" stroke-width="0.8"/>
  <circle cx="4" cy="12.6" r="1.1" fill="#38bdf8"/>
  <line x1="7" y1="12.6" x2="12.5" y2="12.6" stroke="#818cf8" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M10 6.6L12.2 8L10 9.4" stroke="url(#arrowGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 9.4L3.8 8L6 6.6" stroke="url(#arrowGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "clear.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="termGrad" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="delBadge" x1="9" y1="9" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect x="0.8" y="1.2" width="14.4" height="13.6" rx="2.5" fill="url(#termGrad)" stroke="#475569" stroke-width="0.8"/>
  <path d="M3.5 5.5L6.5 8L3.5 10.5" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.2" y1="10.5" x2="11" y2="10.5" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="url(#delBadge)" stroke="#0f172a" stroke-width="1"/>
  <path d="M10.6 12.2H13.8" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "create-bml.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="bmlGrad" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
    <linearGradient id="bmlFold" x1="9" y1="1" x2="14" y2="5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fecdd3"/>
      <stop offset="100%" stop-color="#fda4af"/>
    </linearGradient>
  </defs>
  <path d="M2 2.2C2 1.4 2.6 0.8 3.5 0.8H10.2L14 4.6V13.8C14 14.6 13.4 15.2 12.5 15.2H3.5C2.6 15.2 2 14.6 2 13.8V2.2Z" fill="url(#bmlGrad)"/>
  <path d="M10.2 0.8V4.6H14L10.2 0.8Z" fill="url(#bmlFold)"/>
  <path d="M8 6.5V11.5M5.5 9H10.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
</svg>
""",

  "create-override.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="docGrad" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="plusBadge" x1="9" y1="9" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <path d="M2 2.2C2 1.5 2.5 1 3.2 1H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15 11.2 15H3.2C2.5 15 2 14.5 2 13.8V2.2Z" fill="url(#docGrad)"/>
  <path d="M8.6 1V4.8H12.4L8.6 1Z" fill="#94a3b8"/>
  <line x1="4" y1="6.8" x2="9.8" y2="6.8" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4" y1="9.2" x2="8.2" y2="9.2" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4" y1="11.6" x2="7" y2="11.6" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="url(#plusBadge)" stroke="#0f172a" stroke-width="1"/>
  <path d="M12.2 10.4V14M10.4 12.2H14" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "debug.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <!-- Antennae -->
  <path d="M6.8 3 C6.2 1.6 5.2 1.2 4.2 1.2" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M9.2 3 C9.8 1.6 10.8 1.2 11.8 1.2" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Legs -->
  <path d="M4 6.6 C2.6 6 1.8 5 1.2 3.8" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M12 6.6 C13.4 6 14.2 5 14.8 3.8" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  
  <path d="M3.4 9.8 H1" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M12.6 9.8 H15" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  
  <path d="M4 13 C2.6 13.6 1.8 14.5 1.2 15.2" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M12 13 C13.4 13.6 14.2 14.5 14.8 15.2" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>

  <!-- Head -->
  <circle cx="8" cy="3.6" r="2.1" fill="#ea580c"/>

  <!-- Left wing shell -->
  <path d="M7.4 5 C4.2 5 3.2 7 3.2 9.8 C3.2 12.6 4.6 14.6 7.4 14.6 Z" fill="url(#orangeGrad)"/>
  <!-- Right wing shell -->
  <path d="M8.6 5 C11.8 5 12.8 7 12.8 9.8 C12.8 12.6 11.4 14.6 8.6 14.6 Z" fill="url(#orangeGrad)"/>

  <defs>
    <linearGradient id="orangeGrad" x1="3.2" y1="5" x2="12.8" y2="14.6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
</svg>
""",

  "debug-configure.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <!-- Antennae -->
  <path d="M6.8 3 C6.2 1.6 5.2 1.2 4.2 1.2" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M9.2 3 C9.8 1.6 10.8 1.2 11.8 1.2" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Legs -->
  <path d="M4 6.6 C2.6 6 1.8 5 1.2 3.8" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M12 6.6 C13.4 6 14.2 5 14.8 3.8" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  
  <path d="M3.4 9.8 H1" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>
  
  <path d="M4 13 C2.6 13.6 1.8 14.5 1.2 15.2" stroke="#ea580c" stroke-width="1.6" stroke-linecap="round"/>

  <!-- Head -->
  <circle cx="8" cy="3.6" r="2.1" fill="#ea580c"/>

  <!-- Left wing shell -->
  <path d="M7.4 5 C4.2 5 3.2 7 3.2 9.8 C3.2 12.6 4.6 14.6 7.4 14.6 Z" fill="url(#orangeGrad)"/>
  <!-- Right wing shell -->
  <path d="M8.6 5 C11.8 5 12.8 7 12.8 9.8 C12.8 11 12.2 12.2 11.2 13 C10.4 12 9.4 11.4 8.6 14.6 Z" fill="url(#orangeGrad)"/>

  <!-- Gear Badge Background -->
  <circle cx="11.6" cy="11.6" r="4.0" fill="#0f172a" stroke="#ea580c" stroke-width="0.8"/>

  <!-- Proper VS Code Gear Icon -->
  <g transform="translate(11.6, 11.6) scale(0.42) translate(-8, -8)">
    <path d="M7.99997 6C6.89497 6 5.99997 6.895 5.99997 8C5.99997 9.105 6.89497 10 7.99997 10C9.10497 10 9.99997 9.105 9.99997 8C9.99997 6.895 9.10497 6 7.99997 6ZM7.99997 9C7.44797 9 6.99997 8.552 6.99997 8C6.99997 7.448 7.44797 7 7.99997 7C8.55197 7 8.99997 7.448 8.99997 8C8.99997 8.552 8.55197 9 7.99997 9ZM14.565 9.715L13.279 8.628C13.245 8.599 13.213 8.567 13.184 8.533C12.888 8.186 12.931 7.667 13.279 7.372L14.565 6.285C14.693 6.177 14.742 6.003 14.691 5.844C14.386 4.903 13.882 4.04 13.219 3.308C13.139 3.22 13.027 3.172 12.912 3.172C12.865 3.172 12.818 3.18 12.773 3.196L11.186 3.761C11.144 3.776 11.1 3.788 11.056 3.796C11.006 3.805 10.956 3.81 10.907 3.81C10.515 3.81 10.167 3.532 10.094 3.134L9.79097 1.482C9.76097 1.318 9.63397 1.188 9.46997 1.153C8.98997 1.051 8.49897 1 8.00097 1C7.50297 1 7.01097 1.052 6.53097 1.153C6.36697 1.188 6.23997 1.318 6.20997 1.482L5.90797 3.134C5.89997 3.178 5.88797 3.221 5.87297 3.263C5.75197 3.6 5.43397 3.81 5.09397 3.81C5.00197 3.81 4.90797 3.794 4.81597 3.762L3.22897 3.197C3.18397 3.181 3.13597 3.173 3.08997 3.173C2.97497 3.173 2.86297 3.221 2.78297 3.309C2.11897 4.041 1.61597 4.904 1.30997 5.845C1.25797 6.004 1.30797 6.178 1.43597 6.286L2.72197 7.373C2.75597 7.402 2.78797 7.434 2.81697 7.468C3.11297 7.815 3.06997 8.334 2.72197 8.629L1.43597 9.716C1.30797 9.824 1.25897 9.998 1.30997 10.157C1.61497 11.098 2.11897 11.961 2.78297 12.693C2.86297 12.781 2.97497 12.829 3.08997 12.829C3.13697 12.829 3.18397 12.821 3.22897 12.805L4.81597 12.24C4.85797 12.225 4.90197 12.213 4.94597 12.205C4.99597 12.196 5.04597 12.192 5.09497 12.192C5.48697 12.192 5.83497 12.47 5.90797 12.868L6.20997 14.52C6.23997 14.684 6.36697 14.814 6.53097 14.849C7.01097 14.951 7.50297 15.002 8.00097 15.002C8.49897 15.002 8.99097 14.95 9.46997 14.849C9.63397 14.814 9.76097 14.684 9.79097 14.52L10.094 12.868C10.102 12.824 10.114 12.781 10.129 12.739C10.25 12.402 10.568 12.192 10.908 12.192C11 12.192 11.094 12.208 11.186 12.24L12.772 12.805C12.818 12.821 12.865 12.829 12.911 12.829C13.026 12.829 13.138 12.781 13.218 12.693C13.882 11.961 14.385 11.098 14.69 10.157C14.742 9.998 14.692 9.824 14.564 9.716L14.565 9.715ZM12.728 11.726L11.521 11.296C11.323 11.226 11.117 11.19 10.908 11.19C10.139 11.19 9.44697 11.676 9.18797 12.399C9.15397 12.492 9.12897 12.588 9.11097 12.686L8.88097 13.937C8.59097 13.979 8.29597 14 8.00097 14C7.70597 14 7.41097 13.979 7.11997 13.936L6.89097 12.685C6.73197 11.818 5.97697 11.189 5.09497 11.189C4.98697 11.189 4.87697 11.199 4.76597 11.219C4.66897 11.237 4.57397 11.262 4.47997 11.295L3.27297 11.725C2.90497 11.264 2.61097 10.759 2.39397 10.214L3.36797 9.391C3.74097 9.076 3.96797 8.634 4.00797 8.148C4.04797 7.662 3.89497 7.19 3.57797 6.818C3.51397 6.743 3.44297 6.672 3.36797 6.608L2.39397 5.785C2.61097 5.24 2.90497 4.734 3.27297 4.274L4.47997 4.704C4.67797 4.774 4.88397 4.81 5.09397 4.81C5.86297 4.81 6.55497 4.324 6.81397 3.601C6.84797 3.507 6.87297 3.411 6.89097 3.314L7.11997 2.063C7.41097 2.021 7.70597 1.999 8.00097 1.999C8.29597 1.999 8.59097 2.02 8.88097 2.062L9.10997 3.313C9.26897 4.18 10.024 4.809 10.906 4.809C11.014 4.809 11.124 4.799 11.234 4.779C11.331 4.761 11.427 4.736 11.521 4.703L12.728 4.273C13.096 4.733 13.39 5.239 13.607 5.784L12.634 6.607C12.261 6.922 12.033 7.364 11.994 7.85C11.954 8.336 12.107 8.809 12.424 9.18C12.489 9.256 12.559 9.326 12.635 9.39L13.609 10.213C13.392 10.758 13.098 11.264 12.73 11.724L12.728 11.726Z" fill="#38bdf8"/>
  </g>

  <defs>
    <linearGradient id="orangeGrad" x1="3.2" y1="5" x2="12.8" y2="14.6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
</svg>
""",

  "deploy-commerce.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="commGrad" x1="5" y1="2" x2="15" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="60%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </linearGradient>
    <linearGradient id="commFlame" x1="5" y1="10" x2="0.5" y2="15.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <linearGradient id="commFin" x1="3" y1="7" x2="9" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
  </defs>
  <path d="M4.8 6.8L1.2 8.4L2.0 11.6L3.8 9.8Z" fill="url(#commFin)"/>
  <path d="M9.2 11.2L7.6 14.8L4.4 14.0L6.2 12.2Z" fill="url(#commFin)"/>
  <path d="M3.8 10.2C3.0 11.4 2.0 12.6 0.6 15.4C3.4 14.0 4.6 13.0 5.8 12.2C5.0 11.8 4.2 11.0 3.8 10.2Z" fill="url(#commFlame)"/>
  <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#commGrad)"/>
  <circle cx="10" cy="6" r="2.2" fill="#ffffff"/>
  <circle cx="10" cy="6" r="1.4" fill="#ea580c"/>
  <circle cx="9.6" cy="5.6" r="0.5" fill="#fef08a"/>
  <circle cx="12.4" cy="12.4" r="3.4" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/>
  <circle cx="12.4" cy="12.4" r="1.2" fill="#fbbf24"/>
  <path d="M12.4 9.8V11M12.4 13.8V15M9.8 12.4H11M13.8 12.4H15" stroke="#fbbf24" stroke-width="1.1" stroke-linecap="round"/>
</svg>
""",

  "deploy-mass.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="massGold" x1="4" y1="2" x2="15" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <g id="mass-rocket">
      <path d="M4.8 6.8L1.2 8.4L2.0 11.6L3.8 9.8Z" fill="#ef4444"/>
      <path d="M9.2 11.2L7.6 14.8L4.4 14.0L6.2 12.2Z" fill="#ef4444"/>
      <path d="M3.8 10.2C3.0 11.4 2.0 12.6 0.6 15.4C3.4 14.0 4.6 13.0 5.8 12.2Z" fill="#f97316"/>
      <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#massGold)"/>
      <circle cx="10" cy="6" r="1.6" fill="#ffffff"/>
      <circle cx="10" cy="6" r="1.0" fill="#b45309"/>
    </g>
  </defs>
  <use href="#mass-rocket" xlink:href="#mass-rocket" opacity="0.45" transform="translate(-2.2, 2.8) scale(0.72)"/>
  <use href="#mass-rocket" xlink:href="#mass-rocket" opacity="0.65" transform="translate(2.8, -2.2) scale(0.72)"/>
  <use href="#mass-rocket" xlink:href="#mass-rocket" transform="translate(0.4, 0.4) scale(0.86)"/>
</svg>
""",

  "deploy.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="depGrad" x1="5" y1="2" x2="15" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
    <linearGradient id="depFlame" x1="5" y1="10" x2="0.5" y2="15.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="35%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <linearGradient id="finGrad" x1="3" y1="7" x2="9" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#be123c"/>
    </linearGradient>
  </defs>
  <path d="M4.8 6.8L1.2 8.4L2.0 11.6L3.8 9.8Z" fill="url(#finGrad)"/>
  <path d="M9.2 11.2L7.6 14.8L4.4 14.0L6.2 12.2Z" fill="url(#finGrad)"/>
  <path d="M3.8 10.2C3.0 11.4 2.0 12.6 0.6 15.4C3.4 14.0 4.6 13.0 5.8 12.2C5.0 11.8 4.2 11.0 3.8 10.2Z" fill="url(#depFlame)"/>
  <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#depGrad)"/>
  <circle cx="10" cy="6" r="2.2" fill="#ffffff"/>
  <circle cx="10" cy="6" r="1.4" fill="#0284c7"/>
  <circle cx="9.6" cy="5.6" r="0.5" fill="#bae6fd"/>
</svg>
""",

  "metrics.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="barBlue" x1="1.5" y1="8" x2="5" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="barRed" x1="6.25" y1="3" x2="9.75" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <linearGradient id="barGreen" x1="11" y1="5.5" x2="14.5" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="8" width="3.5" height="7" rx="1.2" fill="url(#barBlue)"/>
  <rect x="6.25" y="3.2" width="3.5" height="11.8" rx="1.2" fill="url(#barRed)"/>
  <rect x="11" y="5.5" width="3.5" height="9.5" rx="1.2" fill="url(#barGreen)"/>
  <path d="M2.5 7.5L8 2.2L13 4.8" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="13" cy="4.8" r="1.3" fill="#f59e0b"/>
</svg>
""",

  "preview.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="prevFrame" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="0.8" y="1.2" width="14.4" height="13.6" rx="2" fill="url(#prevFrame)" stroke="#64748b" stroke-width="1"/>
  <line x1="8" y1="1.5" x2="8" y2="14.5" stroke="#64748b" stroke-width="1"/>
  <line x1="2.8" y1="4.5" x2="6" y2="4.5" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="2.8" y1="7.5" x2="6.5" y2="7.5" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="2.8" y1="10.5" x2="5.2" y2="10.5" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="11.5" cy="8" r="2.6" fill="#f97316"/>
  <circle cx="11.5" cy="8" r="1.1" fill="#ffffff"/>
</svg>
""",

  "pull.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="pullGrad" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <path d="M12.5 7.2C12.5 4.5 10.3 2.3 7.6 2.3C5.4 2.3 3.5 3.7 2.8 5.8C1.2 6.3 0 7.8 0 9.6C0 11.9 1.8 13.8 4.1 13.8H12.3C14.3 13.8 16 12.2 16 10.2C16 8.5 14.6 7.4 12.5 7.2Z" fill="url(#pullGrad)"/>
  <path d="M8 4.8V10.8M8 10.8L5.2 8M8 10.8L10.8 8" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "remove-override.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="docRemGrad" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="minusBadge" x1="9" y1="9" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <path d="M2 2.2C2 1.5 2.5 1 3.2 1H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15 11.2 15H3.2C2.5 15 2 14.5 2 13.8V2.2Z" fill="url(#docRemGrad)"/>
  <path d="M8.6 1V4.8H12.4L8.6 1Z" fill="#94a3b8"/>
  <line x1="4" y1="6.8" x2="9.8" y2="6.8" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4" y1="9.2" x2="8.2" y2="9.2" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="4" y1="11.6" x2="7" y2="11.6" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="12.2" cy="12.2" r="3.4" fill="url(#minusBadge)" stroke="#0f172a" stroke-width="1"/>
  <path d="M10.4 12.2H14" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "run-tests.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="flaskGrad" x1="5" y1="8" x2="11" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <path d="M5.5 1H10.5M6.5 1V5.2L2.8 12.8C2.0 14.4 3.1 15.5 4.9 15.5H11.1C12.9 15.5 14.0 14.4 13.2 12.8L9.5 5.2V1" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.9 12.6C3.5 13.4 4.1 14.5 5.0 14.5H11.0C11.9 14.5 12.5 13.4 12.1 12.6L10.0 8.5H6.0L3.9 12.6Z" fill="url(#flaskGrad)"/>
  <circle cx="8" cy="10.5" r="1.1" fill="#f3e8ff"/>
  <circle cx="6.2" cy="12.2" r="1.3" fill="#f3e8ff"/>
  <circle cx="9.8" cy="11.8" r="1.0" fill="#f3e8ff"/>
</svg>
""",

  "save.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="saveGrad" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <path d="M12.5 7.2C12.5 4.5 10.3 2.3 7.6 2.3C5.4 2.3 3.5 3.7 2.8 5.8C1.2 6.3 0 7.8 0 9.6C0 11.9 1.8 13.8 4.1 13.8H12.3C14.3 13.8 16 12.2 16 10.2C16 8.5 14.6 7.4 12.5 7.2Z" fill="url(#saveGrad)"/>
  <path d="M8 11.5V5.5M8 5.5L5.2 8.3M8 5.5L10.8 8.3" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "settings.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M7.99997 6C6.89497 6 5.99997 6.895 5.99997 8C5.99997 9.105 6.89497 10 7.99997 10C9.10497 10 9.99997 9.105 9.99997 8C9.99997 6.895 9.10497 6 7.99997 6ZM7.99997 9C7.44797 9 6.99997 8.552 6.99997 8C6.99997 7.448 7.44797 7 7.99997 7C8.55197 7 8.99997 7.448 8.99997 8C8.99997 8.552 8.55197 9 7.99997 9ZM14.565 9.715L13.279 8.628C13.245 8.599 13.213 8.567 13.184 8.533C12.888 8.186 12.931 7.667 13.279 7.372L14.565 6.285C14.693 6.177 14.742 6.003 14.691 5.844C14.386 4.903 13.882 4.04 13.219 3.308C13.139 3.22 13.027 3.172 12.912 3.172C12.865 3.172 12.818 3.18 12.773 3.196L11.186 3.761C11.144 3.776 11.1 3.788 11.056 3.796C11.006 3.805 10.956 3.81 10.907 3.81C10.515 3.81 10.167 3.532 10.094 3.134L9.79097 1.482C9.76097 1.318 9.63397 1.188 9.46997 1.153C8.98997 1.051 8.49897 1 8.00097 1C7.50297 1 7.01097 1.052 6.53097 1.153C6.36697 1.188 6.23997 1.318 6.20997 1.482L5.90797 3.134C5.89997 3.178 5.88797 3.221 5.87297 3.263C5.75197 3.6 5.43397 3.81 5.09397 3.81C5.00197 3.81 4.90797 3.794 4.81597 3.762L3.22897 3.197C3.18397 3.181 3.13597 3.173 3.08997 3.173C2.97497 3.173 2.86297 3.221 2.78297 3.309C2.11897 4.041 1.61597 4.904 1.30997 5.845C1.25797 6.004 1.30797 6.178 1.43597 6.286L2.72197 7.373C2.75597 7.402 2.78797 7.434 2.81697 7.468C3.11297 7.815 3.06997 8.334 2.72197 8.629L1.43597 9.716C1.30797 9.824 1.25897 9.998 1.30997 10.157C1.61497 11.098 2.11897 11.961 2.78297 12.693C2.86297 12.781 2.97497 12.829 3.08997 12.829C3.13697 12.829 3.18397 12.821 3.22897 12.805L4.81597 12.24C4.85797 12.225 4.90197 12.213 4.94597 12.205C4.99597 12.196 5.04597 12.192 5.09497 12.192C5.48697 12.192 5.83497 12.47 5.90797 12.868L6.20997 14.52C6.23997 14.684 6.36697 14.814 6.53097 14.849C7.01097 14.951 7.50297 15.002 8.00097 15.002C8.49897 15.002 8.99097 14.95 9.46997 14.849C9.63397 14.814 9.76097 14.684 9.79097 14.52L10.094 12.868C10.102 12.824 10.114 12.781 10.129 12.739C10.25 12.402 10.568 12.192 10.908 12.192C11 12.192 11.094 12.208 11.186 12.24L12.772 12.805C12.818 12.821 12.865 12.829 12.911 12.829C13.026 12.829 13.138 12.781 13.218 12.693C13.882 11.961 14.385 11.098 14.69 10.157C14.742 9.998 14.692 9.824 14.564 9.716L14.565 9.715ZM12.728 11.726L11.521 11.296C11.323 11.226 11.117 11.19 10.908 11.19C10.139 11.19 9.44697 11.676 9.18797 12.399C9.15397 12.492 9.12897 12.588 9.11097 12.686L8.88097 13.937C8.59097 13.979 8.29597 14 8.00097 14C7.70597 14 7.41097 13.979 7.11997 13.936L6.89097 12.685C6.73197 11.818 5.97697 11.189 5.09497 11.189C4.98697 11.189 4.87697 11.199 4.76597 11.219C4.66897 11.237 4.57397 11.262 4.47997 11.295L3.27297 11.725C2.90497 11.264 2.61097 10.759 2.39397 10.214L3.36797 9.391C3.74097 9.076 3.96797 8.634 4.00797 8.148C4.04797 7.662 3.89497 7.19 3.57797 6.818C3.51397 6.743 3.44297 6.672 3.36797 6.608L2.39397 5.785C2.61097 5.24 2.90497 4.734 3.27297 4.274L4.47997 4.704C4.67797 4.774 4.88397 4.81 5.09397 4.81C5.86297 4.81 6.55497 4.324 6.81397 3.601C6.84797 3.507 6.87297 3.411 6.89097 3.314L7.11997 2.063C7.41097 2.021 7.70597 1.999 8.00097 1.999C8.29597 1.999 8.59097 2.02 8.88097 2.062L9.10997 3.313C9.26897 4.18 10.024 4.809 10.906 4.809C11.014 4.809 11.124 4.799 11.234 4.779C11.331 4.761 11.427 4.736 11.521 4.703L12.728 4.273C13.096 4.733 13.39 5.239 13.607 5.784L12.634 6.607C12.261 6.922 12.033 7.364 11.994 7.85C11.954 8.336 12.107 8.809 12.424 9.18C12.489 9.256 12.559 9.326 12.635 9.39L13.609 10.213C13.392 10.758 13.098 11.264 12.73 11.724L12.728 11.726Z"/>
</svg>
""",

  "snapshot-compare.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="scBlue" x1="1" y1="1" x2="7" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="scGreen" x1="9" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="6" height="14" rx="1.6" fill="url(#scBlue)" stroke="#60a5fa" stroke-width="0.8"/>
  <rect x="9" y="1" width="6" height="14" rx="1.6" fill="url(#scGreen)" stroke="#34d399" stroke-width="0.8"/>
  <line x1="3.5" y1="4.5" x2="12.5" y2="4.5" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="3.5" y1="8" x2="12.5" y2="8" stroke="#fde047" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
  <line x1="3.5" y1="11.5" x2="12.5" y2="11.5" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "snapshot-update.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="camGrad" x1="1" y1="3" x2="15" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect x="1" y="3.5" width="14" height="10.5" rx="2.5" fill="url(#camGrad)" stroke="#60a5fa" stroke-width="0.8"/>
  <path d="M4.5 3.5L5.8 1.5H10.2L11.5 3.5" fill="#1e40af"/>
  <circle cx="8" cy="8.8" r="3.4" fill="#ffffff" stroke="#93c5fd" stroke-width="0.8"/>
  <circle cx="8" cy="8.8" r="1.8" fill="#1d4ed8"/>
  <circle cx="7.4" cy="8.2" r="0.6" fill="#93c5fd"/>
  <circle cx="13" cy="5.5" r="0.9" fill="#34d399"/>
</svg>
""",

  "switch-file.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="swBlue" x1="2" y1="2" x2="14" y2="7" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="swGreen" x1="14" y1="9" x2="2" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <path d="M2 5H11.5M11.5 5L9 2.5M11.5 5L9 7.5" stroke="url(#swBlue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 11H4.5M4.5 11L7 8.5M4.5 11L7 13.5" stroke="url(#swGreen)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "validate.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="valGrad" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="valRim" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#047857" stop-opacity="0.2"/>
    </linearGradient>
  </defs>
  <circle cx="8" cy="8" r="7" fill="url(#valGrad)"/>
  <circle cx="8" cy="8" r="6.3" stroke="url(#valRim)" stroke-width="0.8"/>
  <path d="M4.5 8.2L6.8 10.7L11.5 5.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""
}

def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    for filename, content in ICONS.items():
        filepath = os.path.join(ICONS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated: app/icons/{filename}")
    print(f"All {len(ICONS)} command icons generated successfully.")

if __name__ == '__main__':
    main()
