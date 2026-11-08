# DSM-ES landing page — GitHub Pages setup
**Public community proposal, not an official DSM web property.**

## Files
The site is a self-contained, accessible, client-side landing page at `docs/index.html`. It has **no analytics, third-party scripts, API, upload or server-side validation**.

## Publishing (maintainer action)
1. Review and merge the landing-page PR into `main`.
2. Open **Repository → Settings → Pages** in GitHub (use the browser interface if the mobile app does not show repository settings).
3. In **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under Branch select **main**, Folder select **/docs**, and **Save**.
5. Wait for the Pages deployment to complete in GitHub Actions; verify the **URL shown in Settings → Pages** by opening it. Expected conventional URL: `https://ftreppo.github.io/dsm-editorial-proposal/`, but **do not label it live until the deployment is confirmed**.
6. Test IT/DE/EN switch, copy button, repo links, mobile layout and text-only fallback.

## Status boundaries
- The landing page explains the editorial standard and allows copying a prompt; it does **not** generate documents, fetch documents, upload files or run the validator.
- Readers need to share the prompt and their *own rights-cleared material* with an AI assistant that can access GitHub; do not assume such access exists.
- Logo, palette and typography in the visual-identity proposal are pending institutional verification. The landing intentionally uses a text-only independent community identity.
- Do not publish actual pupils' data, diagnoses or unpublished school examinations.

## When the validator exists
Add a local-only, client-side validation interface if technically suitable, or link a downloadable CLI. Never silently send student material to GitHub Actions or to an external backend.

**Signed: Franco Treppo — 8.11.2026**
