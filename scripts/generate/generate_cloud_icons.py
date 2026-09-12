"""
generate_cloud_icons.py
Generates the dedicated Cloud Explorer and view action icons in app/icons/cloud/:
- refresh.svg         (3D sweeping dual circular arrows)
- search.svg          (Optical magnifying glass with steel rim & lens reflection)
- filter.svg          (Precision machined funnel with sieve & drop)
- clear-filter.svg    (Funnel with embossed crimson close badge)
- sync.svg            (Dual planetary orbital sync rings & cloud anchor)
- pull.svg            (Volumetric cloud with downward plunge arrow to platter)
- diff.svg            (Side-by-side diff document plates with delta markers)
- switch-process.svg  (Commerce process workflow pipeline & nodes)
- query.svg           (Multi-tier database cylinder stack with query prompt)
- export-csv.svg      (Emerald spreadsheet grid table with export arrow)
- inspect-tx.svg      (Transaction ledger card with inspection lens)
- debug-tx.svg        (Transaction ledger card with orange beetle bug pin)
- copy-id.svg         (Overlapping ID keycards with GUID hash bars)
- task-details.svg    (Task clipboard with spring clamp & checkmarks)

Fully self-contained with no external dependencies beyond Python standard library.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLOUD_ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons', 'cloud')

CLOUD_ICONS = {
  "refresh.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="refGrad1" x1="1" y1="2" x2="15" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="refGrad2" x1="15" y1="14" x2="1" y2="6" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <!-- Top clockwise sweeping arc & head -->
  <path d="M14.0 6.0C13.2 3.4 10.8 1.5 8.0 1.5C4.7 1.5 2.0 4.0 1.6 7.2" stroke="url(#refGrad1)" stroke-width="2.0" stroke-linecap="round"/>
  <path d="M10.8 6.0H14.5V2.3" stroke="url(#refGrad1)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Bottom clockwise sweeping arc & head -->
  <path d="M2.0 10.0C2.8 12.6 5.2 14.5 8.0 14.5C11.3 14.5 14.0 12.0 14.4 8.8" stroke="url(#refGrad2)" stroke-width="2.0" stroke-linecap="round"/>
  <path d="M5.2 10.0H1.5V13.7" stroke="url(#refGrad2)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "search.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="lensBezel" x1="1" y1="1" x2="11" y2="11" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="40%" stop-color="#94a3b8"/>
      <stop offset="80%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="lensGlass" x1="2" y1="2" x2="10" y2="10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.10"/>
    </linearGradient>
    <linearGradient id="lensHandle" x1="10" y1="10" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="50%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Glass lens field -->
  <circle cx="6.2" cy="6.2" r="4.6" fill="url(#lensGlass)"/>
  <!-- Metallic steel bezel ring -->
  <circle cx="6.2" cy="6.2" r="4.6" stroke="url(#lensBezel)" stroke-width="1.6"/>
  <!-- Inner specular reflection arc -->
  <path d="M3.2 6.2A3.0 3.0 0 0 1 6.2 3.2" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round" opacity="0.8"/>
  <!-- Ergonomic handle with grip highlight -->
  <line x1="9.8" y1="9.8" x2="14.6" y2="14.6" stroke="url(#lensHandle)" stroke-width="2.6" stroke-linecap="round"/>
  <line x1="9.8" y1="9.8" x2="14.6" y2="14.6" stroke="#94a3b8" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
</svg>
""",

  "filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="funnelGrad" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="40%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <!-- Machined funnel body -->
  <path d="M1.2 2.2H14.8L9.8 8.4V13.8L6.2 15.0V8.4L1.2 2.2Z" fill="url(#funnelGrad)" stroke="#a5b4fc" stroke-width="0.8" stroke-linejoin="round"/>
  <!-- Funnel top rim highlight -->
  <line x1="1.8" y1="2.2" x2="14.2" y2="2.2" stroke="#e0e7ff" stroke-width="0.8" stroke-linecap="round"/>
  <!-- Internal filter sieve line -->
  <line x1="4.0" y1="5.4" x2="12.0" y2="5.4" stroke="#c7d2fe" stroke-width="0.8" stroke-linecap="round" opacity="0.75"/>
</svg>
""",

  "clear-filter.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cfFunnel" x1="1" y1="1" x2="13" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="cfBadge" x1="9" y1="9" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="50%" stop-color="#e11d48"/>
      <stop offset="100%" stop-color="#9f1239"/>
    </linearGradient>
  </defs>
  <!-- Background funnel -->
  <path d="M1.2 2.2H14.8L9.8 8.4V13.8L6.2 15.0V8.4L1.2 2.2Z" fill="url(#cfFunnel)" stroke="#94a3b8" stroke-width="0.7" stroke-linejoin="round"/>
  <!-- Crimson Close Badge -->
  <circle cx="12.2" cy="12.2" r="3.4" fill="url(#cfBadge)" stroke="#0f172a" stroke-width="1.0"/>
  <path d="M10.8 10.8L13.6 13.6M13.6 10.8L10.8 13.6" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
</svg>
""",

  "sync.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="syncGrad" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="syncCyan" x1="2" y1="2" x2="14" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <!-- Upper sync planetary loop -->
  <path d="M2.5 8.0A5.5 5.5 0 0 1 12.8 5.0" stroke="url(#syncGrad)" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M12.8 1.8V5.2H9.4" stroke="url(#syncGrad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Lower sync planetary loop -->
  <path d="M13.5 8.0A5.5 5.5 0 0 1 3.2 11.0" stroke="url(#syncCyan)" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M3.2 14.2V10.8H6.6" stroke="url(#syncCyan)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Central planetary node -->
  <circle cx="8" cy="8" r="1.6" fill="#34d399" stroke="#0f172a" stroke-width="0.6"/>
</svg>
""",

  "pull.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="cloudVault" x1="2" y1="1" x2="14" y2="13" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
  </defs>
  <!-- Volumetric cloud body -->
  <path d="M12.5 6.4C12.5 4.0 10.5 2.0 8.0 2.0C6.0 2.0 4.2 3.2 3.5 5.0C1.8 5.4 0.6 6.8 0.6 8.6C0.6 10.8 2.4 12.6 4.6 12.6H12.3C14.3 12.6 16.0 11.0 16.0 9.0C16.0 7.3 14.5 6.6 12.5 6.4Z" fill="url(#cloudVault)" stroke="#7dd3fc" stroke-width="0.5"/>
  <!-- Directional plunge arrow -->
  <path d="M8.0 4.2V11.2M8.0 11.2L5.2 8.4M8.0 11.2L10.8 8.4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Local drive platter -->
  <path d="M3.0 14.6H13.0" stroke="#0284c7" stroke-width="1.4" stroke-linecap="round"/>
</svg>
""",

  "diff.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="diffLeft" x1="1" y1="1" x2="7" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="diffRight" x1="9" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <!-- Left document pane -->
  <rect x="1.0" y="1.5" width="6.0" height="13.0" rx="1.5" fill="url(#diffLeft)" stroke="#60a5fa" stroke-width="0.6"/>
  <line x1="2.5" y1="4.5" x2="5.5" y2="4.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="2.5" y1="7.5" x2="5.5" y2="7.5" stroke="#f87171" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="2.5" y1="10.5" x2="5.5" y2="10.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <!-- Right document pane -->
  <rect x="9.0" y="1.5" width="6.0" height="13.0" rx="1.5" fill="url(#diffRight)" stroke="#34d399" stroke-width="0.6"/>
  <line x1="10.5" y1="4.5" x2="13.5" y2="4.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.5" y1="7.5" x2="13.5" y2="7.5" stroke="#34d399" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="10.5" y1="10.5" x2="13.5" y2="10.5" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
</svg>
""",

  "switch-process.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="procOrange" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="50%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#9a3412"/>
    </linearGradient>
    <linearGradient id="procBlue" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <!-- Upper workflow arrow -->
  <path d="M2.5 4.8H13.5M13.5 4.8L10.5 2.0M13.5 4.8L10.5 7.6" stroke="url(#procOrange)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Lower workflow arrow -->
  <path d="M13.5 11.2H2.5M2.5 11.2L5.5 8.4M2.5 11.2L5.5 14.0" stroke="url(#procBlue)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Central process node -->
  <circle cx="8" cy="8" r="2.2" fill="#0f172a" stroke="#fb923c" stroke-width="1.0"/>
  <circle cx="8" cy="8" r="1.0" fill="#fb923c"/>
</svg>
""",

  "query.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="dbGrad" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Top cylinder -->
  <ellipse cx="8" cy="3.5" rx="5.5" ry="2.0" fill="url(#dbGrad)" stroke="#94a3b8" stroke-width="0.8"/>
  <!-- Mid cylinder layer -->
  <path d="M2.5 3.5V7.5C2.5 8.6 5.0 9.5 8.0 9.5C11.0 9.5 13.5 8.6 13.5 7.5V3.5" fill="url(#dbGrad)" stroke="#94a3b8" stroke-width="0.8"/>
  <!-- Bottom cylinder layer -->
  <path d="M2.5 7.5V11.5C2.5 12.6 5.0 13.5 8.0 13.5C11.0 13.5 13.5 12.6 13.5 11.5V7.5" fill="url(#dbGrad)" stroke="#94a3b8" stroke-width="0.8"/>
  <!-- Active Query Chevron >_ in cyan -->
  <path d="M6.0 10.5L7.5 11.5L6.0 12.5" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8.5" y1="12.5" x2="10.0" y2="12.5" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round"/>
</svg>
""",

  "export-csv.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="csvTable" x1="1" y1="1" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <!-- Table sheet plate -->
  <rect x="1.5" y="1.5" width="13.0" height="13.0" rx="2.0" fill="url(#csvTable)" stroke="#6ee7b7" stroke-width="0.7"/>
  <!-- Table header band -->
  <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="#a7f3d0" stroke-width="0.8"/>
  <!-- Vertical column dividers -->
  <line x1="5.8" y1="1.5" x2="5.8" y2="5.5" stroke="#a7f3d0" stroke-width="0.8"/>
  <line x1="10.2" y1="1.5" x2="10.2" y2="5.5" stroke="#a7f3d0" stroke-width="0.8"/>
  <!-- Downward CSV export arrow -->
  <path d="M8.0 7.0V12.0M8.0 12.0L5.5 9.5M8.0 12.0L10.5 9.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""",

  "inspect-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="txDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="inspLens" x1="7" y1="7" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <!-- Base transaction document -->
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#txDoc)" stroke="#64748b" stroke-width="0.6"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#94a3b8"/>
  <!-- Ledger rows -->
  <line x1="4.0" y1="6.5" x2="9.0" y2="6.5" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="9.0" x2="7.5" y2="9.0" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="11.5" x2="6.5" y2="11.5" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <!-- Inspector magnifying glass -->
  <circle cx="11.2" cy="11.2" r="3.2" fill="#0f172a" stroke="url(#inspLens)" stroke-width="1.2"/>
  <line x1="13.4" y1="13.4" x2="15.2" y2="15.2" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>
</svg>
""",

  "debug-tx.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="txDebugDoc" x1="2" y1="1" x2="12" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="txBug" x1="9" y1="8" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <!-- Transaction sheet -->
  <path d="M2.0 2.2C2.0 1.5 2.5 1.0 3.2 1.0H8.6L12.4 4.8V13.8C12.4 14.5 11.9 15.0 11.2 15.0H3.2C2.5 15.0 2.0 14.5 2.0 13.8V2.2Z" fill="url(#txDebugDoc)" stroke="#64748b" stroke-width="0.6"/>
  <path d="M8.6 1.0V4.8H12.4L8.6 1.0Z" fill="#94a3b8"/>
  <line x1="4.0" y1="6.5" x2="9.0" y2="6.5" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="4.0" y1="9.0" x2="7.5" y2="9.0" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
  <!-- Diagnostic Orange Beetle Badge -->
  <circle cx="11.8" cy="11.8" r="3.4" fill="#0f172a" stroke="#ea580c" stroke-width="0.8"/>
  <circle cx="11.8" cy="10.2" r="1.0" fill="#ea580c"/>
  <path d="M9.8 11.2C9.8 12.8 10.7 13.8 11.8 13.8C12.9 13.8 13.8 12.8 13.8 11.2H9.8Z" fill="url(#txBug)"/>
</svg>
""",

  "copy-id.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="idCard" x1="4" y1="4" x2="15" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <!-- Background ID card -->
  <rect x="1.5" y="1.5" width="9.0" height="10.0" rx="1.5" fill="#1e293b" stroke="#64748b" stroke-width="0.8"/>
  <!-- Foreground active ID card -->
  <rect x="5.0" y="4.5" width="9.5" height="10.0" rx="1.5" fill="url(#idCard)" stroke="#7dd3fc" stroke-width="0.8"/>
  <!-- Magnetic stripe / hash code lines -->
  <rect x="5.0" y="6.2" width="9.5" height="1.6" fill="#0f172a"/>
  <line x1="6.8" y1="10.2" x2="12.6" y2="10.2" stroke="#ffffff" stroke-width="1.0" stroke-linecap="round"/>
  <line x1="6.8" y1="12.2" x2="10.5" y2="12.2" stroke="#bae6fd" stroke-width="1.0" stroke-linecap="round"/>
</svg>
""",

  "task-details.svg": """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="boardGrad" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Clipboard board -->
  <rect x="2.0" y="2.0" width="12.0" height="13.0" rx="2.0" fill="url(#boardGrad)" stroke="#64748b" stroke-width="0.8"/>
  <!-- Metallic spring clamp -->
  <rect x="5.0" y="0.8" width="6.0" height="2.4" rx="0.8" fill="#cbd5e1" stroke="#475569" stroke-width="0.6"/>
  <!-- Completed task items (checkmark + rule line) -->
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
    print(f"All {len(CLOUD_ICONS)} cloud icons generated successfully.")

if __name__ == '__main__':
    main()
