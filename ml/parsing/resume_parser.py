# Wires pdf_extractor → text_sanitizer → section_segmenter → experience_parser.

import json
import sys
from pathlib import Path

from backend.ml.parsing.pdf_extractor import extract_text_from_pdf, extract_text_with_layout
from backend.ml.parsing.text_sanitizer import sanitize_text
from backend.ml.parsing.section_segmenter import detect_sections
from backend.ml.parsing.experience_parser import parse_experience_entries, compute_total_experience_months


def parse_resume(pdf_path):

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return {
            "status": "error",
            "message": f"File not found: {pdf_path}",
        }

    if pdf_path.suffix.lower() != ".pdf":
        return {
            "status": "error",
            "message": f"Not a PDF file: {pdf_path}",
        }

    try:
        # Step 1: Extract text with full layout/coordinate data
        pages_data = extract_text_with_layout(str(pdf_path))

        # Step 2: Also get the column-corrected raw text
        raw_text = extract_text_from_pdf(str(pdf_path))

        # Guard: empty extraction
        if not raw_text or not raw_text.strip():
            return {
                "status": "error",
                "message": "Unintelligible document structure",
            }

        # Step 3: Sanitize — fix columns, unicode artifacts, line breaks
        sanitized = sanitize_text(raw_text, pages_data)

        # Guard: sanitization produced empty result
        if not sanitized or not sanitized.strip():
            return {
                "status": "error",
                "message": "Unintelligible document structure",
            }

        # Step 4: Segment into structured JSON buckets
        result = detect_sections(sanitized)

        # Step 5: Parse experience block into structured entries
        if result.get("status") == "success":
            experience_entries = parse_experience_entries(
                result.get("experience_block_raw", "")
            )
            result["experience_entries"] = experience_entries
            result["total_experience_months"] = compute_total_experience_months(
                experience_entries
            )

        return result

    except Exception as e:
        return {
            "status": "error",
            "message": f"Parse error: {str(e)}",
        }


pdf_file = "ruvan_resume.pdf"
result = parse_resume(pdf_file)

print(json.dumps(result, indent=2))
