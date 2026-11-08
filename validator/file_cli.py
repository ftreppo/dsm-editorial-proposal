"""DSM-ES V2: local-only preflight for PDF / DOCX / HTML.

Run: python -m validator.file_cli example.pdf [--json] [--strict-review]

Exit 0 = technical preflight completed with REVIEW (always needs human review).
Exit 1 = rejected/unreadable file or --strict-review.
Exit 2 = invalid path/extension or missing input. No source text is printed.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .preflight_v2 import InputRejected, validate_file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="DSM-ES V2 local document preflight — NOT full compliance"
    )
    parser.add_argument("input", type=Path, help="Local .pdf/.docx/.html/.htm, max 12 MiB")
    parser.add_argument("--json", action="store_true", help="Print content-free JSON report")
    parser.add_argument("--strict-review", action="store_true",
                        help="Exit 1 when human review remains required")
    args = parser.parse_args(argv)
    try:
        report = validate_file(args.input)
    except (OSError, InputRejected):
        # Never print arbitrary file paths or parser diagnostics.
        print("INPUT_ERROR: Unsupported, inaccessible, or oversized local file.",
              file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2))
    else:
        print(f"{report['overall']} | {report['engine_version']} | "
              f"{report['file_type']} | {report['finding_count']} finding(s)")
        for finding in report["findings"]:
            print(f"  {finding['severity']} {finding['code']}: {finding['message']}")
        print("Manual review required: official brand, rendering, PDF/UA, LRS, "
              "translation, pedagogical equivalence, original fidelity.")
    if report["overall"] == "FAIL" or (args.strict_review and report["overall"] == "REVIEW"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
