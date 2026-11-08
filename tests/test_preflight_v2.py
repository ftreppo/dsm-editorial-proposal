"""DSM-ES V2 document preflight — synthetic files only, no pupil material."""
from __future__ import annotations

from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

import pymupdf
from docx import Document
from docx.shared import Mm

from validator.preflight_v2 import InputRejected, MAX_BYTES, MAX_PAGES, validate_file

ROOT = Path(__file__).resolve().parents[1]


def make_pdf(*, width: float=595.276, height: float=841.89,
             text: bool=True, pages: int=1, tiny: bool=False) -> bytes:
    doc = pymupdf.open()
    for _ in range(pages):
        page = doc.new_page(width=width, height=height)
        if text:
            page.insert_text((40, 80), "Synthetic A4 sample only", fontsize=7 if tiny else 12)
    data = doc.tobytes()
    doc.close()
    return data


def make_docx(*, width: float=210, height: float=297, margin: float=18,
              body: bool=True, heading: bool=True) -> bytes:
    d = Document()
    section = d.sections[0]
    section.page_width = Mm(width)
    section.page_height = Mm(height)
    section.top_margin = Mm(margin)
    section.bottom_margin = Mm(margin)
    section.left_margin = Mm(margin)
    section.right_margin = Mm(margin)
    if heading:
        d.add_heading("Synthetic document", 1)
    if body:
        d.add_paragraph("Synthetic text without personal information")
    stream = BytesIO()
    d.save(stream)
    return stream.getvalue()


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)

    def save(self, name: str, data: bytes) -> Path:
        p = self.root / name
        p.write_bytes(data)
        return p

    def test_pdf_a4_geometry_detected_and_manual_review_mandatory(self):
        r = validate_file(self.save("a.pdf", make_pdf()))
        self.assertEqual(r["overall"], "REVIEW")
        self.assertEqual(r["file_type"], "PDF")
        self.assertEqual(r["metrics"]["pages"], 1)
        self.assertEqual(r["metrics"]["a4_portrait_pages"], 1)
        self.assertEqual(r["metrics"]["text_extractable_pages"], 1)
        self.assertEqual(r["checks"]["page_geometry"], "PASS")
        self.assertEqual(r["checks"]["pdf_ua_accessibility"], "NOT_TESTED")

    def test_pdf_landscape_requires_review(self):
        r = validate_file(self.save("landscape.pdf", make_pdf(width=841.89, height=595.276)))
        self.assertIn("NON_A4_PORTRAIT", self.codes(r))
        self.assertEqual(r["checks"]["page_geometry"], "REVIEW")

    def test_pdf_scanned_or_blank_requires_review(self):
        r = validate_file(self.save("blank.pdf", make_pdf(text=False)))
        self.assertIn("PDF_TEXT_NOT_EXTRACTABLE", self.codes(r))

    def test_pdf_small_text_requires_review(self):
        r = validate_file(self.save("small.pdf", make_pdf(tiny=True)))
        self.assertIn("SMALL_TEXT_DETECTED", self.codes(r))

    def test_pdf_too_many_pages_fails_closed(self):
        r = validate_file(self.save("pages.pdf", make_pdf(pages=MAX_PAGES+1)))
        self.assertEqual(r["overall"], "FAIL")
        self.assertIn("PDF_PAGE_LIMIT", self.codes(r))
        self.assertEqual(r["checks"]["text_extractability"], "NOT_TESTED")

    def test_pdf_corrupt_rejected(self):
        r = validate_file(self.save("damaged.pdf", b"%PDF-1.7\nnot-real-document"))
        self.assertEqual(r["overall"], "FAIL")
        self.assertEqual(r["checks"]["page_geometry"], "NOT_TESTED")

    def test_docx_a4_section_and_body(self):
        r = validate_file(self.save("sample.docx", make_docx()))
        self.assertEqual(r["overall"], "REVIEW")
        self.assertEqual(r["metrics"]["a4_portrait_sections"], 1)
        self.assertEqual(r["checks"]["page_geometry"], "PASS")
        self.assertEqual(r["checks"]["visual_rendering"], "NOT_TESTED")

    def test_docx_us_letter_requires_review(self):
        r = validate_file(self.save("letter.docx", make_docx(width=215.9, height=279.4)))
        self.assertIn("NON_A4_PORTRAIT", self.codes(r))

    def test_docx_narrow_margins_requires_review(self):
        r = validate_file(self.save("narrow.docx", make_docx(margin=8)))
        self.assertIn("NARROW_SECTION_MARGINS", self.codes(r))

    def test_docx_empty_body_requires_review(self):
        r = validate_file(self.save("empty.docx", make_docx(body=False,heading=False)))
        self.assertIn("DOCX_NO_BODY_TEXT", self.codes(r))

    def test_docx_corrupted_zip_fails(self):
        r = validate_file(self.save("broken.docx", b"not a zip"))
        self.assertEqual(r["overall"], "FAIL")
        self.assertIn("INVALID_DOCX_CONTAINER", self.codes(r))

    def test_docx_zipbomb_rejected_before_decompression(self):
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as out:
            out.writestr("[Content_Types].xml", "<Types/>")
            out.writestr("word/document.xml", b"x" * (25 * 1024 * 1024))
        self.assertLess(len(buffer.getvalue()), MAX_BYTES)
        r = validate_file(self.save("zipbomb.docx", buffer.getvalue()))
        self.assertEqual(r["overall"], "FAIL")
        self.assertTrue({"DOCX_DECOMPRESSION_LIMIT", "DOCX_COMPRESSION_RATIO"} & self.codes(r))

    def test_docx_path_traversal_rejected(self):
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w") as out:
            out.writestr("[Content_Types].xml", "<Types/>")
            out.writestr("word/document.xml", "<w:document/>")
            out.writestr("../external", "unsafe")
        r = validate_file(self.save("traversal.docx", buffer.getvalue()))
        self.assertEqual(r["overall"], "FAIL")
        self.assertIn("DOCX_UNSAFE_PATH", self.codes(r))

    def test_html_valid_accessibility_basics(self):
        markup = b'<html lang="it"><main><h1>Prova sintetica</h1><img src="x" alt="schema"></main></html>'
        r = validate_file(self.save("sample.html", markup))
        self.assertEqual(r["overall"], "REVIEW")
        self.assertEqual(r["checks"]["basic_accessibility"], "PASS")
        self.assertEqual(r["metrics"]["h1_elements"], 1)
        self.assertEqual(r["checks"]["wcag_full_accessibility"], "NOT_TESTED")

    def test_html_missing_alt_and_lang(self):
        markup = b'<html><main><h1>Test</h1><img src="x"></main></html>'
        r = validate_file(self.save("missing.htm", markup))
        self.assertIn("HTML_LANG_MISSING", self.codes(r))
        self.assertIn("HTML_IMAGE_ALT_MISSING", self.codes(r))
        self.assertEqual(r["checks"]["basic_accessibility"], "REVIEW")

    def test_html_script_present_no_execution(self):
        markup = b'<html lang="de"><main><h1>Hallo</h1><script>throw "SENTINEL";</script></main></html>'
        r = validate_file(self.save("script.html", markup))
        self.assertIn("HTML_SCRIPT_PRESENT", self.codes(r))
        self.assertNotIn("SENTINEL", json.dumps(r))

    def test_html_non_utf8_fails(self):
        r = validate_file(self.save("bad.html", b"<html>\xff</html>"))
        self.assertIn("HTML_UTF8_REQUIRED", self.codes(r))

    def test_document_content_and_filename_not_in_report(self):
        markup = b'<html lang="it"><main><h1>PRIVATE_PUPIL_8297</h1></main></html>'
        r = validate_file(self.save("PRIVATE_PUPIL_8297.html", markup))
        output = json.dumps(r)
        self.assertNotIn("PRIVATE_PUPIL_8297", output)
        self.assertEqual(len(r["source_sha256"]), 64)

    def test_oversize_hard_rejection(self):
        with self.assertRaises(InputRejected) as ctx:
            validate_file(self.save("big.html", b"x" * (MAX_BYTES+1)))
        self.assertEqual(ctx.exception.code, "FILE_TOO_LARGE")

    def test_unknown_suffix_rejected(self):
        with self.assertRaises(InputRejected):
            validate_file(self.save("bad.exe", b"abc"))

    def test_cli_pdf_review_json_is_content_free(self):
        path = self.save("sample.pdf", make_pdf())
        output = subprocess.run([sys.executable, "-m", "validator.file_cli", str(path), "--json"],
                                cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(output.returncode, 0, output.stderr)
        report = json.loads(output.stdout)
        self.assertEqual(report["overall"], "REVIEW")
        self.assertEqual(report["file_type"], "PDF")

    def test_cli_strict_review_exit_one(self):
        path = self.save("sample.html", b'<html lang="de"><main><h1>Test</h1></main></html>')
        result = subprocess.run([sys.executable, "-m", "validator.file_cli", str(path),
                                 "--strict-review"], cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 1)

    def test_cli_unknown_file_exit_two(self):
        output = subprocess.run([sys.executable, "-m", "validator.file_cli", str(self.root/"none.pdf")],
                                cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(output.returncode, 2)
        self.assertNotIn(str(self.root), output.stderr)

    @staticmethod
    def codes(report: dict) -> set[str]:
        return {item["code"] for item in report["findings"]}


if __name__ == "__main__":
    unittest.main()
