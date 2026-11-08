"""V2c real-browser PDF.js integration tests with synthetic PDF files only.

The test server is localhost; any request to a third-party origin fails.
No real pupils, school records, confidential documents or network uploads.
Requires CI to stage pinned pdfjs-dist under docs/vendor/pdfjs/ first.
"""
from __future__ import annotations

import functools
import http.server
import json
from io import BytesIO
from pathlib import Path
import tempfile
import threading
import unittest

import pymupdf
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/"docs"


def make_pdf(width=595.276,height=841.89,text=True,pages=1):
    pdf=pymupdf.open()
    for i in range(pages):
        page=pdf.new_page(width=width,height=height)
        if text:
            page.insert_text((42,76),"Synthetic geometry and text - no student data",fontsize=12)
    out=pdf.tobytes(garbage=4,deflate=True)
    pdf.close()
    return out


class LocalHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,fmt,*args): pass
    def do_POST(self): self.send_error(405)
    def do_PUT(self): self.send_error(405)


class PDFJsBrowserV2c(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (DOCS/"vendor/pdfjs/pdf.mjs").exists():
            raise RuntimeError("Bundled pdfjs-dist library missing from test directory")
        if not (DOCS/"vendor/pdfjs/pdf.worker.mjs").exists():
            raise RuntimeError("Bundled pdfjs-dist worker missing from test directory")
        handler=functools.partial(LocalHandler,directory=str(DOCS))
        cls.server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
        cls.port=cls.server.server_address[1]
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(headless=True,args=["--no-sandbox"])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page=self.browser.new_page(accept_downloads=True)
        self.requests=[]
        self.page.on("request",lambda req:self.requests.append((req.method,req.url)))
        self.page.goto(f"http://127.0.0.1:{self.port}/validate.html?lang=en")
        self.page.locator("#documentFile").wait_for()
    def tearDown(self):
        self.assertTrue(all(method=="GET" for method,url in self.requests),
                        f"Unexpected upload attempt: {[m for m,u in self.requests if m!='GET']}")
        self.assertTrue(all(url.startswith(f"http://127.0.0.1:{self.port}/")
                            for method,url in self.requests),
                        "Unexpected off-origin network request")
        self.page.close()

    def validate(self,pdf_bytes):
        self.page.locator("#documentFile").set_input_files({
            "name":"SYNTHETIC-PDF.pdf","mimeType":"application/pdf","buffer":pdf_bytes
        })
        self.page.locator("#run").click()
        self.page.wait_for_function("document.querySelector('#reportSection').classList.contains('visible') && !document.querySelector('#run').disabled")
        with self.page.expect_download() as info:
            self.page.locator("#save").click()
        download=info.value
        with tempfile.TemporaryDirectory() as folder:
            dst=Path(folder)/"report.json"
            download.save_as(dst)
            report=json.loads(dst.read_text(encoding="utf-8"))
        return report

    def test_pdf_a4_with_text_is_parsed_by_local_pdfjs(self):
        report=self.validate(make_pdf())
        self.assertEqual(report["overall"],"REVIEW")
        self.assertEqual(report["engine_version"],"DSM-ES-VALIDATOR-002C/pdfjs-v0.1")
        self.assertEqual(report["pdfjs_version"],"6.5.438")
        self.assertEqual(report["metrics"]["pages"],1)
        self.assertEqual(report["metrics"]["a4_portrait_pages"],1)
        self.assertEqual(report["metrics"]["pages_with_extractable_text"],1)
        self.assertEqual(report["checks"]["page_geometry"],"PASS")
        self.assertEqual(report["checks"]["text_extractability"],"PASS")
        self.assertEqual(report["checks"]["pdf_ua_accessibility"],"NOT_TESTED")
        self.assertEqual(report["checks"]["visual_rendering"],"NOT_TESTED")
        self.assertEqual(self.page.locator("#status").inner_text(),"REVIEW")
        self.assertFalse(any(f["code"]=="PDF_ENGINE_UNAVAILABLE" for f in report["findings"]))

    def test_landscape_page_is_review(self):
        r=self.validate(make_pdf(width=841.89,height=595.276))
        self.assertEqual(r["overall"],"REVIEW")
        self.assertEqual(r["checks"]["page_geometry"],"REVIEW")
        self.assertIn("NON_A4_PORTRAIT",[f["code"] for f in r["findings"]])

    def test_blank_page_has_no_extractable_text(self):
        r=self.validate(make_pdf(text=False))
        self.assertEqual(r["overall"],"REVIEW")
        self.assertEqual(r["checks"]["text_extractability"],"REVIEW")
        self.assertIn("PDF_TEXT_NOT_EXTRACTABLE",[f["code"] for f in r["findings"]])

    def test_multi_page_pdf_accounting(self):
        r=self.validate(make_pdf(pages=3))
        self.assertEqual(r["metrics"]["pages"],3)
        self.assertEqual(r["metrics"]["a4_portrait_pages"],3)
        self.assertEqual(r["metrics"]["pages_with_extractable_text"],3)

    def test_valid_header_but_invalid_pdf_fails(self):
        r=self.validate(b"%PDF-1.7\nINVALID_SYNTHETIC_BYTES\n%%EOF\n")
        self.assertEqual(r["overall"],"FAIL")
        self.assertIn("PDF_PARSE_FAILED",[f["code"] for f in r["findings"]])
        self.assertEqual(r["checks"]["page_geometry"],"NOT_TESTED")

    def test_filenames_and_body_text_absent_from_report(self):
        r=self.validate(make_pdf())
        self.assertNotIn("Synthetic geometry and text",json.dumps(r))
        self.assertNotIn("SYNTHETIC-PDF.pdf",json.dumps(r))
        self.assertIsNotNone(r.get("input_sha256"))
        self.assertEqual(len(r["input_sha256"]),64)


if __name__=="__main__":
    unittest.main()
