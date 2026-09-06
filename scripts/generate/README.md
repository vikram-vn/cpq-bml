# scripts/generate

SVG generator scripts for the BML extension. Both scripts are fully
self-contained with no dependencies outside this folder.

Run all commands from the **project root**.

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
