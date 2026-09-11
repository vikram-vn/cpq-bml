# scripts/generate

SVG generator scripts for the BML extension. Both scripts are fully
self-contained with no dependencies outside this folder.

Run all commands from the **project root**.

## Quick Run (All Icons)

```bash
yarn generate:icons
# or
yarn generage:icons
# or
python scripts/generate/generate_icons.py
```

## Scripts

### `generate_bml_svg.py`
Generates `app/icons/bml.svg` — the 3D extruded "B" icon.  
Glyph path data is inlined — no external files required.

```bash
python scripts/generate/generate_bml_svg.py
```

---

### `generate_logo_svg.py`
Generates `app/icons/logo.svg` — the BML cloud logo with smooth rounded edges.  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_logo_svg.py
```

---

### `generate_sidebar_svg.py`
Generates `app/icons/sidebar.svg` and `app/icons/sidebar-solid.svg` — the 24×24 monochrome VS Code Activity Bar icons.  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_sidebar_svg.py
```

---

### `generate_views_svg.py`
Generates 24×24 monochrome view icons for each sidebar view (`app/icons/datatables.svg`, `app/icons/transactions.svg`, `app/icons/deployment.svg`).  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_views_svg.py
```

---

### `generate_command_icons.py`
Generates all 21 command and toolbar action icons (e.g. `save.svg`, `deploy.svg`, `debug.svg`, `settings.svg`, `run-tests.svg`, etc.).  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_command_icons.py
```

