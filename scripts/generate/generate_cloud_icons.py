"""
generate_cloud_icons.py
Generates the 14 vibrant, colorful Cloud Explorer and view action icons in app/icons/cloud/:
- refresh.svg         (Vibrant electric cyan dual circular sweeping arrows)
- search.svg          (Vibrant optical magnifying glass with azure rim & specular reflection)
- filter.svg          (Vibrant electric indigo funnel with 3 filtration bars & cyan filtrate)
- clear-filter.svg    (Vibrant indigo funnel with luminous ruby red cancel badge)
- sync.svg            (Vibrant dual planetary orbital sync arrows in emerald & cyan)
- pull.svg            (Vibrant cyan cloud with emerald downward download plunge arrow)
- diff.svg            (Vibrant side-by-side comparison panes in amber & emerald)
- switch-process.svg  (Vibrant dual workflow arrows in orange & blue with process node)
- query.svg           (Vibrant 2-tier database cylinder tower in azure with gold query lens)
- export-csv.svg      (Vibrant emerald spreadsheet table plate with export arrow)
- inspect-tx.svg      (Vibrant sapphire transaction ledger card with inspection lens)
- debug-tx.svg        (Vibrant transaction document with diagnostic orange beetle bug badge)
- copy-id.svg         (Vibrant smart ID badge with gold microchip, avatar box & data tracks)
- task-details.svg    (Vibrant task clipboard with metallic clamp & emerald checkmarks)

Fully self-contained with no external dependencies beyond Python standard library.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLOUD_ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'cloud')

CLOUD_ICONS = {
  "refresh.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cRef1" x1="1" y1="2" x2="15" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="cRef2" x1="15" y1="14" x2="1" y2="6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <path d="M14.0 6.0C13.2 3.4 10.8 1.5 8.0 1.5C4.7 1.5 2.0 4.0 1.6 7.2" stroke="url(#cRef1)" stroke-width="2.0" stroke-linecap="round"/>
  <path d="M10.8 6.0H14.5V2.3" stroke="url(#cRef1)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2.0 10.0C2.8 12.6 5.2 14.5 8.0 14.5C11.3 14.5 14.0 12.0 14.4 8.8" stroke="url(#cRef2)" stroke-width="2.0" stroke-linecap="round"/>
  <path d="M5.2 10.0H1.5V13.7" stroke="url(#cRef2)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "search.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cSchGrad" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <circle cx="6.5" cy="6.5" r="4.5" stroke="url(#cSchGrad)" stroke-width="1.8"/>
  <path d="M4.5 5.5A2.2 2.2 0 0 1 6.5 4.3" stroke="#ffffff" stroke-width="0.8" stroke-linecap="round"/>
  <line x1="10.0" y1="10.0" x2="14.2" y2="14.2" stroke="url(#cSchGrad)" stroke-width="2.2" stroke-linecap="round"/>
</svg>
""",

  "filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="fbBody" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/><stop offset="40%" stop-color="#6366f1"/><stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
    <linearGradient id="fbRim" x1="1" y1="1" x2="15" y2="3" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e0e7ff"/><stop offset="50%" stop-color="#a5b4fc"/><stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.2" width="14.0" height="2.4" rx="1.2" fill="url(#fbRim)" stroke="#312e81" stroke-width="0.5"/>
  <line x1="2.4" y1="1.8" x2="13.6" y2="1.8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" opacity="0.85"/>
  <path d="M2.0 3.6H14.0L9.8 9.0V14.5C9.8 14.8 9.5 15.0 9.2 15.0H6.8C6.5 15.0 6.2 14.8 6.2 14.5V9.0L2.0 3.6Z" fill="url(#fbBody)" stroke="#312e81" stroke-width="0.5" stroke-linejoin="round"/>
  <line x1="2.8" y1="4.0" x2="6.6" y2="8.8" stroke="#ffffff" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
  <line x1="3.8" y1="5.2" x2="12.2" y2="5.2" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
  <line x1="5.2" y1="7.0" x2="10.8" y2="7.0" stroke="#bae6fd" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="6.8" y1="8.8" x2="9.2" y2="8.8" stroke="#38bdf8" stroke-width="1.0" stroke-linecap="round"/>
  <rect x="7.4" y="10.2" width="1.2" height="3.8" rx="0.6" fill="#38bdf8"/>
</svg>
""",

  "clear-filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cfBody" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/><stop offset="40%" stop-color="#6366f1"/><stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
    <linearGradient id="cfRim" x1="1" y1="1" x2="15" y2="3" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#e0e7ff"/><stop offset="50%" stop-color="#a5b4fc"/><stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <linearGradient id="cfBadge" x1="8.5" y1="8.5" x2="15.5" y2="15.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/><stop offset="40%" stop-color="#e11d48"/><stop offset="100%" stop-color="#9f1239"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.2" width="14.0" height="2.4" rx="1.2" fill="url(#cfRim)" stroke="#312e81" stroke-width="0.5"/>
  <line x1="2.4" y1="1.8" x2="13.6" y2="1.8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" opacity="0.6"/>
  <path d="M2.0 3.6H14.0L9.8 9.0V14.5C9.8 14.8 9.5 15.0 9.2 15.0H6.8C6.5 15.0 6.2 14.8 6.2 14.5V9.0L2.0 3.6Z" fill="url(#cfBody)" stroke="#312e81" stroke-width="0.5" stroke-linejoin="round"/>
  <line x1="3.8" y1="5.2" x2="12.2" y2="5.2" stroke="#cbd5e1" stroke-width="1.0" stroke-linecap="round" stroke-dasharray="1.8 1.4"/>
  <line x1="5.2" y1="7.0" x2="9.5" y2="7.0" stroke="#a5b4fc" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="1.5 1.2"/>
  <circle cx="11.5" cy="11.5" r="4.3" fill="#0f172a"/>
  <circle cx="11.5" cy="11.5" r="3.7" fill="url(#cfBadge)" stroke="#fda4af" stroke-width="0.7"/>
  <ellipse cx="11.5" cy="9.3" rx="1.8" ry="0.7" fill="#ffffff" opacity="0.45"/>
  <path d="M9.8 9.8L13.2 13.2M13.2 9.8L9.8 13.2" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
</svg>
""",

  "sync.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cSyncGreen" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="cSyncCyan" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <path d="M2.5 8.0A5.5 5.5 0 0 1 12.0 4.2" stroke="url(#cSyncGreen)" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M12.0 1.5V4.5H9.0" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.5 8.0A5.5 5.5 0 0 1 4.0 11.8" stroke="url(#cSyncCyan)" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M4.0 14.5V11.5H7.0" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="8" cy="8" r="1.8" fill="#0f172a" stroke="#34d399" stroke-width="0.8"/>
  <circle cx="8" cy="8" r="0.8" fill="#34d399"/>
</svg>
""",

  "pull.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cPullCld" x1="2" y1="1" x2="14" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="cPullArr" x1="8" y1="6" x2="8" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <path d="M4.5 10.0C3.0 10.0 1.5 8.8 1.5 7.2C1.5 5.8 2.6 4.7 4.0 4.5C4.5 2.5 6.2 1.2 8.2 1.2C10.5 1.2 12.3 2.8 12.6 5.0C13.8 5.2 14.8 6.2 14.8 7.5C14.8 9.0 13.5 10.0 12.0 10.0" stroke="url(#cPullCld)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M8.0 6.5V14.5M8.0 14.5L5.5 12.0M8.0 14.5L10.5 12.0" stroke="url(#cPullArr)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="3.5" y1="15.2" x2="12.5" y2="15.2" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "diff.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cDiffLeft" x1="1" y1="1" x2="7" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/><stop offset="50%" stop-color="#ea580c"/><stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
    <linearGradient id="cDiffRight" x1="9" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/><stop offset="50%" stop-color="#059669"/><stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.5" width="6.0" height="13.0" rx="1.5" fill="url(#cDiffLeft)" stroke="#fdba74" stroke-width="0.7"/>
  <line x1="2.5" y1="4.5" x2="5.5" y2="4.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="2.5" y1="7.5" x2="5.5" y2="7.5" stroke="#ffedd5" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="2.5" y1="10.5" x2="5.5" y2="10.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <rect x="9.0" y="1.5" width="6.0" height="13.0" rx="1.5" fill="url(#cDiffRight)" stroke="#6ee7b7" stroke-width="0.7"/>
  <line x1="10.5" y1="4.5" x2="13.5" y2="4.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.5" y1="7.5" x2="13.5" y2="7.5" stroke="#d1fae5" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.5" y1="10.5" x2="13.5" y2="10.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
</svg>
""",

  "switch-process.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="spOrange" x1="2" y1="2" x2="14" y2="7" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="spBlue" x1="14" y1="9" x2="2" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <path d="M2.5 4.8H13.5M13.5 4.8L10.5 2.0M13.5 4.8L10.5 7.6" stroke="url(#spOrange)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.5 11.2H2.5M2.5 11.2L5.5 8.4M2.5 11.2L5.5 14.0" stroke="url(#spBlue)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="8" cy="8" r="2.2" fill="#0f172a" stroke="#fb923c" stroke-width="1.0"/>
  <circle cx="8" cy="8" r="1.0" fill="#fb923c"/>
</svg>
""",

  "query.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="qdbBody" x1="1" y1="1" x2="11" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="45%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="qdbLens" x1="8" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fde047"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <ellipse cx="5.8" cy="3.2" rx="4.8" ry="1.8" fill="url(#qdbBody)" stroke="#7dd3fc" stroke-width="0.7"/>
  <path d="M1.0 3.2V7.4C1.0 8.5 3.1 9.4 5.8 9.4C8.5 9.4 10.6 8.5 10.6 7.4V3.2" fill="url(#qdbBody)" stroke="#7dd3fc" stroke-width="0.7"/>
  <path d="M1.0 7.4V11.8C1.0 12.9 3.1 13.8 5.8 13.8C8.5 13.8 10.6 12.9 10.6 11.8V7.4" fill="url(#qdbBody)" stroke="#7dd3fc" stroke-width="0.7"/>
  <circle cx="3.0" cy="5.4" r="0.7" fill="#34d399"/>
  <circle cx="3.0" cy="9.8" r="0.7" fill="#34d399"/>
  <line x1="4.8" y1="5.4" x2="8.8" y2="5.4" stroke="#bae6fd" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="4.8" y1="9.8" x2="7.8" y2="9.8" stroke="#bae6fd" stroke-width="0.9" stroke-linecap="round"/>
  <circle cx="11.2" cy="10.4" r="4.2" fill="#0f172a"/>
  <circle cx="11.2" cy="10.4" r="3.4" fill="#0f172a" stroke="url(#qdbLens)" stroke-width="1.3"/>
  <circle cx="11.2" cy="10.4" r="2.2" fill="#38bdf8" fill-opacity="0.3"/>
  <path d="M10.0 10.4A1.2 1.2 0 0 1 11.2 9.2" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>
  <line x1="13.6" y1="12.8" x2="15.5" y2="14.8" stroke="url(#qdbLens)" stroke-width="2.0" stroke-linecap="round"/>
</svg>
""",

  "export-csv.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cCsvTable" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/><stop offset="50%" stop-color="#059669"/><stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="13.0" height="13.0" rx="2.0" fill="url(#cCsvTable)" stroke="#6ee7b7" stroke-width="0.7"/>
  <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="#a7f3d0" stroke-width="0.8"/>
  <line x1="5.8" y1="1.5" x2="5.8" y2="5.5" stroke="#a7f3d0" stroke-width="0.8"/>
  <line x1="10.2" y1="1.5" x2="10.2" y2="5.5" stroke="#a7f3d0" stroke-width="0.8"/>
  <path d="M8.0 7.0V12.0M8.0 12.0L5.5 9.5M8.0 12.0L10.5 9.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "inspect-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="txDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="inspLens" x1="7" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#txDoc)" stroke="#7dd3fc" stroke-width="0.6"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#bae6fd"/>
  <line x1="4.0" y1="6.5" x2="9.0" y2="6.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="9.0" x2="7.5" y2="9.0" stroke="#bae6fd" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="11.5" x2="6.5" y2="11.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="11.2" cy="11.2" r="3.2" fill="#0f172a" stroke="url(#inspLens)" stroke-width="1.2"/>
  <line x1="13.4" y1="13.4" x2="15.2" y2="15.2" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
</svg>
""",

  "debug-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="txDebugDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="txBug" x1="9" y1="8" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#txDebugDoc)" stroke="#7dd3fc" stroke-width="0.6"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#bae6fd"/>
  <line x1="4.0" y1="6.5" x2="9.0" y2="6.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="9.0" x2="7.5" y2="9.0" stroke="#bae6fd" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="11.8" cy="11.8" r="3.4" fill="#0f172a" stroke="#ea580c" stroke-width="0.8"/>
  <circle cx="11.8" cy="10.2" r="1.0" fill="#ea580c"/>
  <path d="M9.8 11.2C9.8 12.8 10.7 13.8 11.8 13.8C12.9 13.8 13.8 12.8 13.8 11.2H9.8Z" fill="url(#txBug)"/>
</svg>
""",

  "copy-id.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cipBack" x1="1" y1="1" x2="11" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="cipFront" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/><stop offset="45%" stop-color="#0284c7"/><stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.2" width="10.2" height="11.0" rx="1.8" fill="url(#cipBack)" stroke="#64748b" stroke-width="0.8"/>
  <rect x="4.4" y="2.0" width="3.4" height="1.0" rx="0.5" fill="#0f172a"/>
  <rect x="4.2" y="3.6" width="10.8" height="11.4" rx="2.0" fill="url(#cipFront)" stroke="#7dd3fc" stroke-width="0.8"/>
  <rect x="8.0" y="4.4" width="3.2" height="1.0" rx="0.5" fill="#0f172a" stroke="#38bdf8" stroke-width="0.3"/>
  <rect x="5.4" y="6.4" width="3.4" height="3.8" rx="0.6" fill="#0f172a" stroke="#7dd3fc" stroke-width="0.4"/>
  <circle cx="7.1" cy="7.6" r="0.8" fill="#ffffff"/>
  <path d="M6.0 9.8C6.0 9.0 6.5 8.7 7.1 8.7C7.7 8.7 8.2 9.0 8.2 9.8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round"/>
  <line x1="10.0" y1="6.8" x2="13.8" y2="6.8" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.0" y1="8.4" x2="13.2" y2="8.4" stroke="#7dd3fc" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="10.0" y1="10.0" x2="12.4" y2="10.0" stroke="#bae6fd" stroke-width="0.8" stroke-linecap="round"/>
  <line x1="5.4" y1="12.2" x2="13.8" y2="12.2" stroke="#e0f2fe" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1.6 0.9"/>
  <circle cx="14.4" cy="3.6" r="0.8" fill="#ffffff"/>
</svg>
""",

  "task-details.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="boardGrad" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="2.0" y="2.0" width="12.0" height="13.0" rx="2.0" fill="url(#boardGrad)" stroke="#64748b" stroke-width="0.8"/>
  <rect x="5.0" y="0.8" width="6.0" height="2.4" rx="0.8" fill="#cbd5e1" stroke="#475569" stroke-width="0.6"/>
  <path d="M4.2 6.0L5.2 7.0L7.2 4.8" stroke="#34d399" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.2" y1="6.0" x2="12.0" y2="6.0" stroke="#cbd5e1" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M4.2 9.5L5.2 10.5L7.2 8.3" stroke="#34d399" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.2" y1="9.5" x2="12.0" y2="9.5" stroke="#cbd5e1" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M4.2 13.0L5.2 14.0L7.2 11.8" stroke="#34d399" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.2" y1="13.0" x2="12.0" y2="13.0" stroke="#cbd5e1" stroke-width="1.1" stroke-linecap="round"/>
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
    print(f"All {len(CLOUD_ICONS)} vibrant cloud icons generated successfully.")

if __name__ == '__main__':
    main()
