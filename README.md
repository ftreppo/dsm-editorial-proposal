# DSM Editorial Standard — Community Proposal
**Version:** 0.1 draft · **Status:** OPEN FOR REVIEW · **Proposed on:** 8 November 2026

> **Independent community proposal.** This project is **not** an official Deutsche Schule Mailand (DSM) standard, has not been approved by the school, and does not use or claim authority over the school's name, logo or policies.

**Proposed and signed:** Franco Treppo — 8.11.2026

## Deutsch
Ein offener Vorschlag für konsistente, barrierebewusste und bei Bedarf zweisprachige Schulunterlagen: Elterninformationen, Arbeitsblätter und Leistungsnachweise. Lehrkräfte, Eltern und Fachleute können Änderungen als Issues oder Pull Requests vorschlagen. Keine Freigabe durch die Schule wird vorausgesetzt oder behauptet.

## Italiano
Una proposta aperta per uniformare la presentazione di comunicazioni, esercizi e verifiche scolastiche, prevedendo il bilinguismo quando didatticamente opportuno. Insegnanti, genitori e specialisti possono collaborare su GitHub, senza che la proposta rappresenti una norma approvata dalla scuola.

## English
An open, versioned proposal for bilingual and accessible educational documents, with transparent review and contributions.

### Document profiles
- **PARENTS:** compact DE/IT paragraph pairs or a chosen language.
- **STUDENTS:** optional side-by-side DE/IT exercise blocks and one full-width answer area.
- **ASSESSMENT:** editing and translation must respect the assessed competence, response language and authorized accommodations.

**Bilingual instructions do not automatically authorize bilingual answers.** Translation is optional and requires pedagogical review.

## Contents
- [Editorial specification](standard/DSM-ES-v0.1.md)
- [Teacher Creator prompt](prompts/teacher-creator.md)
- [Student worksheet template](templates/student-worksheet.md)
- [Parent notice template](templates/parent-notice.md)
- [LRS Adapter integration boundaries](integrations/lrs-adapter.md)
- [Digital examination concept (non-implementation)](concepts/digital-assessment.md)
- [Semantic document schema](specification/document.schema.json)
- [Synthetic example](examples/synthetic-physics.json)
- [How to contribute](CONTRIBUTING.md)
- [Security and privacy](SECURITY.md)
- [License](LICENSE.md)

## Project boundaries
This project defines **editorial presentation and metadata**, not an LRS diagnosis or a school regulation. It must not override [the portable LRS Adapter](https://github.com/ftreppo/lrs-adapter). A DSM-specific LRS implementation may integrate the standard through [DSM-LRS](https://github.com/ftreppo/DSM-LRS). A private parents' dashboard may consume approved published outputs without being made public.

## Collaboration / Mitmachen / Collaborare
Use an Issue for discussion, fork and submit a Pull Request for edits, or propose an anonymized synthetic template. A maintainer reviews changes before merging. **Never post pupils' names, grades, health records, teacher/private correspondence, passwords or unlicensed school content.**

## Canonical location
This repository, `ftreppo/dsm-editorial-proposal`, is the standalone public community proposal. It began as a draft contribution in [DSM-LRS PR #6](https://github.com/ftreppo/DSM-LRS/pull/6), then migrated here. Discussion and contributions should take place in this repository.

**Getting involved:** [Issues](https://github.com/ftreppo/dsm-editorial-proposal/issues) · [Contribution guide](CONTRIBUTING.md) · [Propose editorial improvements](https://github.com/ftreppo/dsm-editorial-proposal/issues/new/choose)

---
**Franco Treppo · 8.11.2026**
