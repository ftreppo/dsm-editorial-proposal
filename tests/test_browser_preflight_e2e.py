"""E2E on-device browser smoke test for DSM-ES V2b (synthetic data only).

Requires playwright Chromium on a temporary CI runner. The test site is served
from 127.0.0.1; no student documents, remote analytics or external uploads.
"""
from __future__ import annotations

import functools
import http.server
from io import BytesIO
from pathlib import Path
import threading
import unittest
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def synthetic_docx() -> bytes:
    content_types = ('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/'
                     'package/2006/content-types"></Types>')
    document = ('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/'
                'wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'
                'SYNTHETIC SAMPLE NO PUPIL DATA'
                '</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
                '<w:pgMar w:top="1020" w:bottom="1020" w:left="1020" '
                'w:right="1020"/></w:sectPr></w:body></w:document>')
    out = BytesIO()
    with zipfile.ZipFile(out, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("word/document.xml", document)
    return out.getvalue()


class QuietHttpServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        self.send_error(405)


class BrowserSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(QuietHttpServer, directory=str(DOCS))
        cls.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.host, cls.port = cls.httpd.server_address
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, args=["--no-sandbox"])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        self.page = self.browser.new_page(accept_downloads=True)
        self.requests = []
        self.page.on("request", lambda r: self.requests.append((r.method, r.url)))
        self.page.goto(f"http://{self.host}:{self.port}/validate.html?lang=it")
        self.page.locator("#documentFile").wait_for()

    def tearDown(self):
        self.assertFalse(any(m != "GET" for m, _ in self.requests),
                         "Unexpected non-GET request (possible upload)")
        self.assertFalse(any(not url.startswith(f"http://{self.host}:{self.port}/")
                             for _, url in self.requests), "Unexpected network origin")
        self.page.close()

    def choose(self, name: str, content: bytes, mime: str):
        self.page.locator("#documentFile").set_input_files({
            "name": name, "mimeType": mime, "buffer": content
        })
        self.page.locator("#run").click()
        self.page.locator("#status").wait_for(state="visible")
        self.page.wait_for_function("document.querySelector('#save')?.disabled === false")

    def test_json_fixture_review_with_schema_from_same_origin(self):
        data = (ROOT / "examples" / "synthetic-physics.json").read_bytes()
        self.choose("synthetic.json", data, "application/json")
        self.assertEqual(self.page.locator("#status").inner_text(), "REVIEW")
        self.assertIn("TRANSLATION_REVIEW_REQUIRED", self.page.locator("#findings").inner_text())

    def test_docx_preflight_on_device_and_download_report(self):
        self.choose("synthetic.docx", synthetic_docx(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.assertEqual(self.page.locator("#status").inner_text(), "REVIEW")
        self.assertIn("SHA-256", self.page.locator("#reportHash").inner_text())
        with self.page.expect_download() as download_info:
            self.page.locator("#save").click()
        download = download_info.value
        self.assertEqual(download.suggested_filename, "dsm-es-validation-report.json")

    def test_invalid_pdf_signature_but_broken_body_fails_closed(self):
        sample = b"%PDF-1.7\n% SYNTHETIC TEST ONLY\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
        self.choose("sample.pdf", sample, "application/pdf")
        self.assertEqual(self.page.locator("#status").inner_text(), "FAIL")
        self.assertIn("PDF_PARSE_FAILED", self.page.locator("#findings").inner_text())

    def test_language_switch_german(self):
        self.page.locator('[data-lang="de"]').click()
        self.assertEqual(self.page.locator("html").get_attribute("lang"), "de")
        self.assertIn("DOCX", self.page.locator("#fileHelp").inner_text())


if __name__ == "__main__":
    unittest.main()
