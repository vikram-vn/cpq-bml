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
    <linearGradient id="bladeTop" x1="1" y1="1" x2="13" y2="6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="bladeBot" x1="3" y1="10" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <!-- Dev Server blade (top-left) -->
  <rect x="0.8" y="1.2" width="10.4" height="4.4" rx="1.4" fill="url(#bladeTop)" stroke="#64748b" stroke-width="0.6"/>
  <circle cx="2.6" cy="3.4" r="0.9" fill="#10b981"/>
  <line x1="4.6" y1="3.4" x2="9.4" y2="3.4" stroke="#94a3b8" stroke-width="0.9" stroke-linecap="round"/>
  <!-- Prod Server blade (bottom-right) -->
  <rect x="4.8" y="10.4" width="10.4" height="4.4" rx="1.4" fill="url(#bladeBot)" stroke="#64748b" stroke-width="0.6"/>
  <circle cx="6.6" cy="12.6" r="0.9" fill="#0284c7"/>
  <line x1="8.6" y1="12.6" x2="13.4" y2="12.6" stroke="#94a3b8" stroke-width="0.9" stroke-linecap="round"/>
  <!-- Switch Arrow Top: curves right & down -->
  <path d="M12.6 3.4C14.2 3.4 15.2 4.6 15.2 6.4V7.2" stroke="#10b981" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M13.8 6.4L15.2 7.8L16.4 6.4" stroke="#10b981" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Switch Arrow Bottom: curves left & up -->
  <path d="M3.4 12.6C1.8 12.6 0.8 11.4 0.8 9.6V8.8" stroke="#38bdf8" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M2.2 9.6L0.8 8.2L-0.4 9.6" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "clear.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <!-- Terminal window outer frame -->
  <rect x="0.9" y="1.1" width="14.2" height="13.8" rx="2.8" fill="#181e29" stroke="#475569" stroke-width="0.9"/>
  <!-- Title bar header line -->
  <line x1="0.9" y1="4.9" x2="15.1" y2="4.9" stroke="#334155" stroke-width="0.7"/>
  <!-- Traffic light dots -->
  <circle cx="3.4" cy="3.0" r="0.8" fill="#ef4444"/>
  <circle cx="5.4" cy="3.0" r="0.8" fill="#f59e0b"/>
  <circle cx="7.4" cy="3.0" r="0.8" fill="#10b981"/>
  <!-- Blue command prompt > -->
  <path d="M3.2 7.0L6.0 9.2L3.2 11.4" stroke="#60a5fa" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Grey cursor - -->
  <rect x="7.6" y="10.4" width="2.8" height="1.4" rx="0.7" fill="#94a3b8"/>
  <!-- Red delete 'X' badge at bottom-right -->
  <circle cx="11.8" cy="11.4" r="3.7" fill="#dc2626" stroke="#0f172a" stroke-width="0.9"/>
  <!-- White cross lines -->
  <line x1="10.2" y1="9.8" x2="13.4" y2="13.0" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="13.4" y1="9.8" x2="10.2" y2="13.0" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
</svg>
""",

  "create-bml.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="docBml" x1="1" y1="1" x2="11" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="plusBadge" x1="7" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
  </defs>
  <!-- Function Document -->
  <path d="M1.2 2.0C1.2 1.4 1.7 1.0 2.4 1.0H8.0L11.5 4.5V13.8C11.5 14.4 11.0 14.8 10.3 14.8H2.4C1.7 14.8 1.2 14.4 1.2 13.8V2.0Z" fill="url(#docBml)" stroke="#a5b4fc" stroke-width="0.5"/>
  <path d="M8.0 1.0V4.5H11.5" fill="#c7d2fe"/>
  <!-- BML function curly braces {} inside document -->
  <path d="M4.6 6.0C3.8 6.0 3.4 6.8 3.4 7.8C3.4 8.8 3.8 9.6 4.6 9.6" stroke="#fde047" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M8.0 6.0C8.8 6.0 9.2 6.8 9.2 7.8C9.2 8.8 8.8 9.6 8.0 9.6" stroke="#fde047" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="5.6" y1="7.8" x2="7.0" y2="7.8" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <!-- Plus badge at bottom-right (Create New) -->
  <circle cx="11.8" cy="11.4" r="3.6" fill="url(#plusBadge)" stroke="#0f172a" stroke-width="0.9"/>
  <line x1="11.8" y1="9.4" x2="11.8" y2="13.4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
  <line x1="9.8" y1="11.4" x2="13.8" y2="11.4" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
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

  "debug.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
  <defs>
    <linearGradient id="greenPlay" x1="6" y1="4" x2="20" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <linearGradient id="orangeBug" x1="1" y1="12" x2="12" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <!-- Subtle inner tint for depth -->
  <polygon points="7,5.5 19,12 12,16.5 7,11" fill="#22c55e" opacity="0.2"/>
  <!-- Green run play triangle -->
  <path d="M19.854 13.9605L13.2105 17.697C12.954 17.22 12.5505 16.8345 12.039 16.641L12.054 16.626L19.1175 12.6525C19.6275 12.366 19.6275 11.6325 19.1175 11.3445L7.11751 4.59599C6.61801 4.31399 6.00001 4.67549 6.00001 5.24999V10.5C5.46901 10.5 4.97401 10.6215 4.50001 10.791V5.24999C4.50001 3.52949 6.35251 2.44499 7.85251 3.28949L19.8525 10.0395C21.381 10.899 21.381 13.101 19.8525 13.962L19.854 13.9605Z" fill="url(#greenPlay)"/>
  <!-- Orange debug bug -->
  <path d="M10.5 16.0605V18H11.25C11.664 18 12 18.336 12 18.75C12 19.164 11.664 19.5 11.25 19.5H10.5C10.5 20.076 10.3905 20.625 10.1925 21.132L11.781 22.7205C12.0735 23.013 12.0735 23.4885 11.781 23.781C11.634 23.928 11.442 24 11.25 24C11.058 24 10.866 23.9265 10.719 23.781L9.39151 22.4535C8.56651 23.4 7.35151 24.0015 6.00001 24.0015C4.64851 24.0015 3.43351 23.4015 2.60851 22.4535L1.28101 23.781C1.13401 23.928 0.942009 24 0.750009 24C0.558009 24 0.366009 23.9265 0.219009 23.781C-0.0734912 23.4885 -0.0734912 23.013 0.219009 22.7205L1.80751 21.132C1.60951 20.625 1.50001 20.076 1.50001 19.5H0.750009C0.336009 19.5 8.78423e-06 19.164 8.78423e-06 18.75C8.78423e-06 18.336 0.336009 18 0.750009 18H1.50001V16.0605L0.219009 14.7795C-0.0734912 14.487 -0.0734912 14.0115 0.219009 13.719C0.511509 13.4265 0.987009 13.4265 1.27951 13.719L2.56051 15H3.00001C3.00001 13.3455 4.34551 12 6.00001 12C7.65451 12 9.00001 13.3455 9.00001 15H9.43951L10.7205 13.719C11.013 13.4265 11.4885 13.4265 11.781 13.719C12.0735 14.0115 12.0735 14.487 11.781 14.7795L10.5 16.0605ZM4.50001 15H7.50001C7.50001 14.172 6.82801 13.5 6.00001 13.5C5.17201 13.5 4.50001 14.172 4.50001 15ZM9.00001 16.5H3.00001V19.5C3.00001 21.1545 4.34551 22.5 6.00001 22.5C7.65451 22.5 9.00001 21.1545 9.00001 19.5V16.5Z" fill="url(#orangeBug)"/>
</svg>
""",

  "debug-configure.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
  <defs>
    <linearGradient id="greenPlayCfg" x1="6" y1="4" x2="20" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <linearGradient id="orangeBugCfg" x1="1" y1="12" x2="12" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="gearMetalCfg" x1="-5" y1="-5" x2="5" y2="5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="40%" stop-color="#cbd5e1"/>
      <stop offset="80%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
  </defs>
  <!-- Subtle inner tint for depth -->
  <polygon points="7,5.5 19,12 12,16.5 7,11" fill="#22c55e" opacity="0.2"/>
  <!-- Green run play triangle -->
  <path d="M19.854 13.9605L13.2105 17.697C12.954 17.22 12.5505 16.8345 12.039 16.641L12.054 16.626L19.1175 12.6525C19.6275 12.366 19.6275 11.6325 19.1175 11.3445L7.11751 4.59599C6.61801 4.31399 6.00001 4.67549 6.00001 5.24999V10.5C5.46901 10.5 4.97401 10.6215 4.50001 10.791V5.24999C4.50001 3.52949 6.35251 2.44499 7.85251 3.28949L19.8525 10.0395C21.381 10.899 21.381 13.101 19.8525 13.962L19.854 13.9605Z" fill="url(#greenPlayCfg)"/>
  <!-- Orange debug bug -->
  <path d="M10.5 16.0605V18H11.25C11.664 18 12 18.336 12 18.75C12 19.164 11.664 19.5 11.25 19.5H10.5C10.5 20.076 10.3905 20.625 10.1925 21.132L11.781 22.7205C12.0735 23.013 12.0735 23.4885 11.781 23.781C11.634 23.928 11.442 24 11.25 24C11.058 24 10.866 23.9265 10.719 23.781L9.39151 22.4535C8.56651 23.4 7.35151 24.0015 6.00001 24.0015C4.64851 24.0015 3.43351 23.4015 2.60851 22.4535L1.28101 23.781C1.13401 23.928 0.942009 24 0.750009 24C0.558009 24 0.366009 23.9265 0.219009 23.781C-0.0734912 23.4885 -0.0734912 23.013 0.219009 22.7205L1.80751 21.132C1.60951 20.625 1.50001 20.076 1.50001 19.5H0.750009C0.336009 19.5 8.78423e-06 19.164 8.78423e-06 18.75C8.78423e-06 18.336 0.336009 18 0.750009 18H1.50001V16.0605L0.219009 14.7795C-0.0734912 14.487 -0.0734912 14.0115 0.219009 13.719C0.511509 13.4265 0.987009 13.4265 1.27951 13.719L2.56051 15H3.00001C3.00001 13.3455 4.34551 12 6.00001 12C7.65451 12 9.00001 13.3455 9.00001 15H9.43951L10.7205 13.719C11.013 13.4265 11.4885 13.4265 11.781 13.719C12.0735 14.0115 12.0735 14.487 11.781 14.7795L10.5 16.0605ZM4.50001 15H7.50001C7.50001 14.172 6.82801 13.5 6.00001 13.5C5.17201 13.5 4.50001 14.172 4.50001 15ZM9.00001 16.5H3.00001V19.5C3.00001 21.1545 4.34551 22.5 6.00001 22.5C7.65451 22.5 9.00001 21.1545 9.00001 19.5V16.5Z" fill="url(#orangeBugCfg)"/>
  <!-- Configuration mechanical gear badge at bottom-right -->
  <circle cx="18" cy="18" r="5.5" fill="#0f172a" stroke="#16a34a" stroke-width="0.8"/>
  <g transform="translate(18, 16.5) scale(0.55)">
    <path d="M-1.5 -5H1.5L1.9 -3C2.5 -2.7 3.1 -2.3 3.6 -1.9L5.5 -2.7L7.0 -0.1L5.5 1.4C5.6 1.7 5.6 1.9 5.6 2.2C5.6 2.5 5.6 2.7 5.5 3.0L7.0 4.5L5.5 7.1L3.6 6.3C3.1 6.7 2.5 7.1 1.9 7.4L1.5 9.4H-1.5L-1.9 7.4C-2.5 7.1 -3.1 6.7 -3.6 6.3L-5.5 7.1L-7.0 4.5L-5.5 3.0C-5.6 2.7 -5.6 2.5 -5.6 2.2C-5.6 1.9 -5.6 1.7 -5.5 1.4L-7.0 -0.1L-5.5 -2.7L-3.6 -1.9C-3.1 -2.3 -2.5 -2.7 -1.9 -3L-1.5 -5Z" fill="url(#gearMetalCfg)" stroke="#e2e8f0" stroke-width="0.5"/>
    <circle cx="0" cy="2.2" r="1.8" fill="#0f172a"/>
    <circle cx="0" cy="2.2" r="0.8" fill="#94a3b8"/>
  </g>
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
    <linearGradient id="commHull" x1="4" y1="1" x2="15" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="35%" stop-color="#f97316"/>
      <stop offset="85%" stop-color="#c2410c"/>
    </linearGradient>
  </defs>
  <!-- Rocket exhaust flames -->
  <path d="M3.8 10.2C2.8 11.4 1.8 12.8 0.6 15.4C3.2 14.2 4.6 13.2 5.8 12.2Z" fill="#f97316"/>
  <path d="M3.2 10.8C2.6 11.6 1.8 12.6 1.2 14.4C2.8 13.6 3.8 12.8 4.6 12.2Z" fill="#fde047"/>
  <!-- Rocket fins -->
  <path d="M4.6 6.6L1.4 8.2L2.2 11.4L4.0 9.8Z" fill="#ea580c"/>
  <path d="M9.4 11.4L7.8 14.6L4.6 13.8L6.2 12.0Z" fill="#ea580c"/>
  <!-- Rocket hull -->
  <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#commHull)" stroke="#ea580c" stroke-width="0.4"/>
  <!-- Porthole window -->
  <circle cx="10.2" cy="5.8" r="1.6" fill="#ffffff" stroke="#9a3412" stroke-width="0.5"/>
  <circle cx="10.2" cy="5.8" r="1.0" fill="#38bdf8"/>
  <!-- Commerce shopping cart badge at bottom-right -->
  <circle cx="12.4" cy="12.4" r="3.4" fill="#0f172a" stroke="#f59e0b" stroke-width="0.7"/>
  <!-- Cart body -->
  <path d="M10.4 10.8H11.1L11.8 13.0H13.8L14.4 11.5H11.5" stroke="#fbbf24" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Cart wheels -->
  <circle cx="11.8" cy="14.0" r="0.45" fill="#ffffff"/>
  <circle cx="13.6" cy="14.0" r="0.45" fill="#ffffff"/>
</svg>
""",

  "deploy-mass.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="mainRkt" x1="6" y1="1" x2="16" y2="11" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </linearGradient>
    <linearGradient id="wingRkt" x1="2" y1="5" x2="11" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#bae6fd"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#075985"/>
    </linearGradient>
  </defs>
  <!-- Wing rocket 1 (top-left wingman) -->
  <g transform="translate(-2.2, 2.2) scale(0.68)">
    <path d="M3.4 10.4C2.2 12.0 1.2 13.8 0.2 16.0C2.4 15.0 4.2 14.0 5.4 12.8Z" fill="#f97316"/>
    <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#wingRkt)"/>
  </g>
  <!-- Wing rocket 2 (bottom-right wingman) -->
  <g transform="translate(3.2, -1.8) scale(0.68)">
    <path d="M3.4 10.4C2.2 12.0 1.2 13.8 0.2 16.0C2.4 15.0 4.2 14.0 5.4 12.8Z" fill="#f97316"/>
    <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#wingRkt)"/>
  </g>
  <!-- Flagship Lead Rocket (center) -->
  <!-- Exhaust -->
  <path d="M3.8 10.2C2.8 11.4 1.8 12.8 0.6 15.4C3.2 14.2 4.6 13.2 5.8 12.2Z" fill="#ea580c"/>
  <path d="M3.2 10.8C2.6 11.6 1.8 12.6 1.2 14.4C2.8 13.6 3.8 12.8 4.6 12.2Z" fill="#fde047"/>
  <!-- Fins -->
  <path d="M4.6 6.6L1.4 8.2L2.2 11.4L4.0 9.8Z" fill="#b45309"/>
  <path d="M9.4 11.4L7.8 14.6L4.6 13.8L6.2 12.0Z" fill="#b45309"/>
  <!-- Hull -->
  <path d="M15.4 0.6C11.6 1.4 6.0 5.0 3.8 10.0L6.0 12.2C11.0 10.0 14.6 4.4 15.4 0.6Z" fill="url(#mainRkt)" stroke="#ca8a04" stroke-width="0.5"/>
  <!-- Porthole -->
  <circle cx="10.2" cy="5.8" r="1.4" fill="#ffffff" stroke="#854d0e" stroke-width="0.4"/>
  <circle cx="10.2" cy="5.8" r="0.8" fill="#0284c7"/>
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
    <linearGradient id="codeDocGrad" x1="1" y1="1" x2="11" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="diskBadge" x1="7" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <!-- Script code document (left/background) -->
  <path d="M1.2 2.0C1.2 1.4 1.7 1.0 2.4 1.0H7.8L11.0 4.2V13.8C11.0 14.4 10.5 14.8 9.8 14.8H2.4C1.7 14.8 1.2 14.4 1.2 13.8V2.0Z" fill="url(#codeDocGrad)" stroke="#7dd3fc" stroke-width="0.5"/>
  <path d="M7.8 1.0V4.2H11.0" fill="#bae6fd"/>
  <!-- Code script lines / curly brace {} inside document -->
  <path d="M4.0 5.2C3.4 5.2 3.1 5.7 3.1 6.4C3.1 7.1 3.4 7.6 4.0 7.6M6.4 5.2C7.0 5.2 7.3 5.7 7.3 6.4C7.3 7.1 7.0 7.6 6.4 7.6" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="3.2" y1="9.6" x2="6.8" y2="9.6" stroke="#bae6fd" stroke-width="0.8" stroke-linecap="round"/>
  <line x1="3.2" y1="11.6" x2="5.5" y2="11.6" stroke="#bae6fd" stroke-width="0.8" stroke-linecap="round"/>
  <!-- Save Floppy Disk badge at bottom-right -->
  <rect x="7.2" y="7.2" width="7.6" height="7.6" rx="1.2" fill="url(#diskBadge)" stroke="#0f172a" stroke-width="0.8"/>
  <!-- Disk metal slider -->
  <rect x="8.8" y="7.2" width="4.4" height="2.8" rx="0.4" fill="#cbd5e1"/>
  <rect x="11.6" y="7.8" width="1.0" height="1.6" fill="#1e293b"/>
  <!-- Disk label -->
  <rect x="8.4" y="11.2" width="5.2" height="2.6" rx="0.4" fill="#f8fafc"/>
  <line x1="9.4" y1="12.4" x2="12.6" y2="12.4" stroke="#0284c7" stroke-width="0.6"/>
</svg>
""",

  "settings.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="gearMetal" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="15%" stop-color="#e2e8f0"/>
      <stop offset="45%" stop-color="#94a3b8"/>
      <stop offset="75%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="metalRim" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#cbd5e1"/>
      <stop offset="80%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <radialGradient id="hubRecess" cx="7.2" cy="7.2" r="3.2" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="70%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </radialGradient>
    <linearGradient id="axleCollar" x1="6" y1="6" x2="10" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <radialGradient id="axleHole" cx="7.2" cy="7.2" r="1.8" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="80%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </radialGradient>
  </defs>
  <!-- Industrial drop shadow -->
  <path d="M6.5 0.8H9.5L9.9 2.8C10.5 3.1 11.1 3.5 11.6 3.9L13.5 3.1L15.0 5.7L13.5 7.2C13.6 7.5 13.6 7.7 13.6 8C13.6 8.3 13.6 8.5 13.5 8.8L15.0 10.3L13.5 12.9L11.6 12.1C11.1 12.5 10.5 12.9 9.9 13.2L9.5 15.2H6.5L6.1 13.2C5.5 12.9 4.9 12.5 4.4 12.1L2.5 12.9L1.0 10.3L2.5 8.8C2.4 8.5 2.4 8.3 2.4 8C2.4 7.7 2.4 7.5 2.5 7.2L1.0 5.7L2.5 3.1L4.4 3.9C4.9 3.5 5.5 3.1 6.1 2.8L6.5 0.8Z" fill="#090d16" transform="translate(0, 0.6)" opacity="0.6"/>
  <!-- Machined steel gear body -->
  <path d="M6.5 0.8H9.5L9.9 2.8C10.5 3.1 11.1 3.5 11.6 3.9L13.5 3.1L15.0 5.7L13.5 7.2C13.6 7.5 13.6 7.7 13.6 8C13.6 8.3 13.6 8.5 13.5 8.8L15.0 10.3L13.5 12.9L11.6 12.1C11.1 12.5 10.5 12.9 9.9 13.2L9.5 15.2H6.5L6.1 13.2C5.5 12.9 4.9 12.5 4.4 12.1L2.5 12.9L1.0 10.3L2.5 8.8C2.4 8.5 2.4 8.3 2.4 8C2.4 7.7 2.4 7.5 2.5 7.2L1.0 5.7L2.5 3.1L4.4 3.9C4.9 3.5 5.5 3.1 6.1 2.8L6.5 0.8Z" fill="url(#gearMetal)" stroke="url(#metalRim)" stroke-width="0.5" stroke-linejoin="round"/>
  <!-- Recessed circular gear web -->
  <circle cx="8" cy="8" r="4.6" fill="url(#hubRecess)" stroke="#090d16" stroke-width="0.5"/>
  <!-- Mechanical chamfer ring -->
  <circle cx="8" cy="8" r="3.9" fill="none" stroke="#64748b" stroke-width="0.35" opacity="0.8"/>
  <!-- Raised axle hub collar -->
  <circle cx="8" cy="8" r="2.9" fill="url(#axleCollar)" stroke="#ffffff" stroke-width="0.4"/>
  <!-- Drive axle bore -->
  <circle cx="8" cy="8" r="1.7" fill="url(#axleHole)" stroke="#090d16" stroke-width="0.35"/>
  <!-- Drive shaft keyway slot -->
  <rect x="7.45" y="5.9" width="1.1" height="0.85" rx="0.15" fill="#020617"/>
  <!-- Specular reflection dot on collar -->
  <circle cx="6.8" cy="6.8" r="0.4" fill="#ffffff" opacity="0.8"/>
</svg>
""",

  "snapshot-compare.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="diffLeft" x1="1" y1="1" x2="7" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="diffRight" x1="9" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <!-- Frame outline -->
  <rect x="1.0" y="1.2" width="14.0" height="13.6" rx="2.0" fill="#0f172a" stroke="#475569" stroke-width="0.7"/>
  <!-- Left pane (original / deleted) -->
  <path d="M1.2 2.2C1.2 1.6 1.6 1.2 2.2 1.2H7.5V14.8H2.2C1.6 14.8 1.2 14.4 1.2 13.8V2.2Z" fill="url(#diffLeft)"/>
  <!-- Red deletion lines -->
  <line x1="2.8" y1="4.2" x2="6.2" y2="4.2" stroke="#f87171" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="2.8" y1="7.2" x2="5.4" y2="7.2" stroke="#f87171" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="2.8" y1="10.2" x2="6.2" y2="10.2" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <!-- Right pane (new / added) -->
  <path d="M8.5 1.2H13.8C14.4 1.2 14.8 1.6 14.8 2.2V13.8C14.8 14.4 14.4 14.8 13.8 14.8H8.5V1.2Z" fill="url(#diffRight)"/>
  <!-- Green addition lines -->
  <line x1="9.8" y1="4.2" x2="13.2" y2="4.2" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="9.8" y1="7.2" x2="13.2" y2="7.2" stroke="#34d399" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="9.8" y1="10.2" x2="12.4" y2="10.2" stroke="#34d399" stroke-width="1.2" stroke-linecap="round"/>
  <!-- Center dividing slider line with arrows -->
  <line x1="8.0" y1="1.2" x2="8.0" y2="14.8" stroke="#38bdf8" stroke-width="0.9"/>
  <circle cx="8.0" cy="8.0" r="1.4" fill="#38bdf8"/>
</svg>
""",

  "snapshot-update.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="camBody" x1="1" y1="3" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Camera body -->
  <rect x="1.0" y="3.8" width="13.0" height="10.2" rx="2.2" fill="url(#camBody)" stroke="#64748b" stroke-width="0.7"/>
  <!-- Pentaprism top housing -->
  <path d="M4.4 3.8L5.8 1.8H9.2L10.6 3.8Z" fill="#334155" stroke="#64748b" stroke-width="0.5"/>
  <!-- Flash & sensor -->
  <circle cx="3.4" cy="5.8" r="0.7" fill="#ef4444"/>
  <!-- Main camera lens -->
  <circle cx="7.2" cy="8.9" r="3.1" fill="#0f172a" stroke="#cbd5e1" stroke-width="0.6"/>
  <circle cx="7.2" cy="8.9" r="2.1" fill="#0284c7"/>
  <circle cx="6.5" cy="8.2" r="0.7" fill="#ffffff" opacity="0.8"/>
  <!-- Update / Sync Circular Arrows Badge at bottom-right -->
  <circle cx="12.5" cy="12.2" r="3.3" fill="#0f172a" stroke="#10b981" stroke-width="0.7"/>
  <!-- Circular update arrows -->
  <path d="M11.0 12.2C11.0 11.4 11.7 10.7 12.5 10.7C13.2 10.7 13.8 11.2 14.0 11.8" stroke="#34d399" stroke-width="0.7" stroke-linecap="round"/>
  <path d="M13.4 11.5L14.0 11.8L14.2 11.2" stroke="#34d399" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.0 12.2C14.0 13.0 13.3 13.7 12.5 13.7C11.8 13.7 11.2 13.2 11.0 12.6" stroke="#34d399" stroke-width="0.7" stroke-linecap="round"/>
  <path d="M11.6 12.9L11.0 12.6L10.8 13.2" stroke="#34d399" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "switch-file.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="fileA" x1="1" y1="1" x2="9" y2="11" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="fileB" x1="7" y1="5" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <!-- Rear file (top-left, .bml header/impl) -->
  <path d="M1.5 1.5H6.5L8.5 3.5V8.5C8.5 9.1 8.1 9.5 7.5 9.5H1.5C0.9 9.5 0.5 9.1 0.5 8.5V2.5C0.5 1.9 0.9 1.5 1.5 1.5Z" fill="url(#fileA)" stroke="#bae6fd" stroke-width="0.6"/>
  <line x1="2.2" y1="4.0" x2="5.5" y2="4.0" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>
  <line x1="2.2" y1="6.0" x2="6.8" y2="6.0" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>
  <!-- Front file (bottom-right) -->
  <path d="M8.5 6.5H13.5L15.5 8.5V13.5C15.5 14.1 15.1 14.5 14.5 14.5H8.5C7.9 14.5 7.5 14.1 7.5 13.5V7.5C7.5 6.9 7.9 6.5 8.5 6.5Z" fill="url(#fileB)" stroke="#a7f3d0" stroke-width="0.6"/>
  <line x1="9.2" y1="9.0" x2="12.5" y2="9.0" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>
  <line x1="9.2" y1="11.0" x2="13.8" y2="11.0" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>
  <!-- Curved swap arrows between files -->
  <!-- Forward swap arrow: top-right to bottom -->
  <path d="M10.2 2.2C12.4 2.2 13.8 3.4 13.8 5.2" stroke="#f59e0b" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M12.6 4.6L13.8 5.6L14.8 4.4" stroke="#f59e0b" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Return swap arrow: bottom-left to top -->
  <path d="M5.8 13.8C3.6 13.8 2.2 12.6 2.2 10.8" stroke="#f59e0b" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M3.4 11.4L2.2 10.4L1.2 11.6" stroke="#f59e0b" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "validate.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="valDoc" x1="1" y1="1" x2="11" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="checkBadge" x1="7" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <!-- Script document -->
  <path d="M1.2 2.0C1.2 1.4 1.7 1.0 2.4 1.0H8.0L11.5 4.5V13.8C11.5 14.4 11.0 14.8 10.3 14.8H2.4C1.7 14.8 1.2 14.4 1.2 13.8V2.0Z" fill="url(#valDoc)" stroke="#64748b" stroke-width="0.6"/>
  <path d="M8.0 1.0V4.5H11.5" fill="#475569"/>
  <!-- Code lines being validated -->
  <line x1="3.0" y1="4.2" x2="6.2" y2="4.2" stroke="#38bdf8" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="3.0" y1="6.8" x2="7.5" y2="6.8" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="3.0" y1="9.4" x2="6.0" y2="9.4" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="3.0" y1="12.0" x2="5.0" y2="12.0" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <!-- Syntax Approved Checkmark Badge at bottom-right -->
  <circle cx="11.5" cy="11.5" r="3.7" fill="url(#checkBadge)" stroke="#0f172a" stroke-width="0.9"/>
  <path d="M9.8 11.5L11.0 12.8L13.4 10.0" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
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
    print(f"All {len(EDITOR_ICONS)} editor icons generated successfully.")

if __name__ == '__main__':
    main()
