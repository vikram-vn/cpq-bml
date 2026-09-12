"""
generate_icons.py
Master runner to generate all project SVGs:
- app/icons/brand/logo.svg & app/icons/brand/logo.png (BML cloud logo & marketplace icon)
- app/icons/brand/bml.svg (BML file language icon)
- app/icons/sidebar/sidebar.svg & sidebar-solid.svg (VS Code Activity Bar icons)
- app/icons/views/ (6 views: commerce, config, datatables, deployment, transactions, util-libraries)
- app/icons/editor/ (22 colorful editor toolbar & command action SVGs)
- app/icons/cloud/ (14 colorful cloud explorer tree SVGs)

Run from project root:
    python scripts/generate/generate_icons.py
    yarn generate:icons
"""
import subprocess
import sys
import os

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    scripts = [
        'generate_sidebar_svg.py',
        'generate_views_svg.py',
        'generate_editor_icons.py',
        'generate_cloud_icons.py',
        'generate_bml_svg.py',
        'generate_logo_svg.py'
    ]
    for script in scripts:
        path = os.path.join(SCRIPTS_DIR, script)
        print(f"==> Running {script}...")
        subprocess.run([sys.executable, path], check=True)
    print("\nAll icons generated successfully.")

if __name__ == '__main__':
    main()
