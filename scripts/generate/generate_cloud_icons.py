"""
generate_cloud_icons.py
Generates the non-colorful (monochrome / subtle neutral slate & silver)
Cloud Explorer and view action icons in app/icons/cloud/:
- refresh.svg         (Monochrome dual sweeping circular arrows)
- search.svg          (Monochrome precision optical magnifying glass)
- filter.svg          (Monochrome flanged funnel with filtration bars)
- clear-filter.svg    (Monochrome funnel with neutral cancel badge)
- sync.svg            (Monochrome dual synchronizing orbit arrows)
- pull.svg            (Monochrome cloud with downward plunge arrow)
- diff.svg            (Monochrome split-pane comparison plates)
- switch-process.svg  (Monochrome process workflow arrows)
- query.svg           (Monochrome 2-tier database cylinder tower & query lens)
- export-csv.svg      (Monochrome table sheet with export arrow)
- inspect-tx.svg      (Monochrome transaction document with inspection lens)
- debug-tx.svg        (Monochrome transaction document with diagnostic bug badge)
- copy-id.svg         (Monochrome executive digital smart ID badge)
- task-details.svg    (Monochrome task clipboard with checklist ticks)

Cloud Explorer icons are non-colorful to seamlessly match VS Code's sidebar/tree styling.
Editor toolbar and commonly used command icons remain colorful.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLOUD_ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'cloud')

CLOUD_ICONS = {
  "refresh.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cRef1" x1="1" y1="2" x2="15" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="cRef2" x1="15" y1="14" x2="1" y2="6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/>
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
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <circle cx="6.5" cy="6.5" r="4.5" stroke="url(#cSchGrad)" stroke-width="1.6"/>
  <path d="M4.5 5.5A2.2 2.2 0 0 1 6.5 4.3" stroke="#ffffff" stroke-width="0.8" stroke-linecap="round"/>
  <line x1="10.0" y1="10.0" x2="14.2" y2="14.2" stroke="url(#cSchGrad)" stroke-width="2.2" stroke-linecap="round"/>
</svg>
""",

  "filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cFltBody" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#94a3b8"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="cFltRim" x1="1" y1="1" x2="15" y2="3" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.2" width="14.0" height="2.4" rx="1.2" fill="url(#cFltRim)" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="2.4" y1="1.8" x2="13.6" y2="1.8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" opacity="0.85"/>
  <path d="M2.0 3.6H14.0L9.8 9.0V14.5C9.8 14.8 9.5 15.0 9.2 15.0H6.8C6.5 15.0 6.2 14.8 6.2 14.5V9.0L2.0 3.6Z" fill="url(#cFltBody)" stroke="#1e293b" stroke-width="0.5" stroke-linejoin="round"/>
  <line x1="2.8" y1="4.0" x2="6.6" y2="8.8" stroke="#ffffff" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
  <line x1="3.8" y1="5.2" x2="12.2" y2="5.2" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
  <line x1="5.2" y1="7.0" x2="10.8" y2="7.0" stroke="#cbd5e1" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="6.8" y1="8.8" x2="9.2" y2="8.8" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <rect x="7.4" y="10.2" width="1.2" height="3.8" rx="0.6" fill="#cbd5e1"/>
</svg>
""",

  "clear-filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cClrBody" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#94a3b8"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="cClrRim" x1="1" y1="1" x2="15" y2="3" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.2" width="14.0" height="2.4" rx="1.2" fill="url(#cClrRim)" stroke="#1e293b" stroke-width="0.5"/>
  <line x1="2.4" y1="1.8" x2="13.6" y2="1.8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" opacity="0.6"/>
  <path d="M2.0 3.6H14.0L9.8 9.0V14.5C9.8 14.8 9.5 15.0 9.2 15.0H6.8C6.5 15.0 6.2 14.8 6.2 14.5V9.0L2.0 3.6Z" fill="url(#cClrBody)" stroke="#1e293b" stroke-width="0.5" stroke-linejoin="round"/>
  <line x1="3.8" y1="5.2" x2="12.2" y2="5.2" stroke="#cbd5e1" stroke-width="1.0" stroke-linecap="round" stroke-dasharray="1.8 1.4"/>
  <line x1="5.2" y1="7.0" x2="9.5" y2="7.0" stroke="#94a3b8" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="1.5 1.2"/>
  <circle cx="11.5" cy="11.5" r="4.3" fill="#0f172a"/>
  <circle cx="11.5" cy="11.5" r="3.7" fill="#334155" stroke="#cbd5e1" stroke-width="0.8"/>
  <ellipse cx="11.5" cy="9.3" rx="1.8" ry="0.7" fill="#ffffff" opacity="0.3"/>
  <path d="M9.8 9.8L13.2 13.2M13.2 9.8L9.8 13.2" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
</svg>
""",

  "sync.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cSyncGrad" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <path d="M2.5 8.0A5.5 5.5 0 0 1 12.0 4.2" stroke="url(#cSyncGrad)" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M12.0 1.5V4.5H9.0" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.5 8.0A5.5 5.5 0 0 1 4.0 11.8" stroke="url(#cSyncGrad)" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M4.0 14.5V11.5H7.0" stroke="#cbd5e1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="8" cy="8" r="1.6" fill="#334155" stroke="#94a3b8" stroke-width="0.8"/>
</svg>
""",

  "pull.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cPullCld" x1="2" y1="1" x2="14" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#cbd5e1"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>
  <path d="M4.5 10.0C3.0 10.0 1.5 8.8 1.5 7.2C1.5 5.8 2.6 4.7 4.0 4.5C4.5 2.5 6.2 1.2 8.2 1.2C10.5 1.2 12.3 2.8 12.6 5.0C13.8 5.2 14.8 6.2 14.8 7.5C14.8 9.0 13.5 10.0 12.0 10.0" stroke="url(#cPullCld)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M8.0 6.5V14.5M8.0 14.5L5.5 12.0M8.0 14.5L10.5 12.0" stroke="#f8fafc" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="3.5" y1="15.2" x2="12.5" y2="15.2" stroke="#64748b" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "diff.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cDiffPane" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.5" width="6.0" height="13.0" rx="1.5" fill="url(#cDiffPane)" stroke="#64748b" stroke-width="0.8"/>
  <line x1="2.5" y1="4.5" x2="5.5" y2="4.5" stroke="#cbd5e1" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="2.5" y1="7.5" x2="5.5" y2="7.5" stroke="#94a3b8" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="2.5" y1="10.5" x2="5.5" y2="10.5" stroke="#cbd5e1" stroke-width="1.0" stroke-linecap="round"/>
  <rect x="9.0" y="1.5" width="6.0" height="13.0" rx="1.5" fill="url(#cDiffPane)" stroke="#94a3b8" stroke-width="0.8"/>
  <line x1="10.5" y1="4.5" x2="13.5" y2="4.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.5" y1="7.5" x2="13.5" y2="7.5" stroke="#cbd5e1" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.5" y1="10.5" x2="13.5" y2="10.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
</svg>
""",

  "switch-process.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path d="M2.5 4.8H13.5M13.5 4.8L10.5 2.0M13.5 4.8L10.5 7.6" stroke="#cbd5e1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.5 11.2H2.5M2.5 11.2L5.5 8.4M2.5 11.2L5.5 14.0" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="8" cy="8" r="2.2" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.0"/>
  <circle cx="8" cy="8" r="1.0" fill="#cbd5e1"/>
</svg>
""",

  "query.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cQryBody" x1="1" y1="1" x2="11" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#94a3b8"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="cQryLens" x1="8" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <ellipse cx="5.8" cy="3.2" rx="4.8" ry="1.8" fill="url(#cQryBody)" stroke="#cbd5e1" stroke-width="0.7"/>
  <path d="M1.0 3.2V7.4C1.0 8.5 3.1 9.4 5.8 9.4C8.5 9.4 10.6 8.5 10.6 7.4V3.2" fill="url(#cQryBody)" stroke="#cbd5e1" stroke-width="0.7"/>
  <path d="M1.0 7.4V11.8C1.0 12.9 3.1 13.8 5.8 13.8C8.5 13.8 10.6 12.9 10.6 11.8V7.4" fill="url(#cQryBody)" stroke="#cbd5e1" stroke-width="0.7"/>
  <circle cx="3.0" cy="5.4" r="0.7" fill="#ffffff"/>
  <circle cx="3.0" cy="9.8" r="0.7" fill="#ffffff"/>
  <line x1="4.8" y1="5.4" x2="8.8" y2="5.4" stroke="#e2e8f0" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="4.8" y1="9.8" x2="7.8" y2="9.8" stroke="#e2e8f0" stroke-width="0.9" stroke-linecap="round"/>
  <circle cx="11.2" cy="10.4" r="4.2" fill="#0f172a"/>
  <circle cx="11.2" cy="10.4" r="3.4" fill="#0f172a" stroke="url(#cQryLens)" stroke-width="1.3"/>
  <circle cx="11.2" cy="10.4" r="2.2" fill="#94a3b8" fill-opacity="0.25"/>
  <path d="M10.0 10.4A1.2 1.2 0 0 1 11.2 9.2" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>
  <line x1="13.6" y1="12.8" x2="15.5" y2="14.8" stroke="url(#cQryLens)" stroke-width="2.0" stroke-linecap="round"/>
</svg>
""",

  "export-csv.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cCsvTable" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="13.0" height="13.0" rx="2.0" fill="url(#cCsvTable)" stroke="#94a3b8" stroke-width="0.8"/>
  <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="#cbd5e1" stroke-width="0.8"/>
  <line x1="5.8" y1="1.5" x2="5.8" y2="5.5" stroke="#cbd5e1" stroke-width="0.8"/>
  <line x1="10.2" y1="1.5" x2="10.2" y2="5.5" stroke="#cbd5e1" stroke-width="0.8"/>
  <path d="M8.0 7.0V12.0M8.0 12.0L5.5 9.5M8.0 12.0L10.5 9.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "inspect-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cInspDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#cInspDoc)" stroke="#64748b" stroke-width="0.7"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#94a3b8"/>
  <line x1="4.0" y1="6.5" x2="9.0" y2="6.5" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="9.0" x2="7.5" y2="9.0" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="11.5" x2="6.5" y2="11.5" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="11.2" cy="11.2" r="3.2" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.2"/>
  <line x1="13.4" y1="13.4" x2="15.2" y2="15.2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
</svg>
""",

  "debug-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cTxDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#cTxDoc)" stroke="#64748b" stroke-width="0.7"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#94a3b8"/>
  <line x1="4.0" y1="6.5" x2="9.0" y2="6.5" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="9.0" x2="7.5" y2="9.0" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="11.8" cy="11.8" r="3.4" fill="#0f172a" stroke="#cbd5e1" stroke-width="0.8"/>
  <circle cx="11.8" cy="10.2" r="1.0" fill="#cbd5e1"/>
  <path d="M9.8 11.2C9.8 12.8 10.7 13.8 11.8 13.8C12.9 13.8 13.8 12.8 13.8 11.2H9.8Z" fill="#94a3b8"/>
</svg>
""",

  "copy-id.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cIdBack" x1="1" y1="1" x2="11" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="cIdFront" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="1.0" y="1.2" width="10.2" height="11.0" rx="1.8" fill="url(#cIdBack)" stroke="#64748b" stroke-width="0.8"/>
  <rect x="4.4" y="2.0" width="3.4" height="1.0" rx="0.5" fill="#0f172a"/>
  <rect x="4.2" y="3.6" width="10.8" height="11.4" rx="2.0" fill="url(#cIdFront)" stroke="#cbd5e1" stroke-width="0.8"/>
  <rect x="8.0" y="4.4" width="3.2" height="1.0" rx="0.5" fill="#0f172a" stroke="#94a3b8" stroke-width="0.3"/>
  <rect x="5.4" y="6.4" width="3.4" height="3.8" rx="0.6" fill="#0f172a" stroke="#cbd5e1" stroke-width="0.4"/>
  <circle cx="7.1" cy="7.6" r="0.8" fill="#ffffff"/>
  <path d="M6.0 9.8C6.0 9.0 6.5 8.7 7.1 8.7C7.7 8.7 8.2 9.0 8.2 9.8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round"/>
  <line x1="10.0" y1="6.8" x2="13.8" y2="6.8" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.0" y1="8.4" x2="13.2" y2="8.4" stroke="#cbd5e1" stroke-width="0.9" stroke-linecap="round"/>
  <line x1="10.0" y1="10.0" x2="12.4" y2="10.0" stroke="#94a3b8" stroke-width="0.8" stroke-linecap="round"/>
  <line x1="5.4" y1="12.2" x2="13.8" y2="12.2" stroke="#f8fafc" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1.6 0.9"/>
  <circle cx="14.4" cy="3.6" r="0.8" fill="#ffffff"/>
</svg>
""",

  "task-details.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cBoardGrad" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="2.0" y="2.0" width="12.0" height="13.0" rx="2.0" fill="url(#cBoardGrad)" stroke="#64748b" stroke-width="0.8"/>
  <rect x="5.0" y="0.8" width="6.0" height="2.4" rx="0.8" fill="#cbd5e1" stroke="#475569" stroke-width="0.6"/>
  <path d="M4.2 6.0L5.2 7.0L7.2 4.8" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.2" y1="6.0" x2="12.0" y2="6.0" stroke="#cbd5e1" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M4.2 9.5L5.2 10.5L7.2 8.3" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.2" y1="9.5" x2="12.0" y2="9.5" stroke="#cbd5e1" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M4.2 13.0L5.2 14.0L7.2 11.8" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
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
    # Also write clear-filters.svg alias so both singular and plural filenames are present
    with open(os.path.join(CLOUD_ICONS_DIR, 'clear-filters.svg'), 'w', encoding='utf-8') as f:
        f.write(CLOUD_ICONS['clear-filter.svg'])
    print(f"All {len(CLOUD_ICONS)} non-colorful cloud icons generated successfully.")

if __name__ == '__main__':
    main()
