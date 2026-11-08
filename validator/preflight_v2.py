"""DSM-ES-VALIDATOR-002 — local structural preflight for PDF, DOCX and HTML.

All inputs remain on device. No OCR, external URLs, font installation, content upload,
execution of scripts/macros, or institutional approval. This is NOT a PDF/UA test.
The report never contains document body text, identifiers, filenames or hyperlinks.
"""
from __future__ import annotations

import hashlib
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
import zipfile
from typing import Any

ENGINE = "DSM-ES-VALIDATOR-002/V2-preflight"
MAX_BYTES = 12 * 1024 * 1024
MAX_PAGES = 50
MAX_ZIP_ENTRIES = 1500
MAX_ZIP_MEMBER = 24 * 1024 * 1024
MAX_ZIP_TOTAL = 96 * 1024 * 1024
A4_MM = (210.0, 297.0)
PAGE_TOL_MM = 3.0
MM_PER_PT = 25.4 / 72.0
_NOT_TESTED = (
    "official_brand_identity", "authorised_logo", "visual_rendering",
    "pdf_ua_accessibility", "wcag_full_accessibility", "lrs_policy",
    "educational_equivalence", "source_fidelity", "translation_quality",
    "privacy_regulatory_compliance"
)


class InputRejected(ValueError):
    """Rejected input with generic, never user-controlled diagnostic code."""
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _finding(category: str, code: str, severity: str, message: str) -> dict[str, str]:
    return {"category": category, "code": code, "severity": severity, "message": message}


def _report(kind: str, raw: bytes, findings: list[dict[str, str]], metrics: dict[str, Any],
            parsed: bool = True) -> dict[str, Any]:
    # Every binary/document preflight requires human inspection. Never report global PASS.
    if not parsed or any(f["severity"] == "FAIL" for f in findings):
        result = "FAIL"
    else:
        result = "REVIEW"
    capabilities = {
        "PDF": frozenset(("file_integrity", "page_geometry", "text_extractability")),
        "DOCX": frozenset(("file_integrity", "page_geometry",
                          "text_extractability", "document_structure")),
        "HTML": frozenset(("file_integrity", "text_extractability",
                          "document_structure", "basic_accessibility")),
    }
    categories = ("file_integrity", "page_geometry", "text_extractability",
                  "document_structure", "basic_accessibility")
    checks: dict[str, str] = {}
    for category in categories:
        active = [f for f in findings if f["category"] == category]
        if not parsed and category != "file_integrity":
            checks[category] = "NOT_TESTED"
        elif any(f["severity"] == "FAIL" for f in active):
            checks[category] = "FAIL"
        elif active:
            checks[category] = "REVIEW"
        elif category not in capabilities.get(kind, ()):
            checks[category] = "NOT_TESTED"
        else:
            checks[category] = "PASS"
    for category in _NOT_TESTED:
        checks[category] = "NOT_TESTED"
    findings.sort(key=lambda f: (f["category"], f["code"]))
    return {
        "report_version": "2.0",
        "engine_version": ENGINE,
        "scope": "Local document-format preflight, not full DSM-ES compliance",
        "file_type": kind,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "overall": result,
        "not_an_official_approval": True,
        "checks": checks,
        "metrics": metrics,
        "findings": findings,
        "finding_count": len(findings),
        "disclaimer": "REVIEW is mandatory: render/visual review, source fidelity, "
                      "translation, LRS authorisation, PDF/UA and DSM brand rights are NOT TESTED."
    }


def _a4(width_mm: float, height_mm: float) -> bool:
    return (abs(width_mm - A4_MM[0]) <= PAGE_TOL_MM
            and abs(height_mm - A4_MM[1]) <= PAGE_TOL_MM)


def _pdf(raw: bytes) -> tuple[list[dict[str, str]], dict[str, Any]]:
    import pymupdf

    results: list[dict[str, str]] = []
    metrics: dict[str, Any] = {}
    if b"%PDF-" not in raw[:1024]:
        raise InputRejected("INVALID_PDF_SIGNATURE")
    try:
        document = pymupdf.open(stream=raw, filetype="pdf")
    except Exception as exc:
        raise InputRejected("UNREADABLE_PDF") from exc
    with document:
        if document.needs_pass:
            raise InputRejected("ENCRYPTED_PDF")
        if not 1 <= len(document) <= MAX_PAGES:
            raise InputRejected("PDF_PAGE_LIMIT")
        metrics["pages"] = len(document)
        size_ok = 0
        pages_with_text = 0
        min_text_size = None
        total_words = 0
        for page in document:
            rect = page.rect
            width, height = rect.width * MM_PER_PT, rect.height * MM_PER_PT
            if _a4(width, height):
                size_ok += 1
            try:
                words = page.get_text("words")
                spans = page.get_text("dict").get("blocks", [])
            except Exception as exc:
                raise InputRejected("PDF_EXTRACTION_FAILURE") from exc
            total_words += len(words)
            if words:
                pages_with_text += 1
            for block in spans:
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        size = span.get("size")
                        if isinstance(size, (int, float)) and size > 0:
                            min_text_size = size if min_text_size is None else min(min_text_size, size)
        metrics["a4_portrait_pages"] = size_ok
        metrics["text_extractable_pages"] = pages_with_text
        metrics["word_count_approx"] = min(total_words, 1000000)
        metrics["smallest_detected_text_pt"] = round(min_text_size, 1) if min_text_size else None
        if size_ok != len(document):
            results.append(_finding("page_geometry", "NON_A4_PORTRAIT", "REVIEW",
                                     "At least one page differs from A4 portrait (proposed profile)."))
        if pages_with_text != len(document):
            results.append(_finding("text_extractability", "PDF_TEXT_NOT_EXTRACTABLE", "REVIEW",
                                     "At least one page has no extractable text; inspect manually."))
        if min_text_size is not None and min_text_size < 9:
            results.append(_finding("basic_accessibility", "SMALL_TEXT_DETECTED", "REVIEW",
                                     "Some text may be under 9 pt; check legibility on a rendering."))
        if total_words > 75000:
            results.append(_finding("file_integrity", "LARGE_TEXT_CONTENT", "REVIEW",
                                     "High text volume; rendering and extraction should be reviewed."))
        try:
            if document.embfile_count() > 0:
                results.append(_finding("file_integrity", "PDF_EMBEDDED_FILES", "REVIEW",
                                         "PDF contains embedded files; they were not opened."))
        except Exception:
            # This metadata is not essential; don't claim embedded-file absence.
            results.append(_finding("file_integrity", "PDF_ATTACHMENTS_UNKNOWN", "REVIEW",
                                     "Could not inspect embedded-file metadata."))
    return results, metrics


def _safe_zip(data: bytes) -> None:
    if not zipfile.is_zipfile(BytesIO(data)):
        raise InputRejected("INVALID_DOCX_CONTAINER")
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ZIP_ENTRIES:
                raise InputRejected("DOCX_ENTRY_LIMIT")
            total = 0
            for entry in entries:
                name = entry.filename.replace("\\", "/")
                if name.startswith("/") or any(x == ".." for x in name.split("/")):
                    raise InputRejected("DOCX_UNSAFE_PATH")
                total += entry.file_size
                if entry.file_size > MAX_ZIP_MEMBER or total > MAX_ZIP_TOTAL:
                    raise InputRejected("DOCX_DECOMPRESSION_LIMIT")
                if entry.file_size > 1_000_000 and entry.file_size / max(entry.compress_size, 1) > 200:
                    raise InputRejected("DOCX_COMPRESSION_RATIO")
                if name.endswith("vbaProject.bin"):
                    raise InputRejected("DOCX_MACRO_CONTENT")
            names = set(archive.namelist())
            if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                raise InputRejected("DOCX_REQUIRED_XML_MISSING")
    except (OSError, zipfile.BadZipFile) as exc:
        raise InputRejected("UNREADABLE_DOCX") from exc


def _docx(raw: bytes) -> tuple[list[dict[str, str]], dict[str, Any]]:
    from docx import Document

    _safe_zip(raw)
    try:
        document = Document(BytesIO(raw))
    except Exception as exc:
        raise InputRejected("UNREADABLE_DOCX") from exc
    results: list[dict[str, str]] = []
    metrics: dict[str, Any] = {}
    sections = document.sections
    if len(sections) > 50:
        raise InputRejected("DOCX_SECTION_LIMIT")
    metrics["sections"] = len(sections)
    metrics["tables_top_level"] = len(document.tables)
    metrics["paragraphs_top_level"] = len(document.paragraphs)
    all_a4 = True
    narrow = False
    for sec in sections:
        width = sec.page_width.mm if sec.page_width else 0
        height = sec.page_height.mm if sec.page_height else 0
        if not _a4(width, height):
            all_a4 = False
        margins = [sec.top_margin, sec.bottom_margin, sec.left_margin, sec.right_margin]
        if any(v is not None and v.mm < 12 for v in margins):
            narrow = True
    metrics["a4_portrait_sections"] = len(sections) if all_a4 else sum(
        1 for sec in sections if _a4(sec.page_width.mm if sec.page_width else 0,
                                     sec.page_height.mm if sec.page_height else 0))
    if not all_a4:
        results.append(_finding("page_geometry", "NON_A4_PORTRAIT", "REVIEW",
                                 "One or more Word sections are not A4 portrait."))
    if narrow:
        results.append(_finding("page_geometry", "NARROW_SECTION_MARGINS", "REVIEW",
                                 "One or more declared margins are narrower than the proposed 12 mm minimum."))
    visible_parts = sum(bool(p.text.strip()) for p in document.paragraphs)
    visible_parts += sum(bool(c.text.strip()) for t in document.tables
                         for row in t.rows for c in row.cells)
    if not visible_parts:
        results.append(_finding("text_extractability", "DOCX_NO_BODY_TEXT", "REVIEW",
                                 "Word document has no detectable body text."))
    if document.tables and not any(p.style and p.style.name.startswith("Heading") for p in document.paragraphs):
        results.append(_finding("document_structure", "DOCX_HEADING_REVIEW", "REVIEW",
                                 "Heading structure not detected in top-level paragraphs; check navigation."))
    # Not a rendering engine: fonts, page breaks, headers and actual reading order remain unchecked.
    return results, metrics


class _SafeHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root_lang: str | None = None
        self.h1 = 0
        self.images_no_alt = 0
        self.main = 0
        self.script = 0
        self.element_count = 0
        self.body_text_chunks = 0
        self._skip_text_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.element_count += 1
        if self.element_count > 50000:
            raise InputRejected("HTML_ELEMENT_LIMIT")
        attrs_dict = dict(attrs)
        if tag == "html":
            self.root_lang = attrs_dict.get("lang")
        if tag == "h1":
            self.h1 += 1
        if tag == "main":
            self.main += 1
        if tag == "img" and "alt" not in attrs_dict:
            self.images_no_alt += 1
        if tag == "script":
            self.script += 1
        if tag in {"script", "style", "template"}:
            self._skip_text_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "template"} and self._skip_text_depth:
            self._skip_text_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip_text_depth and data.strip():
            self.body_text_chunks += 1


def _html(raw: bytes) -> tuple[list[dict[str, str]], dict[str, Any]]:
    try:
        source = raw.decode("utf-8-sig")
    except UnicodeError as exc:
        raise InputRejected("HTML_UTF8_REQUIRED") from exc
    parser = _SafeHTML()
    try:
        parser.feed(source)
        parser.close()
    except InputRejected:
        raise
    except Exception as exc:
        raise InputRejected("INVALID_HTML") from exc
    results = []
    metrics = {"elements": parser.element_count, "h1_elements": parser.h1,
               "main_landmarks": parser.main, "images_missing_alt": parser.images_no_alt}
    if not parser.root_lang:
        results.append(_finding("basic_accessibility", "HTML_LANG_MISSING", "REVIEW",
                                 "HTML root has no declared language."))
    if parser.h1 != 1:
        results.append(_finding("document_structure", "HTML_H1_COUNT", "REVIEW",
                                 "Expected one primary heading."))
    if parser.main != 1:
        results.append(_finding("document_structure", "HTML_MAIN_LANDMARK", "REVIEW",
                                 "Expected one main landmark."))
    if parser.images_no_alt:
        results.append(_finding("basic_accessibility", "HTML_IMAGE_ALT_MISSING", "REVIEW",
                                 "One or more images lack an alt attribute."))
    if parser.script:
        results.append(_finding("document_structure", "HTML_SCRIPT_PRESENT", "REVIEW",
                                 "Script code was not executed; check document output manually."))
    if not parser.body_text_chunks:
        results.append(_finding("text_extractability", "HTML_NO_TEXT", "REVIEW",
                                 "No non-whitespace text was found."))
    return results, metrics


def validate_file(path: Path) -> dict[str, Any]:
    """Read local file, apply format-specific preflight, return content-free JSON report."""
    suffix = path.suffix.lower()
    if suffix not in (".pdf", ".docx", ".html", ".htm"):
        raise InputRejected("UNSUPPORTED_FILE_TYPE")
    with path.open("rb") as fp:
        raw = fp.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise InputRejected("FILE_TOO_LARGE")
    if not raw:
        raise InputRejected("EMPTY_FILE")
    kind = "HTML" if suffix in (".html", ".htm") else suffix[1:].upper()
    try:
        if kind == "PDF":
            findings, metrics = _pdf(raw)
        elif kind == "DOCX":
            findings, metrics = _docx(raw)
        else:
            findings, metrics = _html(raw)
        return _report(kind, raw, findings, metrics)
    except InputRejected as exc:
        return _report(kind, raw, [_finding("file_integrity", exc.code, "FAIL",
                                           "Input was rejected; no document content was processed.")],
                       {}, parsed=False)
