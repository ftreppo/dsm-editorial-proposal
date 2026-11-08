"""Run: python -m validator.cli examples/synthetic-physics.json [--json] [--strict-review].

No document contents are transmitted anywhere or included in reports.
Exit 0 = PASS/REVIEW, 1 = FAIL (or REVIEW with --strict-review), 2 = input error.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import MAX_BYTES, validate_document

class DuplicateKeyError(ValueError):
    pass


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError("Repeated JSON object key")
        result[key] = value
    return result


def read_json(path: Path) -> tuple[object, bytes]:
    with path.open("rb") as fd:
        raw = fd.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("File exceeds 2 MiB limit")
    def reject_constant(name: str) -> None:
        raise ValueError("Non-standard JSON numeric constant")
    data = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_unique_pairs,
                      parse_constant=reject_constant)
    return data, raw


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="DSM-ES structured JSON V1 validator")
    parser.add_argument("input", type=Path, help="JSON document path (max 2 MiB)")
    parser.add_argument("--json", action="store_true", help="Machine-readable report (no source text)")
    parser.add_argument("--strict-review", action="store_true",
                        help="Return exit code 1 for REVIEW as well as FAIL")
    args = parser.parse_args(argv)
    try:
        document, raw = read_json(args.input)
        report = validate_document(document, raw)
    except (OSError, ValueError, UnicodeError) as exc:
        print("INPUT_ERROR: Cannot parse the supplied JSON file or file is too large.",
              file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print(f"{report['overall']} | {report['engine_version']} | "
              f"{report['finding_count']} finding(s)")
        for finding in report["findings"]:
            print(f"  {finding['severity']} {finding['code']} "
                  f"{finding['path']}: {finding['message']}")
        print("NOT TESTED: visual identity, PDF/UA, LRS, equivalence, fidelity, translation quality")
    return 1 if report["overall"] == "FAIL" or (args.strict_review and report["overall"] == "REVIEW") else 0


if __name__ == "__main__":
    raise SystemExit(main())
