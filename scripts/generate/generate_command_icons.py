"""
generate_command_icons.py
Generates the 22 command and toolbar action icons in app/icons/:
- ai-setup.svg, beautify.svg, change-env.svg, clear.svg, create-bml.svg
- create-override.svg, debug.svg, debug-configure.svg, deploy-commerce.svg
- deploy-mass.svg, deploy.svg, metrics.svg, preview.svg, pull.svg
- remove-override.svg, run-tests.svg, save.svg, settings.svg (grey mechanical steel gear)
- snapshot-compare.svg, snapshot-update.svg, switch-file.svg, validate.svg

Fully self-contained: no external dependencies beyond standard library.
"""
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'icons')

# Import the elevated editor icons from generate_editor_icons
from generate_editor_icons import EDITOR_ICONS

ICONS = dict(EDITOR_ICONS)

# Root settings.svg is the precision mechanical steel gear (grey), distinct from colorful editor settings
ICONS["settings.svg"] = """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <defs>
    <linearGradient id="mechBody" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="25%" stop-color="#94a3b8"/>
      <stop offset="65%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="mechEdge" x1="2" y1="1" x2="14" y2="15" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#94a3b8" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#1e293b" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="grooveGrad" x1="5" y1="5" x2="11" y2="11" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#94a3b8" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 0.8H9.5L9.9 2.8C10.5 3.1 11.1 3.5 11.6 3.9L13.5 3.1L15.0 5.7L13.5 7.2C13.6 7.5 13.6 7.7 13.6 8C13.6 8.3 13.6 8.5 13.5 8.8L15.0 10.3L13.5 12.9L11.6 12.1C11.1 12.5 10.5 12.9 9.9 13.2L9.5 15.2H6.5L6.1 13.2C5.5 12.9 4.9 12.5 4.4 12.1L2.5 12.9L1.0 10.3L2.5 8.8C2.4 8.5 2.4 8.3 2.4 8C2.4 7.7 2.4 7.5 2.5 7.2L1.0 5.7L2.5 3.1L4.4 3.9C4.9 3.5 5.5 3.1 6.1 2.8L6.5 0.8ZM8 5.6C6.67 5.6 5.6 6.67 5.6 8C5.6 9.33 6.67 10.4 8 10.4C9.33 10.4 10.4 9.33 10.4 8C10.4 6.67 9.33 5.6 8 5.6Z" fill="url(#mechBody)" stroke="url(#mechEdge)" stroke-width="0.4"/>
  <circle cx="8" cy="8" r="4.0" fill="none" stroke="url(#grooveGrad)" stroke-width="0.7"/>
  <circle cx="8" cy="8" r="2.4" fill="none" stroke="#e2e8f0" stroke-width="0.5" opacity="0.8"/>
</svg>
"""

def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    for filename, content in ICONS.items():
        filepath = os.path.join(ICONS_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated: app/icons/{filename}")
    # Also write debug-config.svg alias
    with open(os.path.join(ICONS_DIR, 'debug-config.svg'), 'w', encoding='utf-8') as f:
        f.write(ICONS['debug-configure.svg'])
    print(f"All {len(ICONS)} command icons generated successfully.")

if __name__ == '__main__':
    main()
