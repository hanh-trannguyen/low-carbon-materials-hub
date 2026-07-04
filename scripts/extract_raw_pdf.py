#!/usr/bin/env python3
"""Extract PDF text with Tesseract OCR for every page."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf


DEFAULT_INPUT_DIR = "Resources"
DEFAULT_OUTPUT_DIR = ".extraction-raw"
DEFAULT_LANGUAGE = "eng"
DEFAULT_OCR_DPI = int(os.environ.get("OCR_DPI", "200"))
DEFAULT_ROTATIONS = [0]
FALLBACK_ROTATIONS = [90, 270]
DEFAULT_PSMS = [4]
ROTATED_TABLE_PSMS = [12]
OCR_KEYWORDS = ["A1", "A2", "A3", "GWP", "CO2", "PERE", "PENRE", "Table"]


def slugify(file_name: str) -> str:
    stem = Path(file_name).stem.lower()
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-")


def render_page(page: pymupdf.Page, image_path: Path, rotation: int, dpi: int) -> None:
    scale = dpi / 72
    matrix = pymupdf.Matrix(scale, scale).prerotate(rotation)
    pixmap = page.get_pixmap(matrix=matrix)
    if pixmap.alpha:
        pixmap = pymupdf.Pixmap(pixmap, 0)
    pixmap.save(image_path)


def run_tesseract(image_path: Path, language: str, psm: int) -> str:
    try:
        result = subprocess.run(
            [
                "tesseract",
                str(image_path),
                "stdout",
                "-l",
                language,
                "--psm",
                str(psm),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        raise SystemExit("Missing dependency: Tesseract must be installed and available on PATH.")

    if result.returncode != 0:
        return ""

    return result.stdout.strip()


def score_text(text: str) -> int:
    score = 0
    # Number of formatted numbers (scientific notation and decimals)
    scientific_notations = len(re.findall(r'[+-]?\b\d+\.\d+[eE][+-]?\d+\b', text))
    decimals = len(re.findall(r'[+-]?\b\d+\.\d+\b', text))
    score += scientific_notations * 100
    score += decimals * 20

    # Keywords with word boundaries
    for keyword in OCR_KEYWORDS:
        matches = len(re.findall(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE))
        score += matches * 100

    # Common EPD/LCA words
    epd_words = [
        "cradle", "gate", "declared", "unit", "carbon", "warming", "potential",
        "total", "impact", "indicators", "stage", "product", "fossil", "biogenic",
        "acidification", "eutrophication", "ozone", "depletion", "primary", "resource",
        "use", "waste", "disposed", "recycling", "landfill", "results", "module",
        "reported", "functional", "scenario", "transport", "electricity"
    ]
    for word in epd_words:
        matches = len(re.findall(r'\b' + re.escape(word) + r'\b', text, re.IGNORECASE))
        score += matches * 50

    # Alphanumeric characters contribution capped to prevent gibberish bias
    alnum_count = sum(char.isalnum() for char in text)
    score += min(alnum_count, 500)

    return score


def has_table_numbers(text: str) -> bool:
    scientific_notations = len(re.findall(r'[+-]?\b\d+\.\d+[eE][+-]?\d+\b', text))
    decimals = len(re.findall(r'[+-]?\b\d+\.\d+\b', text))
    return scientific_notations >= 5 or scientific_notations + decimals >= 8


def page_has_vertical_text(page: pymupdf.Page) -> bool:
    text_dict = page.get_text("dict")
    horizontal_chars = 0
    vertical_chars = 0

    for block in text_dict.get("blocks", []):
        for line in block.get("lines", []):
            char_count = sum(len(span.get("text", "")) for span in line.get("spans", []))
            direction = tuple(round(value) for value in line.get("dir", (1, 0)))
            if direction == (1, 0):
                horizontal_chars += char_count
            else:
                vertical_chars += char_count

    return vertical_chars > horizontal_chars


def page_rotations(page: pymupdf.Page) -> list[int]:
    if page_has_vertical_text(page):
        return [270, 90, 0]
    return DEFAULT_ROTATIONS


def page_psms(page: pymupdf.Page) -> list[int]:
    return ROTATED_TABLE_PSMS if page_has_vertical_text(page) else DEFAULT_PSMS


def extract_page(page: pymupdf.Page, page_number: int, temp_dir: Path, language: str, dpi: int) -> str:
    native_text = page.get_text("text").strip()
    native_has_table_numbers = has_table_numbers(native_text)
    best_text = native_text if native_has_table_numbers else ""
    best_score = score_text(native_text) if native_has_table_numbers else -1

    if best_score >= 1000 and native_has_table_numbers:
        return native_text

    # First, always try rotation 0 with default PSMs
    for psm in DEFAULT_PSMS:
        image_path = temp_dir / f"page-{page_number}-r0.png"
        render_page(page, image_path, 0, dpi)
        text = run_tesseract(image_path, language, psm)
        score = score_text(text)
        if score > best_score:
            best_text = text
            best_score = score

    # If the score is high enough, we can assume the page is oriented correctly and stop early
    if best_score >= 1000:
        return best_text

    # Otherwise, try rotations 90 and 270 (with both default and rotated table PSMs)
    for rotation in FALLBACK_ROTATIONS:
        image_path = temp_dir / f"page-{page_number}-r{rotation}.png"
        render_page(page, image_path, rotation, dpi)
        for psm in DEFAULT_PSMS + ROTATED_TABLE_PSMS:
            text = run_tesseract(image_path, language, psm)
            score = score_text(text)
            if score > best_score:
                best_text = text
                best_score = score

    # Also try rotated table PSMs on rotation 0
    image_path = temp_dir / f"page-{page_number}-r0.png"
    for psm in ROTATED_TABLE_PSMS:
        text = run_tesseract(image_path, language, psm)
        score = score_text(text)
        if score > best_score:
            best_text = text
            best_score = score

    return best_text if best_text else native_text


def extract_pdf(pdf_path: Path, language: str, dpi: int) -> dict:
    doc = pymupdf.open(pdf_path)

    try:
        pages = []
        with tempfile.TemporaryDirectory() as temp_dir_name:
            temp_dir = Path(temp_dir_name)

            for page_index, page in enumerate(doc):
                page_number = page_index + 1
                text = extract_page(page, page_number, temp_dir, language, dpi)
                pages.append({"page": page_number, "text": text})

        return {
            "id": slugify(pdf_path.name),
            "sourcePdf": str(pdf_path),
            "pages": pages,
        }
    finally:
        doc.close()


def resolve_pdf_files(args: argparse.Namespace, input_dir: Path) -> list[Path]:
    if args.pdf:
        pdf_files = []
        for pdf in args.pdf:
            pdf_path = Path(pdf)
            if not pdf_path.is_absolute():
                if not pdf_path.exists():
                    pdf_path = input_dir / pdf_path
            pdf_files.append(pdf_path)
    else:
        pdf_files = sorted(input_dir.glob("*.pdf"))

    return pdf_files[: args.limit] if args.limit is not None else pdf_files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default=DEFAULT_INPUT_DIR, help="Directory containing source PDF files.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_DIR, help="Directory for raw extraction JSON files.")
    parser.add_argument("--limit", type=int, default=None, help="Process only the first N PDFs.")
    parser.add_argument("--pdf", action="append", help="Specific PDF filename or path to process.")
    parser.add_argument("--language", default=DEFAULT_LANGUAGE, help="Tesseract language code.")
    parser.add_argument("--ocr-dpi", type=int, default=DEFAULT_OCR_DPI, help="DPI used when rendering pages for OCR.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    if args.ocr_dpi < 72:
        print("--ocr-dpi must be at least 72", file=sys.stderr)
        return 2

    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}", file=sys.stderr)
        return 2

    pdf_files = resolve_pdf_files(args, input_dir)

    missing = [str(pdf_path) for pdf_path in pdf_files if not pdf_path.exists()]
    if missing:
        print(f"Missing PDF files: {', '.join(missing)}", file=sys.stderr)
        return 2

    if not pdf_files:
        print(f"No PDF files found in {input_dir}", file=sys.stderr)
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)

    for pdf_path in pdf_files:
        extraction = extract_pdf(pdf_path, args.language, args.ocr_dpi)
        output_path = output_dir / f"{extraction['id']}.json"
        output_path.write_text(
            json.dumps(extraction, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"extracted {pdf_path.name} -> {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
