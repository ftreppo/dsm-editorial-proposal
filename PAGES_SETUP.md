# DSM-ES landing page — GitHub Pages setup
**Public community proposal, not an official DSM web property.**

## Files
The site includes a self-contained IT/DE/EN landing page at `docs/index.html` and an on-device JSON V1 + PDF/DOCX V2b pilot at `docs/validate.html`. It has **no analytics, third-party scripts, upload endpoint, paid AI API or server-side validation**. Only JSON validation fetches the public, same-origin schema from `docs/specification/document.schema.json`; PDF/DOCX inspection makes no network request. Document contents and reports remain local.

## Publishing (maintainer action)
1. Review and merge the landing-page PR into `main`.
2. Open **Repository → Settings → Pages** in GitHub (use the browser interface if the mobile app does not show repository settings).
3. In **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under Branch select **main**, Folder select **/docs**, and **Save**.
5. Wait for the Pages deployment to complete in GitHub Actions; verify the **URL shown in Settings → Pages** by opening it. Expected conventional URL: `https://ftreppo.github.io/dsm-editorial-proposal/`, but **do not label it live until the deployment is confirmed**.
6. Test IT/DE/EN switch, copy button, repo links, mobile layout and text-only fallback.

## Status boundaries
- The landing page explains the editorial standard and allows copying a prompt; it does not generate or upload documents. The separate `validate.html` page reads a user-selected JSON, PDF or DOCX file in-browser without uploading it. JSON runs deterministic V1 checks; PDF checks only the header/trailer; DOCX inspects bounded ZIP/OOXML metadata.
- Readers need to share the prompt and their *own rights-cleared material* with an AI assistant that can access GitHub; do not assume such access exists.
- Logo, palette and typography in the visual-identity proposal are pending institutional verification. The landing intentionally uses a text-only independent community identity.
- Do not publish actual pupils' data, diagnoses or unpublished school examinations.

## Validator V1 / V2b browser pilot
After deployment, test `/validate.html` from the landing page:
- Select the **synthetic JSON fixture**, confirm `REVIEW` for draft translation, and download a report.
- Test a **synthetic DOCX** created on an authorized workstation; it must report `REVIEW`, with declared geometry and extractable text-run indicators. Test IT / DE / EN.
- Test a **synthetic PDF**; the only guaranteed browser check is the signature/trailer. The report must explicitly show `NOT_TESTED` for PDF page geometry, text extraction and PDF/UA.
- Confirm all reports stay on-device. Browser pages never claim school endorsement or complete conformance.
- See `validator/README.md` for strict scope and optional local Python V2 CLI.

**Future:** add a genuine client-side PDF engine and rendered-document accessibility checks before claiming more than preliminary preflight. Never upload school material to a public GitHub Action or external endpoint.

**Signed: Franco Treppo — 8.11.2026**

## V2c — local PDF.js assets and publishing gate

V2c uses a pinned, first-party Mozilla PDF.js distribution; browser users do **not** contact an external CDN. The source files in `main` contain the loader, but the large minified PDF.js display module and worker are produced from `pdfjs-dist@6.5.438` by the GitHub Action `.github/workflows/pdf-engine-v2c.yml`.

1. On the V2c Pull Request, **all CI gates must PASS**, including a real Chromium test with synthetic PDFs. No user files are used in CI.
2. After a reviewed merge, the workflow verifies the same pinned build, checks for branch drift and commits `docs/vendor/pdfjs/` to `main` using `GITHUB_TOKEN`.
3. Because GITHUB_TOKEN pushes **do not trigger a GitHub Pages deployment from a branch**, a separate maintainer-authored commit is required afterward to trigger deployment. Do not claim V2c is publicly live merely because CI passes.
4. Confirm the live page fetches only same-origin `/vendor/pdfjs/pdf.mjs` and `/vendor/pdfjs/pdf.worker.mjs`; verify the report engine reports `DSM-ES-VALIDATOR-002C/pdfjs-v0.1`, **not** `V2b fallback`.
5. Test at least a synthetic A4 text PDF, a non-A4 PDF and a blank/scanned-look PDF in the actual published browser. For older browsers or missing assets the interface will report `PDF_ENGINE_UNAVAILABLE` and leave geometry/text `NOT_TESTED`.

**Caution:** Parsed PDF page geometry/text does not establish PDF/UA, actual visual styling, LRS equivalence, brand authorization or school endorsement. See `validator/README.md`.


## V2d — visual layout pilot on GitHub Pages

V2d builds on V2c and uses the already bundled, same-origin PDF.js library. The page now displays **approximate per-page left/top/right/bottom text margins**, dominant text size, and comments on unusually narrow margins, small dominant text or substantial unused space. It also provides an opt-in local PDF preview with dashed 12 mm caution guides. The preview image never enters the JSON report and is never uploaded.

The thresholds are **independent proposals**, not official DSM design requirements. A large blank lower half can be appropriate for a study guide, and must never be treated as proof of poor quality. Compare with the still-unmerged visual identity Draft PR #5 before any normative design enforcement. All PDF results remain `REVIEW` or `FAIL`, never full institutional `PASS`.

After CI, test a **synthetic two-page PDF** on the published Pages site: view first page, click Next, inspect numeric margins, and download a report. Confirm no off-origin calls or POST requests in developer tools. Check IT/DE/EN. No pupil documents or private school materials belong in public CI.
