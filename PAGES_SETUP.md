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
