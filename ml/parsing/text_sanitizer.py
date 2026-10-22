#Resolves Unicode discrepancies, typographic artifacts, hyphenated line-wraps, and extra whitespace.

import re
import unicodedata

from ml.resources.sanitizer_maps import UNICODE_REPLACEMENTS as _UNICODE_REPLACEMENTS


def normalize_unicode(text):
    """Normalize unicode characters and replace non-standard symbols."""
    for char, replacement in _UNICODE_REPLACEMENTS.items():
        text = text.replace(char, replacement)

    # NFC normalize remaining characters (compose accented chars)
    text = unicodedata.normalize("NFC", text)
    return text


def clean_line_breaks(text):
    """Fix hyphenation and normalize whitespace and line breaks."""
    # Fix mid-word hyphenation: "soft-\n  ware" → "software"
    text = re.sub(r"(\w)-\s*\n\s*([a-z])", r"\1\2", text)

    # Collapse runs of 3+ newlines into double newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Collapse horizontal whitespace runs into single space
    text = re.sub(r"[^\S\n]+", " ", text)

    # Clean leading and trailing line whitespace
    text = re.sub(r" +\n", "\n", text)
    text = re.sub(r"\n +", "\n", text)

    return text.strip()


def sanitize_text(raw_text, pages_data=None):
    """Run full text sanitization pipeline on resume text (Unicode normalization & line breaks)."""
    if not raw_text and pages_data:
        from ml.parsing.pdf_extractor import _format_pages_data_to_text
        raw_text = _format_pages_data_to_text(pages_data)

    text = normalize_unicode(raw_text or "")
    text = clean_line_breaks(text)
    return text

