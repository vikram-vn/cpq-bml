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
Generates `app/icons/brand/bml.svg` — the 3D extruded "B" icon.  
Glyph path data is inlined — no external files required.

```bash
python scripts/generate/generate_bml_svg.py
```

---

### `generate_logo_svg.py`
Generates `app/icons/brand/logo.svg` and `app/icons/brand/logo.png` — the BML cloud logo with smooth rounded edges.  
No external dependencies beyond Python stdlib (Playwright optional for PNG rasterization).

```bash
python scripts/generate/generate_logo_svg.py
```

---

### `generate_sidebar_svg.py`
Generates `app/icons/sidebar/sidebar.svg` and `app/icons/sidebar/sidebar-solid.svg` — the 24×24 VS Code Activity Bar icons.  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_sidebar_svg.py
```

---

### `generate_views_svg.py`
Generates the 6 vibrant 24×24 view icons in `app/icons/views/` (`commerce.svg`, `config.svg`, `datatables.svg`, `deployment.svg`, `transactions.svg`, `util-libraries.svg`).  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_views_svg.py
```

---

### `generate_editor_icons.py`
Generates the 22 colorful editor toolbar and command action icons in `app/icons/editor/` (`save.svg`, `deploy.svg`, `debug.svg`, `validate.svg`, `settings.svg`, `run-tests.svg`, etc.).  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_editor_icons.py
```

---

### `generate_cloud_icons.py`
Generates the 14 vibrant cloud explorer icons in `app/icons/cloud/` (`refresh.svg`, `search.svg`, `filter.svg`, `query.svg`, `copy-id.svg`, `sync.svg`, etc.).  
No external dependencies beyond Python stdlib.

```bash
python scripts/generate/generate_cloud_icons.py
```


