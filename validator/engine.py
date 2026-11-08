"""Deterministic DSM-ES v0.1 metadata and document-structure validator.

No AI calls, uploads, logging of document text, LRS diagnosis or institutional approval.
PASS means *only* the checks listed as executed in the report passed.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "specification" / "document.schema.json"
VERSION = "DSM-ES-VALIDATOR-001/V1"
MAX_BYTES = 2 * 1024 * 1024
UNTESTED = ("visual_identity", "pdf_ua_accessibility", "lrs_adaptation",
            "educational_equivalence", "source_fidelity", "translation_quality")


def issue(category: str, code: str, severity: str, path: str, message: str) -> dict[str, str]:
    return {"category": category, "code": code, "severity": severity,
            "path": path, "message": message}


def _pointer(segments: Any) -> str:
    parts = [str(p).replace("~", "~0").replace("/", "~1") for p in segments]
    return "/" + "/".join(parts) if parts else "/"


def _status(items: list[dict[str, str]]) -> str:
    if any(item["severity"] == "FAIL" for item in items):
        return "FAIL"
    if any(item["severity"] == "REVIEW" for item in items):
        return "REVIEW"
    return "PASS"


def _schema_errors(doc: Any, schema: dict[str, Any]) -> list[dict[str, str]]:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(doc), key=lambda e: (_pointer(e.absolute_path), e.validator or ""))
    # Do not echo values or schema errors that may contain confidential content.
    return [issue("schema", "SCHEMA_" + str(e.validator).upper(),
                  "FAIL", _pointer(e.absolute_path),
                  "JSON Schema rule violated: " + str(e.validator))
            for e in errors]


def validate_document(doc: Any, source_bytes: bytes | None = None,
                      schema: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return deterministic findings with no source text. No exceptions for invalid documents."""
    if schema is None:
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)

    if source_bytes is None:
        source_bytes = json.dumps(doc, sort_keys=True, ensure_ascii=False,
                                  separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(source_bytes) > MAX_BYTES:
        findings = [issue("input", "INPUT_TOO_LARGE", "FAIL", "/",
                          "Document exceeds the 2 MiB limit.")]
    else:
        findings = _schema_errors(doc, schema)
        if not findings:
            findings = _semantic_checks(doc)

    findings.sort(key=lambda x: (x["category"], x["path"], x["code"]))
    status = _status(findings)
    checked_categories = ("schema", "metadata", "languages", "sections", "assessment")
    by_category = {
        category: _status([f for f in findings if f["category"] == category])
        for category in checked_categories
    }
    for name in UNTESTED:
        by_category[name] = "NOT_TESTED"
    if status == "FAIL" and any(f["category"] == "input" for f in findings):
        by_category["schema"] = "NOT_TESTED"

    schema_bytes = json.dumps(schema, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "report_version": "1.0",
        "engine_version": VERSION,
        "standard_version": "DSM-ES-v0.1-community-proposal",
        "scope": "Structured JSON schema and deterministic editorial checks only",
        "overall": status,
        "not_an_official_approval": True,
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "schema_sha256": hashlib.sha256(schema_bytes).hexdigest(),
        "checks": by_category,
        "findings": findings,
        "finding_count": len(findings),
        "disclaimer": "PASS is limited to checked categories; it is not a DSM approval, LRS "
                      "assessment, translation review, PDF/UA claim, or proof of content fidelity.",
    }


def _semantic_checks(doc: dict[str, Any]) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []

    def add(category: str, code: str, severity: str, path: str, message: str) -> None:
        findings.append(issue(category, code, severity, path, message))

    source = doc["source_language"]
    supports = set(doc["support_languages"])
    allowed = set(doc["response_languages"])
    sections = doc["sections"]
    is_assessment = doc["use_case"] == "ASSESSMENT"
    if source in supports:
        add("languages", "SOURCE_AS_SUPPORT", "FAIL", "/support_languages",
            "Support languages must exclude the original source language.")
    if supports and doc["translation_status"] == "NOT_APPLICABLE":
        add("languages", "TRANSLATION_STATUS_INVALID", "FAIL", "/translation_status",
            "A support translation cannot be marked NOT_APPLICABLE.")
    if supports and doc["translation_status"] == "DRAFT":
        add("languages", "TRANSLATION_REVIEW_REQUIRED", "REVIEW", "/translation_status",
            "Support translation is draft; human subject-matter review is required.")
    if not supports and doc["translation_status"] != "NOT_APPLICABLE":
        add("languages", "TRANSLATION_STATUS_UNUSED", "REVIEW", "/translation_status",
            "No support languages are declared; review translation status.")
    if doc["profile"] != "PARENTS" and doc["use_case"] in {"HOMEWORK", "STUDY", "ASSESSMENT"} and not allowed:
        add("languages", "RESPONSE_LANGUAGE_MISSING", "REVIEW", "/response_languages",
            "Declare the permissible response language(s) for student work.")
    if is_assessment and doc["profile"] != "ASSESSMENT":
        add("assessment", "ASSESSMENT_PROFILE_MISMATCH", "FAIL", "/profile",
            "Assessments require the ASSESSMENT profile.")
    if doc["profile"] == "PARENTS" and doc["use_case"] != "NOTICE":
        add("metadata", "PARENTS_USE_CASE_MISMATCH", "REVIEW", "/use_case",
            "Parent-facing material normally uses the NOTICE use case.")

    seen: set[str] = set()
    exercise_ids: set[str] = set()
    exercise_points = 0.0
    missing_points = False
    for idx, section in enumerate(sections):
        sec_id = section["section_id"]
        path = f"/sections/{idx}"
        if sec_id in seen:
            add("sections", "DUPLICATE_SECTION_ID", "FAIL", path + "/section_id",
                "Section IDs must be unique.")
        seen.add(sec_id)
        texts = set(section["texts"].keys())
        if source not in texts:
            add("languages", "SOURCE_TEXT_MISSING", "FAIL", path + "/texts",
                "Source-language text is required in every section.")
        for lang in sorted(supports - texts):
            add("languages", "SUPPORT_TEXT_MISSING", "FAIL", path + "/texts",
                "Declared support-language text is missing.")
        for lang in sorted(texts - (supports | {source})):
            add("languages", "UNDECLARED_LANGUAGE", "FAIL", path + "/texts",
                "Section contains an undeclared language.")
        if section["kind"] == "EXERCISE":
            exercise_ids.add(sec_id)
            if section.get("answer_area") not in {"FULL_WIDTH_TEXT", "FULL_WIDTH_DRAWING"}:
                add("sections", "ANSWER_AREA_MISSING", "FAIL", path + "/answer_area",
                    "Exercise requires a full-width answer area.")
            if "points" in section:
                exercise_points += section["points"]
            else:
                missing_points = True
        elif section.get("answer_area") not in (None, "NONE"):
            add("sections", "PARAGRAPH_ANSWER_AREA", "REVIEW", path + "/answer_area",
                "A paragraph usually should not have an answer area.")

    if "max_points" in doc:
        if missing_points:
            add("sections", "POINTS_INCOMPLETE", "REVIEW", "/max_points",
                "Some exercises omit point values; total cannot be reconciled.")
        elif abs(exercise_points - doc["max_points"]) > 1e-9:
            add("sections", "POINTS_MISMATCH", "FAIL", "/max_points",
                "Total points do not equal the sum of exercise points.")

    if is_assessment:
        if not exercise_ids:
            add("assessment", "NO_EXERCISES", "FAIL", "/sections",
                "Assessment contains no exercises.")
        competences = doc["assessment"]["assessed_competences_per_task"]
        for sec_id in sorted(exercise_ids - set(competences)):
            add("assessment", "COMPETENCE_MISSING", "FAIL",
                "/assessment/assessed_competences_per_task",
                "Every assessment exercise needs an assessed competence.")
        for sec_id in sorted(set(competences) - exercise_ids):
            add("assessment", "COMPETENCE_ORPHAN", "REVIEW",
                "/assessment/assessed_competences_per_task",
                "An assessed competence refers to an unknown exercise.")
        if supports:
            add("assessment", "BILINGUAL_ASSESSMENT_HUMAN_REVIEW", "REVIEW",
                "/support_languages",
                "Bilingual support in assessments needs explicit competence and authorization review.")

    if doc["status"] == "RELEASED":
        approval = doc.get("approval", {})
        if not approval.get("editor_reviewed"):
            add("metadata", "EDITOR_APPROVAL_MISSING", "REVIEW", "/approval",
                "Released documents need editorial approval evidence.")
        if supports and not approval.get("translation_reviewed"):
            add("languages", "TRANSLATION_APPROVAL_MISSING", "REVIEW", "/approval",
                "Released bilingual documents need translation review evidence.")
        if is_assessment and not approval.get("assessor_approved"):
            add("assessment", "ASSESSMENT_APPROVAL_MISSING", "REVIEW", "/approval",
                "Released assessments need authorized assessment approval.")
    return findings
