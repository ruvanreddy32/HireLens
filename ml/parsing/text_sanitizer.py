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


def fix_column_interleaving(raw_text, pages_data=None):
    """Deinterleave multi-column text using layout coordinates if provided."""
    if pages_data is not None:
        from ml.parsing.pdf_extractor import _format_pages_data_to_text
        return _format_pages_data_to_text(pages_data)

    return raw_text or ""


def _heuristic_deinterleave(text):
    """Heuristically detect and fix interleaved two-column text lines."""
    if not text:
        return ""
    lines = text.split("\n")
    if len(lines) < 6:
        return text

    lengths = [len(line.strip()) for line in lines if line.strip()]
    if len(lengths) < 4:
        return text

    avg_len = sum(lengths) / len(lengths)
    odd_avg = sum(lengths[i] for i in range(0, len(lengths), 2)) / max(len(lengths) // 2, 1)
    even_avg = sum(lengths[i] for i in range(1, len(lengths), 2)) / max(len(lengths) // 2, 1)

    if abs(odd_avg - even_avg) > avg_len * 0.4 and len(lengths) > 8:
        odd_lines = [lines[i] for i in range(0, len(lines), 2) if lines[i].strip()]
        even_lines = [lines[i] for i in range(1, len(lines), 2) if lines[i].strip()]
        return "\n".join(odd_lines) + "\n\n" + "\n".join(even_lines)

    return text


def sanitize_text(raw_text, pages_data=None):
    """Run full text sanitization pipeline on resume text (Unicode normalization & line breaks)."""
    if not raw_text and pages_data:
        from ml.parsing.pdf_extractor import _format_pages_data_to_text
        raw_text = _format_pages_data_to_text(pages_data)

    text = normalize_unicode(raw_text or "")
    text = clean_line_breaks(text)
    return text

