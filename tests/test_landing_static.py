"""Offline static smoke checks for the proposed DSM-ES landing page.

No network, school data or third-party dependencies are required.
"""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "docs" / "index.html"


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.links = []
        self.lang_buttons = []
        self.scripts = []
        self.forms = 0
        self.inputs = []
        self.label_count = 0
        self.headings = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a":
            self.links.append(a.get("href", ""))
        if tag == "button" and "data-lang" in a:
            self.lang_buttons.append(a["data-lang"])
        if tag == "script":
            self.scripts.append(a.get("src"))
        if tag == "form":
            self.forms += 1
        if tag == "input":
            self.inputs.append(a.get("type"))
        if tag == "label":
            self.label_count += 1
        if tag == "h1":
            self.headings.append(tag)


class LandingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = SITE.read_text(encoding="utf-8")
        cls.html = SiteParser()
        cls.html.feed(cls.raw)

    def test_expected_sections_present(self):
        for section in ("main", "guide", "prompt-section", "formats", "status", "collaboration", "prompt", "copyPrompt"):
            self.assertIn(section, self.html.ids)
        self.assertEqual(len(self.html.ids), len(set(self.html.ids)), "duplicate HTML id")

    def test_languages_and_prompt(self):
        self.assertEqual(set(self.html.lang_buttons), {"it", "de", "en"})
        self.assertIn("standard/DSM-ES-v0.1.md", self.raw)
        self.assertIn("prompts/teacher-creator.md", self.raw)
        self.assertIn("ftreppo/dsm-editorial-proposal", self.raw)
        self.assertIn("navigator.clipboard.writeText", self.raw)

    def test_no_upload_or_external_scripts(self):
        self.assertEqual(self.html.forms, 0)
        self.assertEqual(self.html.inputs, [])
        self.assertEqual(self.html.scripts, [None])  # inline script only
        self.assertNotIn("type=\"file\"", self.raw)
        self.assertNotIn("fetch(", self.raw)
        self.assertNotIn("XMLHttpRequest", self.raw)

    def test_accessibility_basics(self):
        self.assertIn('lang="it"', self.raw)
        self.assertTrue(self.html.headings)
        self.assertGreater(self.html.label_count, 0)
        self.assertIn('href="#main"', self.raw)
        self.assertIn("prefers-reduced-motion", self.raw)
        self.assertIn('aria-pressed="true"', self.raw)

    def test_links_are_explicit(self):
        self.assertIn("https://github.com/ftreppo/dsm-editorial-proposal/issues", self.html.links)
        self.assertIn("./validate.html?lang=it", self.html.links)
        self.assertTrue(all(x.startswith(("https://", "#", "./")) for x in self.html.links))


if __name__ == "__main__":
    unittest.main()
