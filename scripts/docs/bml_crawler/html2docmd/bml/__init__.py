"""bml/__init__.py"""
from .accordion   import is_accordion_header, convert_accordion
from .admonitions import detect_admonition
from .param_table import is_param_table_header, consume_param_table
from .syntax      import format_syntax_line, format_return_type, format_example_line

__all__ = [
    "is_accordion_header", "convert_accordion",
    "detect_admonition",
    "is_param_table_header", "consume_param_table",
    "format_syntax_line", "format_return_type", "format_example_line",
]