# DSM-ES-VALIDATOR-001 — V1 structured-document validator
**Status:** V1 prototype, independent community proposal; not official Deutsche Schule Mailand policy.  
**Initiated by Franco Treppo · 8.11.2026**

## V2c — real PDF.js parsing in the browser (pending deployment gates)

V2c replaces the signature-only PDF preflight with Mozilla **pdfjs-dist v6.5.438**, installed by a pinned **GitHub Actions build** and hosted from this site's own `docs/vendor/pdfjs/` folder. There is no CDN dependency at runtime. PDF document bytes, filenames, content and reports are never sent to GitHub, Mozilla or another service by this validator.

**When the bundled PDF.js module and worker are available**, the browser can examine up to 50 pages / 12 MiB and report page count, effective A4 portrait geometry, approximate text extraction coverage and blank/scanned-looking pages. Reports contain only aggregate counts, generic findings and local SHA-256. A `REVIEW` result is always mandatory even when page geometry and extractable text pass: there is no PDF/UA, visual-rendering, LRS, pedagogical, logo rights or translation attestation.

**If PDF.js assets are not yet installed on Pages**, the browser falls back safely to V2b PDF signature/trailer checks with the explicit finding `PDF_ENGINE_UNAVAILABLE`; geometry and text stay `NOT_TESTED`. The fallback prevents broken Pages deployments from incorrectly claiming complete inspection.

**Build and deployment:** The project uses `.github/workflows/pdf-engine-v2c.yml` to install the exact npm package in a temporary runner, copy the minified display module, worker and Apache 2.0 license to first-party static assets, test with synthetic PDFs in real headless Chromium, and (only after merge into main) commit those verified assets with a guarded branch-head check. GitHub Pages is configured to publish from `main /docs`: commits made by GitHub Actions using `GITHUB_TOKEN` do **not** trigger a Pages build. A subsequent maintainer-authored commit and a direct Pages smoke check are required after the vendor-assets commit. Do not imply V2c has been deployed solely because the PR CI passes.

The PDF.js project is licensed under Apache License 2.0. Its copy is distributed with LICENSE, VERSION and SHA256SUMS. Upgrading PDF.js requires updating version references and re-running all test suites; no automatic version drift.

**Security:** the parser runs in a web worker wherever the browser supports it, with `isEvalSupported:false` and no external document URLs. PDF files can be malicious: only handle documents on authorized machines and keep the browser up to date. The 12 MiB / 50-page limits reduce denial-of-service exposure but do not establish full isolation. Non-text/scanned PDFs require separate accessibility review; V2c performs no OCR or translation.

---

## V2b — GitHub Pages browser preflight (PDF/DOCX pilot)

The same [public validator page](../docs/validate.html) also accepts **PDF and DOCX directly in the browser**. It uses only first-party JavaScript and built-in browser APIs: no server, CDN, third-party fonts, external processing or file upload. PDF/DOCX limit: **12 MiB**.

**Critical scope difference:** PDF analysis is a *signature/trailer check only*. It does **not** parse PDF objects, page geometry, image content, text, or PDF/UA. All those categories remain `NOT_TESTED`. Word DOCX uses bounded ZIP central-directory checks and CRC-verified XML for declared A4 page size, margins, and visible text-run presence; the result does **not** prove that Word renders a correct page, preserves instructional content or meets WCAG/LRS requirements. PDF and DOCX always finish with overall `REVIEW` (technically inspectable) or `FAIL` (rejected). No `PASS` certification is possible for this pilot.

Browser `DecompressionStream("deflate-raw")` is required for compressed DOCX. Unsupported browser/platform features, ZIP64, encrypted archives, non-ASCII member names, or formats outside this conservative subset fail closed. An explicit technical preflight can be performed on a local authorized workstation with the fuller Python V2 CLI.

The page's JSON V1 checker is unchanged; JSON files still use the versioned public schema. No pupil data or real exams are included in CI. On-device processing does not automatically establish GDPR compliance or authorization to handle any given school document.

**Before declaring the pilot browser-verified**, test on real Chromium and Firefox/Safari with **synthetic fixtures** and inspect downloaded reports. Automated Node tests alone cannot prove mobile or browser behavior.

---

## V2 — offline PDF, DOCX and HTML preflight (not full conformity)

**Status:** available as an opt-in **local command-line tool**, not as a public browser uploader. The GitHub Pages interface continues to accept only structured JSON.

Install on an authorized local workstation using Python 3.11+:

```sh
python -m pip install -r requirements-validator-v2.txt
python -m validator.file_cli "sample.pdf"
python -m validator.file_cli "sample.docx" --json
python -m validator.file_cli "sample.html" --strict-review
python -m unittest discover -s tests -p 'test_preflight_v2.py' -v
```

The output contains **only** a file hash, non-identifying counts and generic findings, never body text, names, file paths, filenames, hyperlinks or copies of school material. Input files are processed locally, with no network requests by the validator. Parsed documents are not changed.

| Format | Deterministic V2 preflight |
|---|---|
| PDF | Pages (limit 50), proposed A4 portrait geometry, text extractability, very small text and embedded-file metadata. Does not render images or prove PDF/UA. |
| DOCX | ZIP safety limits, section size and declared margins, detectable body text and top-level heading heuristic. Does not calculate actual pagination or visual layout. |
| HTML/HTM | UTF-8 parse, root language, main landmark, H1 count and missing image-alt attributes. Does **not** run scripts or certify WCAG. |

**Result:** V2 returns `REVIEW` even when all its narrow checks are satisfied: manual visual/accessibility review remains required. Damaged, encrypted, oversized or unsafe containers return `FAIL` (or an `INPUT_ERROR` for invalid invocation). There is no document-upload service.

**Safety boundaries:** max input 12 MiB; PDFs max 50 pages; DOCX ZIP count, member, uncompressed size, compression-ratio and traversal safeguards. These limits reduce but do not eliminate parser vulnerabilities; do not use an unmaintained parser build on untrusted documents. No OCR or macros executed.

**Comparison with V1:** V1 is a structured JSON editorial-rule validator; V2 examines real-file technical properties. A PDF/DOCX `REVIEW` cannot be combined with V1 `PASS` into an automatic institutional or LRS certification.

**Not yet implemented:** full PDF/UA/WCAG auditing, visual page-image comparison, a rights-cleared official branding package, bilingual translation fidelity, LRS PolicyPack and authorized academic review, or a browser-only PDF/DOCX processor.

---

## What is implemented
- Python command-line JSON Schema 2020-12 validation using `jsonschema`, plus deterministic cross-field checks for language declaration, translations, full-width answers, points, duplicate sections and assessment competence metadata.
- IT / DE / EN browser-only tool at [docs/validate.html](../docs/validate.html), with a local JSON file picker and a downloadable JSON report. No file is uploaded: processing is in the user's browser. The browser downloads **only** the public JSON schema from the same GitHub Pages origin.
- Public synthetic fixture and negative/positive deterministic tests in GitHub Actions.
- Every report includes `PASS | REVIEW | FAIL` **only for V1 structural scope**, explicit untested categories, findings by stable code, engine version and input SHA-256 (if supported by the browser).

## Command line
Use Python 3.11+:

```sh
python -m pip install -r requirements-validator.txt
python -m validator.cli examples/synthetic-physics.json
python -m validator.cli examples/synthetic-physics.json --json
python -m validator.cli examples/synthetic-physics.json --strict-review
python -m unittest discover -s tests -p 'test_validator_v1.py' -v
```

Return codes: `0` when PASS or REVIEW (the latter is an intentional draft state), `1` for FAIL or REVIEW with `--strict-review`, `2` when the input cannot be read/parsed. Never use an exit code 0 by itself as evidence of full compliance: inspect `overall` and `checks`.

## Browser interface
After Pages deployment, open **/validate.html**. Select a structured **JSON** document (maximum 2 MiB), then click **Validate / Verifica / Prüfen**. View individual findings or save the report.

The site does **not** accept PDFs, Word, private student data or school authentication. The site uses no third-party tracking, no LLM and no upload API. The browser requires the canonical schema to be mirrored under `docs/specification/`; CI checks byte-for-byte consistency. Only the static schema is requested over the network.

## Deterministic rule examples
- JSON Schema required fields and exact format constraints.
- Source language present in each section; support text present only when declared.
- `translation_status=DRAFT` with support translations → REVIEW (not a false PASS).
- Full-width answer area per exercise.
- Unique section IDs.
- Sum of exercise points matches `max_points` when fully specified.
- Assessment profile / per-exercise assessed competence prerequisites.
- Explicit approval metadata for released documents; never infer permissions.

## Not implemented or not automatically verifiable
| Category | Status |
|---|---|
| PDF/DOCX rendering/layout, actual fonts, logo permissions | NOT_TESTED |
| PDF/UA and WCAG compliance | NOT_TESTED |
| Source document fidelity or semantic equivalence | NOT_TESTED |
| Translation quality and added hints | NOT_TESTED |
| LRS Adapter / PolicyPack authorized measures | NOT_TESTED |
| Institutional endorsement / assessment approval | NOT_GRANTED |

For secure evaluation of real pupil material, use only an **authorized local device** and an approved data-handling procedure; don't upload the material to the public repo or CI.

## Known V1 limits
- Python uses a full Draft 2020-12 JSON Schema engine, while the browser engine intentionally supports **only** the subset of JSON Schema keywords present in the versioned DSM-ES schema. Unsupported constraints cause a hard error, not a PASS. CI checks supported keywords and deterministic fixtures.
- The browser's native JSON parser does not reject duplicate object keys; the Python CLI **does** reject them. Use the Python CLI where strict JSON parsing is important.
- A declared `REVIEWED` translation or approval metadata is not proof that a human has actually reviewed the document. Those are untrusted self-reported fields.
- The schema's allowed metadata does not assert the absence of confidential information in text. This validator does **not** conduct a privacy scan or make a GDPR judgment.
- No automatic format conversion, PDF generation, editing or publication.

## Next steps
1. V2b: explicit rendered-page visual QA and richer accessibility diagnostics, still offline.
2. V3: separate LRS Adapter integration with explicit authorization/competence gates and human review.
3. V4: validated, signed releases with immutable version identifiers and controlled permissions.

**Proposed by Franco Treppo, 8.11.2026.**
