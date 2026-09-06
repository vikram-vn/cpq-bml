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

---

### `generate_dynamic_icons.js`
Dynamically scans workspace directories, BML IntelliSense keywords, and CPQ
domain concepts, classifies them using an ordered semantic rule engine, and
syncs all permutations into `themes/bml-icons.json` and `themes/bml-icons.min.json`.
Implemented purely in JavaScript / Node.js with zero external dependencies.

```bash
npm run generate:icons
# or: node scripts/generate/generate_dynamic_icons.js
```
*(Also executed automatically during `npm run compile` and `npm run package`)*
