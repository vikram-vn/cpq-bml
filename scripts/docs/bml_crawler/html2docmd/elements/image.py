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

    # If image downloads are explicitly disabled
    if context.download_image_callback is False:
        return ""

    # Try to download the image locally
    if context.download_image_callback:
        resolved_url = context.resolve_url(src)
        local_path = context.download_image_callback(resolved_url)
        if local_path:
            filename = os.path.basename(local_path)
            return f"![{alt}](images/{filename})"
        return ""

    # No download callback — return empty
    return ""