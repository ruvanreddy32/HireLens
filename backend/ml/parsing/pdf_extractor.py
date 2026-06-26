import pdfplumber
from pathlib import Path

def _cluster_columns(words, gap_threshold_ratio=0.35):

    if not words:
        return []

    # Determine page width from word extents
    all_x0 = sorted(set(round(w["x0"], 1) for w in words))
    if len(all_x0) < 2:
        return [words]

    page_width = max(w["x1"] for w in words) - min(w["x0"] for w in words)
    gap_threshold = page_width * gap_threshold_ratio

    # Find column boundaries by detecting large x-gaps
    column_boundaries = [all_x0[0]]
    for i in range(1, len(all_x0)):
        if all_x0[i] - all_x0[i - 1] > gap_threshold:
            column_boundaries.append(all_x0[i])

    if len(column_boundaries) < 2:
        return [words]

    # Assign words to columns based on which boundary they're closest to
    columns = [[] for _ in column_boundaries]
    for w in words:
        best_col = 0
        min_dist = float("inf")
        for idx, boundary in enumerate(column_boundaries):
            dist = abs(w["x0"] - boundary)
            if dist < min_dist:
                min_dist = dist
                best_col = idx
        columns[best_col].append(w)

    # Remove empty columns
    columns = [col for col in columns if col]
    return columns


def _words_to_lines(words, line_tolerance=3):

    if not words:
        return []

    # Sort by vertical position first
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))

    lines = []
    current_line_words = [sorted_words[0]]
    current_top = sorted_words[0]["top"]

    for w in sorted_words[1:]:
        if abs(w["top"] - current_top) <= line_tolerance:
            current_line_words.append(w)
        else:
            # Flush current line
            current_line_words.sort(key=lambda x: x["x0"])
            lines.append(" ".join(cw["text"] for cw in current_line_words))
            current_line_words = [w]
            current_top = w["top"]

    # Flush last line
    if current_line_words:
        current_line_words.sort(key=lambda x: x["x0"])
        lines.append(" ".join(cw["text"] for cw in current_line_words))

    return lines


def extract_text_with_layout(pdf_path):
    pdf_path = Path(pdf_path)

    pages_data = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=True,
                use_text_flow=False,
            )

            columns = _cluster_columns(words)

            pages_data.append({
                "page_number": page_num,
                "width": float(page.width),
                "height": float(page.height),
                "words": words,
                "columns": columns,
                "num_columns": len(columns),
            })

    return pages_data


def extract_text_from_pdf(pdf_path):

    pages_data = extract_text_with_layout(pdf_path)
    all_text_parts = []

    for page_data in pages_data:
        columns = page_data["columns"]

        if not columns:
            continue

        page_lines = []
        # Read each column independently (left-to-right order)
        for col_words in columns:
            col_lines = _words_to_lines(col_words)
            page_lines.extend(col_lines)

        all_text_parts.append("\n".join(page_lines))

    return "\n\n".join(all_text_parts)
