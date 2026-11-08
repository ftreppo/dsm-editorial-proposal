# DSM-ES v0.1 — Editorial Specification (PROPOSAL)
**Author/proposer:** Franco Treppo · 8.11.2026  
**Status:** draft for public discussion, NOT school policy.

## 1. Scope and priorities
Profiles: `PARENTS`, `STUDENTS`, `ASSESSMENT`. Document types: notices, learning sheets, homework, assessments. Goals: predictability, readability, concise layout, pedagogical fidelity, multilingual clarity, print/digital accessibility and maintainable metadata.

Normative keywords in this **proposal**: **MUST** = required to meet the proposal; **SHOULD** = recommended; **MAY** = optional. These do **not** create obligations for DSM.

## 2. Core document fields
Document ID, title, subject/activity, class/recipient group, publisher/author role, date, version, use case, language of original, permitted support languages, response language(s), status (draft/reviewed/released), and restricted/public distribution flag.

For assessment additionally: evaluated competence **per task or subtask**, score, duration, permitted aids, restrictions, responsible approver, and any authorized accommodations. Do not invent these fields: missing assessment prerequisites block claims of compliant adaptation.

No unnecessary personally identifying information in the public template. Names, grades, student identifiers and accommodations belong only in protected systems.

## 3. Compact header
A4 preferred when printing; use a very short header: institution label (only with authorization), approved logo (only with rights), subject, class, title; then duration, points, response-language rule, document ID and version. Repeated pages use a minimal running header and page number. Footer should remain unobtrusive.

A real DSM logo or school visual identity requires approval. The prototype may use neutral text `School / Schule`. Never present an invented logo as official.

## 4. Type and layout
Use a legible sans serif with robust German and Italian glyph support; left-aligned body; consistent hierarchy, sufficient spacing, clear contrast, no decorative gradients or pseudo-professional template repetition. Do not infer LRS compliance from a font alone. Avoid forced page breaks within one exercise. Diagrams need accessible text descriptions when compatible with the exercise.

Student worksheet: exercise number, objective/task, score, two parallel language blocks when authorized, then **ONE FULL-WIDTH shared answer area**. Print answer height follows expected work, not a uniform decorative rectangle. On narrow screens use vertically stacked or switchable languages with full text retained.

## 5. Language policy
Separate:
- `source_language`: original pedagogical text.
- `support_languages`: translated explanation(s), when authorized.
- `response_languages`: languages accepted for the student's answer.
- `translation_status`: draft / reviewed / not_applicable.

Translation MUST NOT add hints, soften a requirement, omit a condition or silently alter technical terms. Subject-matter review required for release. Do not auto-translate by default, especially in language assessments. For a German-only answer, print: `Antwortsprache: Deutsch / Lingua ammessa per la risposta: tedesco`.

**PARENTS**: compact paired DE/IT information paragraphs, or chosen-language mode. **STUDENTS**: 2 side-by-side language columns with one shared answer region; single-column fallback for accessibility. **ASSESSMENT**: a support translation is conditional on assessed competence and authorized rules, not automatic.

## 6. Accessibility baseline
Provide tagged semantic heading/paragraph/list structure in HTML and, if achievable and verified, an accessible PDF output. Reading order follows logical task order; language switches are marked; text wraps/reflows; color is not the sole signifier; keyboard interaction and screen-reader support matter for digital modes. **Do not claim PDF/UA or WCAG conformance without testing.**

A single-language, reading-optimized rendering MAY be more accessible than parallel columns; provide a choice where permitted.

## 7. Assessment quality gates
Before claiming equivalence, obtain the original, complete list of tasks/subtasks and competencies being assessed, restrictions, response-language rules and authorized PolicyPack if any. Preserve scores, criteria, difficulty, required answer and amount of work unless an authorized measure says otherwise. Do not include solution cues.

Quality status:
- `EDITORIAL_PASS` = layout and metadata check only.
- `LRS_PASS | LRS_REVIEW | LRS_FAIL` only when reported by the existing LRS Adapter assessment contract and supported inputs; include `HUMAN_REVIEW_REQUIRED`.
- `ASSESSMENT_BLOCKED` when required competence/authority information is absent.

A document may pass editorial checks yet remain blocked for LRS assessment. Aesthetic quality alone proves neither.

## 8. Versioning, publication and sharing
Each document gets a stable ID and immutable released revision. A creator can invite editors; an approver signs off on publication. Student questions remain read-only while authorized answer areas are writable. Versions are preserved; link or QR reference must not bypass access control.

Do not commit live exams, credentials, student data, diagnoses, school correspondence, grades or proprietary logos to the public repo.

## 9. Separation of architecture
Editorial schema/templates/prompt here; portable adapter contract at [lrs-adapter](https://github.com/ftreppo/lrs-adapter); school-specific LRS policy at [DSM-LRS](https://github.com/ftreppo/DSM-LRS); digital exam delivery in a future separate system and authorization process. This proposal does NOT grant school or surveillance authority.

## 10. Review checklist
[ ] Content faithful
[ ] Original, support and response languages explicitly separated
[ ] Translations reviewed when used
[ ] All task instructions and points retained
[ ] Header/version/source/reference accurate
[ ] Full-width answer space adequate
[ ] Accessible reading and keyboard order
[ ] Privacy/license conditions met
[ ] Assessment competence and policy gate checked if relevant
[ ] Reviewer sign-off before release

**Signed / Proposto da Franco Treppo · 8.11.2026**
