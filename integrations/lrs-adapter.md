# LRS Adapter integration — boundaries and quality gates
**Design only · 8.11.2026**

Canonical adapter: https://github.com/ftreppo/lrs-adapter  
School-specific context: https://github.com/ftreppo/DSM-LRS

## Distinct responsibilities
1. DSM-ES: consistent document model, bilingual presentation, metadata, accessibility baseline.
2. Portable LRS Adapter: choose minimal sufficient compatible intervention, preserve fidelity, apply authorized PolicyPack.
3. School-specific product: identify relevant authority, confirmed measures, access rights and review.

The editorial prompt MUST NOT modify the portable Adapter's contract or treat a proposal as an authorized DSM PolicyPack.

## Adapter work item
Required: `material`, `subject_or_activity`, `objective`, `use_case` (`STUDY|HOMEWORK|ASSESSMENT`). ASSESSMENT additionally requires `assessed_competence` and restrictions. No assessed competence => STOP before adaptation.

Modes are distinct from use case: `ORIGINAL_FAITHFUL`, `READING_OPTIMIZED`, `LEARNING_VERSION`, `ASSESSMENT_ADAPTATION`.

Authorized measure states: `CONFIRMED`, `POSSIBLE_IF_CONFIRMED`, `DO_NOT_APPLY`, `TO_CLARIFY`. Only CONFIRMED measures executable by default; unresolved authority-dependent changes fail closed.

## Assessment report
Student-facing version, per-task equivalence comparison, measures/status log, `PASS | REVIEW | FAIL`, separate `HUMAN_REVIEW_REQUIRED=true|false` if adapter is actually run. The generic editorial template cannot issue its own LRS PASS.

## Bilingual implications
A support translation can make a task easier in unintended ways. Do not automatically translate assessments or allow IT answers in a DE-only task. Record `source_language`, `support_languages`, `response_languages`, translation review and assessed competence explicitly.

## Privacy
Never publish original student work, diagnoses or accommodations. Use synthetic fixtures for public tests. Protected personalized outputs remain in authorized private storage.
