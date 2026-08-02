# Templates — Developer Guide

This describes the 80 Markdown files converted from `Templates.zip`, so an
AI or a script can parse, fill, and (if needed) rebuild them programmatically.

---

## 1. File naming convention

```
<Document Type> - <RS Code> - <Institute>.md
```

Example: `Fiche Eligibilite - RS6485 - Proforma Institut.md`

- **Document Type** — which kind of document it is (see §3).
- **RS Code** — the French "Répertoire Spécifique" certification code this
  document belongs to (see §2). Identifies the training/topic.
- **Institute** — which training organization's branding/wording is used
  (see §4). `Proforma Institut` and `Proskills Institut` are two
  white-labeled variants of the same certification paperwork.

One file (`1_PV_evaluation.md`) doesn't follow this pattern — it's a
generic/legacy version of the PV Evaluation document, not tied to one
RS code or institute.

A parser can safely `split(" - ")` the filename (minus extension) to get
`[type, rs_code, institute]`.

---

## 2. Topics / certifications (RS codes)

| RS Code | Certification / training topic | Duration |
|---|---|---|
| **RS6485** | Réaliser les opérations comptables courantes d'une TPE (bookkeeping/accounting for small businesses) | 21h |
| **RS7200** | Communiquer sur les réseaux sociaux pour promouvoir sa TPE (social media for small businesses) | 21h |
| **RS7311** | Améliorer l'efficacité de sa TPE à l'aide de l'IA (using AI to improve business efficiency) | 21h |
| **RS7344** | Développer son activité avec l'intelligence artificielle (growing a business with AI) | 21h |

Each RS code has its own module breakdown (typically 5 modules), each with
an intermediate and a final evaluation.

---

## 3. Document types

| Type (filename prefix) | Purpose |
|---|---|
| **Recueil des Besoins** | Intake questionnaire — candidate's current situation, goals, needs (checkboxes + free text). |
| **Fiche Eligibilite** | Eligibility form — combines needs analysis + positioning test result, decides if candidate can enroll. |
| **Test de Positionnement** | Placement/skills test before training starts (informative, non-eliminatory). |
| **Dossier Inscription** | Exam registration file the candidate fills out and submits (contains "MODÈLE VIERGE" instructions in red — see §5). |
| **Dossier de Presentation** | Candidate presentation dossier — identity info, ID document, contact details. |
| **Cas Pratiques** | Practical case-study exercises/evaluations, one per training module. |
| **Rendu Ecrit** | Written submission for a practical case (candidate deliverable). |
| **Evaluation Intermediaire** / **Evaluations Intermediaires** | Mid-module knowledge check. |
| **Evaluation Finale** | End-of-module final evaluation. |
| **QCM** | Multiple-choice question bank — **already contains correct answers** (✓), used as an answer key/reference, not a blank form. |
| **PV Evaluation** / **1_PV_evaluation** | Official jury evaluation report (procès-verbal): candidate results table, pass/fail counts, jury signatures, quality-control checklist. |
| **Membres du Jury** | Roster of jury/team members (name, email, phone, role) tied to the certification. |
| **Fiche de Mission** | Mission statement for the person supervising exam sessions (roles/responsibilities, mostly static text). |
| **Trame Dossier Certification** | Slide/oral-presentation outline template the candidate fills in and presents. |

---

## 4. Institutes & brand colors

Both institutes share layout and text; only the color palette differs.
Useful if you're rendering these back to styled HTML/DOCX/PDF.

| Role | Proforma Institut | Proskills Institut |
|---|---|---|
| Primary/dark accent | `#6E1F14` (dark terracotta) | `#0B3D3D` (dark teal) |
| Secondary/accent | `#A8442B` (rust) | `#168F82` (teal) |
| Light background/fill | `#FBEEE9` (pale peach) | `#E8F5F3` (pale mint) |
| Body text | `#1A1A1A` | `#1A1A1A` |
| Muted/secondary text | `#6B7280` | `#6B7280` |
| Table shading (generic) | `#F2F2F2` | `#F2F2F2` |

Shared/document-wide colors (not institute-specific):
| Color | Hex | Meaning |
|---|---|---|
| Red | `#C00000` | **Instructional text meant to be deleted** — appears in "MODÈLE VIERGE" (blank template) docs like *Dossier Inscription* / *Rendu Ecrit*. Marks guidance text the candidate must read then remove before submitting. Not a fill field itself, but text near/around it usually should be replaced with real content. |
| Green | `#6AA84F` | Used in QCM answer keys (correctness indicator, alongside ✓). |
| Yellow highlight | `w:highlight="yellow"` | Emphasis/attention marker on certain PV Evaluation fields. |

---

## 5. Placeholder tag reference

| Tag | Meaning | Example |
|---|---|---|
| `{{FILL: <label>}}` | Text/date/number field to complete. Label inferred from the nearest heading, original bracket placeholder, or column header. | `{{FILL: Nom et Prénom}}` |
| `{{FILL}}` | Blank field with no reliably inferable label (extra repeated table rows, generic empty cells). Infer meaning from the row/column it's in. | `\| {{FILL}} \| {{FILL}} \|` |
| `{{CHECKBOX}}` | A tick box (☐ in the original) to mark. Fill by placing `[x]`/`✓` in front of the chosen option(s). | `{{CHECKBOX}} Salarié(e)` |
| `✓` (bare, no tag) | An already-checked/selected option in a source document — appears in QCM answer keys and a few fixed selections (e.g. "A distance ✓"). Leave as-is; it's existing data, not a field to fill. | `A.  ✓ Vrai` |
| Text in red context (see §4) | Instructional note to delete, not a field. | *"Tout ce qui est en rouge est une consigne à lire puis à effacer"* |

Notes:
- Every bracketed placeholder that existed in the original Word files
  (`[DATE_JURY]`, `[NOM]`, `[NOTE_60]`, etc.) was normalized to
  `{{FILL: DATE_JURY}}` format for consistency.
- Underscore blank-lines (`____________`) used as write-in lines were
  also converted to `{{FILL}}`.
- QCM files intentionally have **no** fill tags — they're reference
  answer keys (questions + correct answers marked with ✓).

### Suggested parse pattern (regex)
```
\{\{FILL(?::\s*(?P<label>[^}]+))?\}\}   → matches both {{FILL}} and {{FILL: label}}
\{\{CHECKBOX\}\}                        → matches checkbox markers
```

---

## 6. Suggested structure for programmatic use

If you want to load these into a form-filling pipeline, a reasonable
intermediate JSON per document looks like:

```json
{
  "type": "Fiche Eligibilite",
  "rs_code": "RS6485",
  "institute": "Proforma Institut",
  "source_file": "Fiche Eligibilite - RS6485 - Proforma Institut.md",
  "fields": [
    { "tag": "{{FILL: Nom et Prénom}}", "label": "Nom et Prénom", "type": "text" },
    { "tag": "{{FILL: Date de l'entretien / de l'analyse}}", "label": "Date de l'entretien / de l'analyse", "type": "date" },
    { "tag": "{{CHECKBOX}}", "label": "Niveau déclaré (1-5)", "type": "checkbox_group" }
  ]
}
```

Extraction approach: read each `.md`, walk it top-to-bottom, and whenever
a `{{FILL...}}` or `{{CHECKBOX}}` tag is hit, use the nearest preceding
bold line (`**...**`) or table header as the field's label/section.

---

## 7. Known limitations

- Bulk, script-based conversion across 80 diverse documents — a few
  fields ended up as generic `{{FILL}}` instead of a precise label where
  the original layout was unusual (merged cells, images, nested tables).
- Repeated blank table rows (e.g. multiple candidates in a jury table)
  each get their own `{{FILL}}` per cell — duplicate the row pattern
  programmatically for additional entries.
- Embedded images (`<img src="media/...">`) referenced in the Markdown
  are **not** included as files — only the reference text came through
  pandoc. Extract images from the original `.docx` (`word/media/`) if
  you need them.
- This is Markdown only. To turn a filled-in file back into `.docx`,
  the original per-document formatting (fonts, exact table borders,
  logos) would need to be re-applied — ask if you need that conversion.
