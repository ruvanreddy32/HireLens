#reads page geometry, bounding boxes, text words, and hyperlink annotations in a single disk I/O pass.

from pathlib import Path
import pdfplumber


def _cluster_columns(words, gap_threshold_ratio=0.35):
    """Cluster words into columns based on horizontal gap detection."""
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

    # Assign words to closest column boundary
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

    return [col for col in columns if col]


def _tag_words_with_hyperlinks(words, hyperlinks):
    """Tag words that intersect with PDF hyperlink annotations."""
    if not words or not hyperlinks:
        return
    for link_id, link in enumerate(hyperlinks):
        uri = link.get("uri")
        if isinstance(uri, bytes):
            uri = uri.decode("utf-8", errors="ignore")
        if not uri or not str(uri).strip():
            continue
        uri = str(uri).strip()
        lx0, ltop, lx1, lbottom = link["x0"], link["top"], link["x1"], link["bottom"]
        for w in words:
            x_overlap = max(0.0, min(w["x1"], lx1) - max(w["x0"], lx0))
            y_overlap = max(0.0, min(w["bottom"], lbottom) - max(w["top"], ltop))
            if x_overlap > 0.0 and y_overlap > 0.0:
                w["uri"] = uri
                w["link_id"] = link_id


def _format_words_into_line(line_words: list[dict]) -> str:
    """Format words into a line string, rendering hyperlinks as markdown."""
    tokens: list[str] = []
    i = 0
    n = len(line_words)
    while i < n:
        w = line_words[i]
        uri = w.get("uri")
        link_id = w.get("link_id")
        if uri and link_id is not None:
            phrase = [w["text"]]
            j = i + 1
            while j < n and line_words[j].get("link_id") == link_id:
                phrase.append(line_words[j]["text"])
                j += 1
            full_phrase = " ".join(phrase).strip()
            if uri.startswith("mailto:"):
                # Clean mailto prefix so email address remains cleanly formatted
                clean_email = uri.replace("mailto:", "").strip()
                tokens.append(clean_email or full_phrase)
            elif (
                full_phrase.startswith("http://")
                or full_phrase.startswith("https://")
                or full_phrase.startswith("www.")
            ):
                # Text is already an explicit URL
                tokens.append(full_phrase)
            else:
                tokens.append(f"[{full_phrase}]({uri})")
            i = j
        else:
            tokens.append(w["text"])
            i += 1
    return " ".join(tokens)


def _words_to_lines(words, line_tolerance=3):
    """Group words into sorted text lines by vertical position."""
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
            lines.append(_format_words_into_line(current_line_words))
            current_line_words = [w]
            current_top = w["top"]

    # Flush last line
    if current_line_words:
        current_line_words.sort(key=lambda x: x["x0"])
        lines.append(_format_words_into_line(current_line_words))

    return lines


def extract_text_with_layout(pdf_path):
    """Extract per-page word and layout data from a PDF."""
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

            hyperlinks = getattr(page,"hyperlinks",[])
            _tag_words_with_hyperlinks(words, hyperlinks)

            columns = _cluster_columns(words)

            pages_data.append({
                "page_number": page_num,
                "width": float(page.width),
                "height": float(page.height),
                "words": words,
                "columns": columns,
                "num_columns": len(columns),
                "hyperlinks": hyperlinks,
            })

    return pages_data


def _format_pages_data_to_text(pages_data: list[dict]) -> str:
    """Format extracted page layout columns into multi-column ordered text."""
    all_text_parts = []
    for page_data in pages_data:
        columns = page_data.get("columns", [])
        if not columns:
            continue

        page_lines = []
        # Read each column independently (left-to-right order)
        for col_words in columns:
            col_lines = _words_to_lines(col_words)
            page_lines.extend(col_lines)

        all_text_parts.append("\n".join(page_lines))

    return "\n\n".join(all_text_parts)


def extract_pdf_content(pdf_path: str | Path):
    pages_data = extract_text_with_layout(pdf_path)
    raw_text = _format_pages_data_to_text(pages_data)
    return raw_text, pages_data


def extract_text_from_pdf(pdf_path: str | Path, pages_data: list[dict] | None = None) -> str:
    """Extract multi-column ordered text with markdown hyperlinks from a PDF.

    If pages_data is already available, reuses it without reopening the PDF.
    """
    if pages_data is None:
        pages_data = extract_text_with_layout(pdf_path)
    return _format_pages_data_to_text(pages_data)

