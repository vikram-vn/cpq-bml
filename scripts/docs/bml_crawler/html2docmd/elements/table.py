"""
elements/table.py - HTML table to aligned Markdown table converter.

Handles:
- <table> with <th> header rows and <td> data rows
- Nested tables (only converts the outermost table)
- Auto-generated column headers when no <th> is present
- Column width alignment for readability
- Cell content cleaned of extra whitespace
"""
import re


def _clean_cell(text: str) -> str:
    """Clean whitespace from a cell value and escape pipe characters."""
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("|", "\\|")
    return text


def convert_table(element, convert_fn) -> str:
    """
    Convert a <table> element to a Markdown table.

    convert_fn: callable(element) -> str  (the converter's recursive convert method)
    """
    headers: list[str] = []
    rows: list[list[str]] = []

    for tr in element.find_all("tr", recursive=True):
        # Skip rows that belong to a nested table
        if tr.find_parent("table") is not element:
            continue

        cells: list[str] = []
        is_header = False
        for cell in tr.find_all(("th", "td"), recursive=False):
            cell_md = _clean_cell(convert_fn(cell))
            cells.append(cell_md)
            if cell.name == "th":
                is_header = True

        if not cells:
            continue

        if is_header:
            headers = cells
        else:
            rows.append(cells)

    if not headers and not rows:
        return ""

    # Auto-generate headers if only data rows
    if not headers and rows:
        headers = [f"Col {i + 1}" for i in range(len(rows[0]))]

    # Normalize row widths
    ncols = len(headers)
    normalized_rows = []
    for row in rows:
        while len(row) < ncols:
            row.append("")
        normalized_rows.append(row[:ncols])

    # Compute column widths for alignment
    col_widths = [max(len(h), 3) for h in headers]
    for row in normalized_rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(cell))

    def _fmt_row(cells: list[str]) -> str:
        return "| " + " | ".join(c.ljust(col_widths[i]) for i, c in enumerate(cells)) + " |"

    header_row = _fmt_row(headers)
    sep_row = "| " + " | ".join("-" * col_widths[i] for i in range(ncols)) + " |"
    data_rows = [_fmt_row(row) for row in normalized_rows]

    return "\n\n" + "\n".join([header_row, sep_row] + data_rows) + "\n\n"