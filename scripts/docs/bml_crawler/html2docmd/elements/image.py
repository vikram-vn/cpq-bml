"""
elements/image.py - Image element handler.

Features:
- Skips transparent.gif accordion icons (returns empty string)
- Downloads remote images via a callback if provided
- Always emits flat images/<filename> relative path
"""
import os
import urllib.parse


def convert_image(element, context) -> str:
    """Convert <img> to markdown image reference."""
    src = element.get("src", "").strip()
    alt = element.get("alt", "").strip() or "image"

    if not src:
        return ""

    # Skip transparent accordion icons
    if "transparent.gif" in src:
        return ""

    # Try to download the image locally
    if context.download_image_callback:
        resolved_url = context.resolve_url(src)
        local_path = context.download_image_callback(resolved_url)
        if local_path:
            filename = os.path.basename(local_path)
            return f"![{alt}](images/{filename})"
        # Fallback: use resolved URL if download failed
        return f"![{alt}]({resolved_url})"

    # No download callback — use flat filename if path-like, else raw src
    parsed = urllib.parse.urlparse(src)
    if parsed.scheme in ("http", "https"):
        return f"![{alt}]({src})"

    filename = os.path.basename(src.split("?")[0])
    return f"![{alt}](images/{filename})"