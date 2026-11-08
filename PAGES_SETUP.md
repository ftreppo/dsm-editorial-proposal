# DSM-ES landing page — GitHub Pages setup
**Public community proposal, not an official DSM web property.**

## Files
The site includes a self-contained IT/DE/EN landing page at `docs/index.html` and an independent on-device structured JSON V1 validator at `docs/validate.html`. It has **no analytics, third-party scripts, upload endpoint, paid AI API or server-side validation**. The validator fetches only a public, same-origin static schema from `docs/specification/document.schema.json`; document contents and reports remain local.

## Publishing (maintainer action)
1. Review and merge the landing-page PR into `main`.
2. Open **Repository → Settings → Pages** in GitHub (use the browser interface if the mobile app does not show repository settings).
3. In **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under Branch select **main**, Folder select **/docs**, and **Save**.
5. Wait for the Pages deployment to complete in GitHub Actions; verify the **URL shown in Settings → Pages** by opening it. Expected conventional URL: `https://ftreppo.github.io/dsm-editorial-proposal/`, but **do not label it live until the deployment is confirmed**.
6. Test IT/DE/EN switch, copy button, repo links, mobile layout and text-only fallback.

## Status boundaries
- The landing page explains the editorial standard and allows copying a prompt; it does not generate or upload documents. The separate `validate.html` page **does** read a user-selected JSON file in-browser and runs a limited deterministic V1 validation without uploading the file.
- Readers need to share the prompt and their *own rights-cleared material* with an AI assistant that can access GitHub; do not assume such access exists.
- Logo, palette and typography in the visual-identity proposal are pending institutional verification. The landing intentionally uses a text-only independent community identity.
- Do not publish actual pupils' data, diagnoses or unpublished school examinations.

## Validator V1
After deployment test `/validate.html` from the main landing page: select the **synthetic JSON fixture**, confirm a `REVIEW` report for draft translation, and download a report. Test IT / DE / EN links. PDF and Word are explicitly unsupported and must not be submitted. The `validator/README.md` documents CLI usage and limitations.

**Future:** extend support with local document parsers without silently sending student material to GitHub Actions or to an external backend.

**Signed: Franco Treppo — 8.11.2026**
