"""
generate_icons.py
Master runner to generate all project SVGs:
- app/icons/sidebar.svg (VS Code Activity Bar icon)
- app/icons/sidebar-solid.svg (VS Code Activity Bar solid variant)
- app/icons/datatables.svg (CPQ Data Tables view icon)
- app/icons/transactions.svg (Recent Transactions view icon)
- app/icons/deployment.svg (Deployment Center view icon)
- app/icons/bml.svg (BML file language icon)
- app/icons/logo.svg & app/icons/logo.png (BML cloud logo)
- 21 command & action SVGs (ai-setup, beautify, debug, deploy, etc.)

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
        'generate_command_icons.py',
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
