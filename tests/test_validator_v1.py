"""Deterministic and privacy-safe tests for DSM-ES-VALIDATOR-001/V1."""
from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from validator import validate_document
from validator.cli import DuplicateKeyError, read_json

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = json.loads((ROOT / "examples" / "synthetic-physics.json").read_text(encoding="utf-8"))


def document(**overrides):
    doc = copy.deepcopy(EXAMPLE)
    doc["translation_status"] = "REVIEWED"
    doc.update(overrides)
    return doc


def codes(result):
    return {f["code"] for f in result["findings"]}


class MetadataValidatorTests(unittest.TestCase):
    def test_synthetic_fixture_needs_translation_review(self):
        r = validate_document(EXAMPLE)
        self.assertEqual(r["overall"], "REVIEW")
        self.assertIn("TRANSLATION_REVIEW_REQUIRED", codes(r))
        self.assertEqual(r["checks"]["lrs_adaptation"], "NOT_TESTED")

    def test_well_structured_study_passes_v1_only(self):
        r = validate_document(document())
        self.assertEqual(r["overall"], "PASS")
        self.assertTrue(r["not_an_official_approval"])
        self.assertEqual(r["checks"]["source_fidelity"], "NOT_TESTED")
        self.assertEqual(r["checks"]["translation_quality"], "NOT_TESTED")

    def test_missing_required_metadata_fails(self):
        d = document()
        d.pop("title")
        r = validate_document(d)
        self.assertEqual(r["overall"], "FAIL")
        self.assertIn("SCHEMA_REQUIRED", codes(r))

    def test_unknown_property_fails_schema(self):
        r = validate_document(document(secret_flag="bad"))
        self.assertIn("SCHEMA_ADDITIONALPROPERTIES", codes(r))

    def test_invalid_calendar_date_fails(self):
        r = validate_document(document(date="2026-02-30"))
        self.assertIn("SCHEMA_FORMAT", codes(r))

    def test_source_as_support_fails(self):
        r = validate_document(document(support_languages=["de", "it"]))
        self.assertIn("SOURCE_AS_SUPPORT", codes(r))

    def test_missing_source_text_fails(self):
        d = document()
        d["sections"][0]["texts"].pop("de")
        self.assertIn("SOURCE_TEXT_MISSING", codes(validate_document(d)))

    def test_missing_support_translation_fails(self):
        d = document()
        d["sections"][0]["texts"].pop("it")
        self.assertIn("SUPPORT_TEXT_MISSING", codes(validate_document(d)))

    def test_undeclared_language_fails(self):
        d = document(support_languages=[], translation_status="NOT_APPLICABLE")
        self.assertIn("UNDECLARED_LANGUAGE", codes(validate_document(d)))

    def test_untranslated_document_requires_not_applicable(self):
        d = document(support_languages=[], translation_status="DRAFT")
        d["sections"][0]["texts"].pop("it")
        self.assertIn("TRANSLATION_STATUS_UNUSED", codes(validate_document(d)))

    def test_answer_area_required(self):
        d = document()
        d["sections"][0]["answer_area"] = "NONE"
        self.assertIn("ANSWER_AREA_MISSING", codes(validate_document(d)))

    def test_duplicate_section_id(self):
        d = document()
        d["sections"].append(copy.deepcopy(d["sections"][0]))
        self.assertIn("DUPLICATE_SECTION_ID", codes(validate_document(d)))

    def test_point_total_mismatch(self):
        d = document(max_points=20)
        self.assertIn("POINTS_MISMATCH", codes(validate_document(d)))

    def test_point_total_correct(self):
        d = document(max_points=2)
        self.assertNotIn("POINTS_MISMATCH", codes(validate_document(d)))

    def test_missing_points_review(self):
        d = document(max_points=2)
        d["sections"][0].pop("points")
        self.assertIn("POINTS_INCOMPLETE", codes(validate_document(d)))

    def test_assessment_missing_competence_fails(self):
        d = document(profile="ASSESSMENT", use_case="ASSESSMENT",
                     assessment={"restrictions": [], "assessed_competences_per_task": {"other": "Light"}})
        r = validate_document(d)
        self.assertIn("COMPETENCE_MISSING", codes(r))
        self.assertIn("COMPETENCE_ORPHAN", codes(r))
        self.assertEqual(r["checks"]["educational_equivalence"], "NOT_TESTED")

    def test_assessment_no_assessment_object_fails(self):
        d = document(profile="ASSESSMENT", use_case="ASSESSMENT")
        self.assertIn("SCHEMA_REQUIRED", codes(validate_document(d)))

    def test_released_requires_evidence(self):
        r = validate_document(document(status="RELEASED"))
        self.assertIn("EDITOR_APPROVAL_MISSING", codes(r))
        self.assertIn("TRANSLATION_APPROVAL_MISSING", codes(r))

    def test_assessment_with_translation_never_automatic_pass(self):
        d = document(profile="ASSESSMENT", use_case="ASSESSMENT",
                     assessment={"restrictions": [], "assessed_competences_per_task": {"ex01": "Ray path"}})
        self.assertIn("BILINGUAL_ASSESSMENT_HUMAN_REVIEW", codes(validate_document(d)))

    def test_no_source_text_in_report(self):
        d = document()
        d["sections"][0]["texts"]["de"] = "CONFIDENTIAL_SENTINEL_7481"
        report_json = json.dumps(validate_document(d))
        self.assertNotIn("CONFIDENTIAL_SENTINEL", report_json)

    def test_source_sha_is_stable_for_same_bytes(self):
        raw = json.dumps(document(), ensure_ascii=False, sort_keys=True).encode()
        a = validate_document(document(), raw)
        b = validate_document(document(), raw)
        self.assertEqual(a["source_sha256"], b["source_sha256"])
        self.assertEqual(a["schema_sha256"], b["schema_sha256"])

    def test_non_dict_fails_not_crashes(self):
        r = validate_document(["wrong type"])
        self.assertEqual(r["overall"], "FAIL")
        self.assertIn("SCHEMA_TYPE", codes(r))


class CliTests(unittest.TestCase):
    def test_reject_duplicate_json_keys(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "x.json"
            path.write_text('{"title":"one","title":"two"}', encoding="utf-8")
            with self.assertRaises(DuplicateKeyError):
                read_json(path)

    def test_reject_oversized_input(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "x.json"
            path.write_bytes(b"x" * (2 * 1024 * 1024 + 1))
            with self.assertRaises(ValueError):
                read_json(path)

    def test_cli_review_default_exit_zero(self):
        p = subprocess.run([sys.executable, "-m", "validator.cli",
                            str(ROOT / "examples" / "synthetic-physics.json"), "--json"],
                           cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout)["overall"], "REVIEW")

    def test_cli_strict_review_exit_one(self):
        p = subprocess.run([sys.executable, "-m", "validator.cli",
                            str(ROOT / "examples" / "synthetic-physics.json"), "--strict-review"],
                           cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(p.returncode, 1)

    def test_cli_nonexistent_file_exit_two(self):
        p = subprocess.run([sys.executable, "-m", "validator.cli", "missing.json"],
                           cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(p.returncode, 2)
        self.assertNotIn("Traceback", p.stderr)


if __name__ == "__main__":
    unittest.main()
