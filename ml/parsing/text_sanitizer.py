import re
import unicodedata

from backend.ml.resources.sanitizer_maps import UNICODE_REPLACEMENTS as _UNICODE_REPLACEMENTS


def normalize_unicode(text):

    for char, replacement in _UNICODE_REPLACEMENTS.items():
        text = text.replace(char, replacement)

    # NFC normalize remaining characters (compose accented chars)
    text = unicodedata.normalize("NFC", text)
    return text


def clean_line_breaks(text):

    # Fix mid-word hyphenation: "soft-\n  ware" → "software"
    # Only join when the next line starts with a lowercase letter (true hyphenation)
    text = re.sub(r"(\w)-\s*\n\s*([a-z])", r"\1\2", text)

    # Collapse runs of 3+ newlines into double newlines (paragraph break)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Collapse horizontal whitespace runs (tabs, multiple spaces) into single space
    # but preserve newlines
    text = re.sub(r"[^\S\n]+", " ", text)

    # Remove trailing whitespace on each line
    text = re.sub(r" +\n", "\n", text)

    # Remove leading whitespace on each line (PDF indentation artifacts)
    text = re.sub(r"\n +", "\n", text)

    return text.strip()


def fix_column_interleaving(raw_text, pages_data=None):

    if pages_data is not None:
        return _fix_with_coordinates(pages_data)

    # Heuristic fallback: if no coordinate data, apply line-based cleanup
    return _heuristic_deinterleave(raw_text)


def _fix_with_coordinates(pages_data):

    from backend.ml.parsing.pdf_extractor import _words_to_lines

    all_parts = []
    for page_data in pages_data:
        columns = page_data.get("columns", [])
        if not columns:
            continue

        page_lines = []
        for col_words in columns:
            col_lines = _words_to_lines(col_words)
            page_lines.extend(col_lines)

        all_parts.append("\n".join(page_lines))

    return "\n\n".join(all_parts)


def _heuristic_deinterleave(text):

    lines = text.split("\n")
    if len(lines) < 6:
        return text

    # Check for alternating short/long pattern that suggests interleaving
    lengths = [len(line.strip()) for line in lines if line.strip()]
    if len(lengths) < 4:
        return text

    avg_len = sum(lengths) / len(lengths)

    # Check if odd/even lines have very different average lengths
    odd_avg = sum(lengths[i] for i in range(0, len(lengths), 2)) / max(len(lengths) // 2, 1)
    even_avg = sum(lengths[i] for i in range(1, len(lengths), 2)) / max(len(lengths) // 2, 1)

    # If the difference is > 40% of average, likely interleaved
    if abs(odd_avg - even_avg) > avg_len * 0.4 and len(lengths) > 8:
        odd_lines = [lines[i] for i in range(0, len(lines), 2) if lines[i].strip()]
        even_lines = [lines[i] for i in range(1, len(lines), 2) if lines[i].strip()]
        return "\n".join(odd_lines) + "\n\n" + "\n".join(even_lines)

    return text


def sanitize_text(raw_text, pages_data=None):

    text = fix_column_interleaving(raw_text, pages_data)
    text = normalize_unicode(text)
    text = clean_line_breaks(text)
    return text
