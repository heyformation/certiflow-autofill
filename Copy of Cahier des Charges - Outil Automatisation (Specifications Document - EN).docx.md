**SPECIFICATIONS DOCUMENT**

Automated Document Fill-In Tool for Certification Files

*Proforma Institut & Proskills Institut — CréActifs certifications*

Version 1.0 — Developer specification document

# **1\. Context and objective**

Proforma Institut and Proskills Institut prepare candidates for four professional certifications registered with the French "Répertoire Spécifique" (RS6485, RS7200, RS7311, RS7344), issued by the certifying body CréActifs. As each candidate moves through the program, roughly fifteen administrative and pedagogical documents are generated for them (CV, needs assessment ("Recueil des Besoins"), placement test ("Test de Positionnement"), presentation file ("Dossier de Présentation"), evaluations, jury documents, etc.). These documents are currently produced manually from information centralized in the EDOF.xlsx file, plus supplementary data scattered across several other tabs.

The purpose of this specifications document is to define, precisely enough to be built without ambiguity, a web application that automates the fill-in of all these documents from a single, reliable data source: the AUTOMATISATION tab of the EDOF.xlsx file (created and described in section 3).

This document covers: the data source, the trigger logic, the field-by-field mapping for each document type, the correlation logic between AI-simulated answers (placement test, multiple-choice quiz, evaluation grid), the jury rules per organization, the mandatory constraints to respect, and the technical specifications expected of the web application.

# **2\. General architecture and data flow**

The processing flow runs through four sequential steps:

* Step 1 — Data entry: the EDOF.xlsx file (AUTOMATISATION tab) is updated manually by the pedagogical team as each candidate's administrative status progresses (payment, contract sent, CV received, professional experience collected, etc.).

* Step 2 — Completeness detection: the application reads the AUTOMATISATION tab and computes, for each row (candidate × certification), whether all required fields are filled in. This feeds the PRET\_POUR\_GENERATION ("ready for generation") column (see section 4).

* Step 3 — Trigger: generating a document set for a given row is triggered either manually (the GENERER\_MAINTENANT — "generate now" — checkbox set to TRUE by a user in the application interface) or automatically as soon as PRET\_POUR\_GENERATION becomes TRUE — this behavior must be configurable (see section 4.3).

* Step 4 — Generation: the application produces the documents (Word, Excel, PowerPoint) by applying the mapping described in section 5 and the visual identity of the relevant organization (red for Proforma Institut / teal for Proskills Institut, palettes in section 8.4), then places them in the output folder structure described in section 8.2.

# **3\. Single data source: the AUTOMATISATION tab**

An AUTOMATISATION tab has been created inside EDOF.xlsx (delivered as an attachment: "EDOF \- avec onglet Automatisation.xlsx" / "EDOF \- with Automatisation tab.xlsx"). It consolidates, into one row per (candidate, certification) pair, information that was previously spread across the "proforma", "PROSKILLS", "WEDOF PROFORMA", "wedof proskills", "NV CRM PROFORMA", and "attestation sur l'honneur" (honor statement) tabs. This is the ONLY source the tool should read from to fill in documents: the other tabs must no longer be queried directly by the application, to avoid any divergence between sources.

Important: this consolidation was built by script from the existing data and contains approximations wherever the source file was ambiguous (candidates enrolled in multiple certifications on merged rows, duplicate names). It must be reviewed and manually corrected by the team before going into production, then maintained by hand going forward — the application must not attempt to automatically re-consolidate the legacy tabs.

## **3.1 Columns of the AUTOMATISATION tab**

| Column | Content | Source |
| :---- | :---- | :---- |
| NOM (Last name) | Candidate's full name | proforma / PROSKILLS |
| PRENOM, CIVILITE (First name, title) | First name and title (Mr/Mrs) | NV CRM PROFORMA |
| Organisme (Organization) | Proforma Institut or Proskills Institut | Inferred from source tab |
| Apporteur (Referrer) | Business referrer | proforma / PROSKILLS |
| STATUTS EDOF (EDOF status) | Administrative status (Paid, Accepted, Pending, Invoiced...) | proforma / PROSKILLS |
| formation, code\_certif (Course, cert. code) | Title and RS code of the target certification | proforma / PROSKILLS / NV CRM |
| dates\_session, DATE\_DEBUT/FIN\_SESSION (session dates) | Training session dates | proforma / PROSKILLS / NV CRM |
| date\_examen (exam date) | Final exam date (if known) | attestation sur l'honneur |
| adresse (+ \_wedof, ADRESSE\_POSTALE variants) (address) | Candidate's postal address | PROSKILLS / WEDOF / NV CRM |
| mail (+ variants) (email) | Candidate's email address | PROSKILLS / WEDOF / NV CRM |
| numero\_tel (+ variants) (phone) | Candidate's phone number | PROSKILLS / WEDOF / NV CRM |
| date\_naissance (date of birth) | Date of birth | WEDOF PROFORMA / wedof proskills |
| experience\_pro (professional experience) | Free-text professional experience — SOURCE FOR THE CV | WEDOF PROFORMA / wedof proskills |
| cv\_recu, cin\_ok, six\_dossiers\_admin\_ok (admin checkboxes) | Administrative tracking checkboxes | WEDOF PROFORMA / wedof proskills |
| lien\_signature (signature link) | E-signature link for the honor statement | attestation sur l'honneur |
| questionnaire\_test, contrat, classe, convocation, eval inter, EVAL FINALE, questionnaire\_satisfaction, document\_fin (pipeline statuses) | Pedagogical pipeline tracking statuses | proforma / PROSKILLS |
| budget, duree (budget, duration) | Training budget and duration | PROSKILLS |
| PRET\_POUR\_GENERATION (ready for generation) | TRUE if all required fields (section 4.1) are filled in | Computed by the application |
| GENERER\_MAINTENANT (generate now) | Manual trigger checkbox | User input |

# **4\. Generation trigger rules**

## **4.1 Required fields for a row to be considered "ready"**

A row (candidate × certification) is considered PRET\_POUR\_GENERATION \= TRUE if and only if all of the following fields are non-empty:

* NOM and PRENOM (last and first name) of the candidate

* formation (title of the target certification)

* At least one valid email address (mail, mail\_wedof, or mail\_crm)

* At least one postal address (adresse, adresse\_wedof, or ADRESSE\_POSTALE)

* experience\_pro (free text describing the professional background — required for CV generation and for personalizing pedagogical documents)

These rules must be implemented as a pure, testable function (see section 10), not as an Excel formula: the Excel tab is only a data source, the completeness logic lives in the application.

## **4.2 GENERER\_MAINTENANT ("generate now") checkbox**

For each candidate × certification row, the application interface must display a checkbox representing a team member's explicit intent to launch generation. As long as GENERER\_MAINTENANT has not been checked, no document is produced, even if PRET\_POUR\_GENERATION \= TRUE. Once checked, the application launches the full generation of the relevant document set and logs the action (user, timestamp, documents produced).

## **4.3 Automatic mode (configurable)**

An "auto-generate on completeness" mode must be available, configurable per certification or globally in the application settings: in this mode, as soon as PRET\_POUR\_GENERATION switches from FALSE to TRUE for a row, generation is triggered without waiting for the manual checkbox, BUT only for documents in the "pedagogical / candidate" category (CV, Recueil des Besoins, Test de Positionnement, Dossier de Présentation). Documents in the "jury / certification" category (PV de Jury, Grille d'évaluation, Membres du Jury) must NEVER be generated automatically: they always require explicit manual validation (GENERER\_MAINTENANT checkbox), since they carry the certifying body's liability.

# **5\. Document typology and fill-in logic**

Documents fall into three categories whose fill-in logic differs fundamentally. This is the single most important distinction in this specifications document.

## **5.1 Category A — Candidate CV**

The CV is generated from the experience\_pro column of the AUTOMATISATION tab, expanded by an AI generation step that structures this often-telegraphic free text (e.g. "8 YEARS EIFFAGE CRANE OPERATOR PREVIOUSLY FORMWORK CARPENTER TRAVAUX DU MIDI") into a presentable CV:

* Identity: last name, first name, address, email, phone — taken as-is from the AUTOMATISATION tab, never invented.

* Professional experience: rewritten by the AI from the experience\_pro text, preserving the employers, durations, and job titles mentioned, without inventing new experience the candidate did not state.

* Skills and target training: inferred from the industry identified in experience\_pro and made consistent with the target certification (formation column), to justify the relevance of the certification project.

The CV is a Filled document only (no blank Template version, since it only makes sense once filled in for a given candidate).

## **5.2 Category B — "wedof" documents correlated to the certification**

These documents form a coherent chain and MUST be correlated with each other theme by theme (see detailed logic in section 6). They must only be filled in using data specific to the certification targeted by the row being processed — never from the Évaluation Finale / Évaluations Intermédiaires (final/intermediate evaluations), which belong to a different category (5.3) and are handled in complete isolation.

| Document (kept in French — real file/folder name) | Mode | Content source |
| :---- | :---- | :---- |
| Recueil des Besoins (Needs Assessment) | Filled \+ Template | experience\_pro (industry, declared level) \+ target certification |
| Test de Positionnement (Placement Test) | Filled \+ Template | AI simulation correlated to the level declared in the Recueil des Besoins (section 6\) |
| Fiche Éligibilité (Eligibility Form) | Template then Filled | Automatic summary of the Recueil des Besoins \+ Test de Positionnement score \+ eligibility status proposed by the AI (to be manually validated by the trainer before sending) |
| Dossier de Présentation (Presentation File) | Filled \+ Template | experience\_pro \+ target certification; business project simulated consistently with the declared industry |
| PV de Jury d'évaluation (Jury Minutes) | Filled (exam day) | Candidate identity \+ Grille d'évaluation results (score/60) \+ organization's jury (section 7\) |
| Grille d'évaluation (Evaluation Grid) | Filled (exam day) | Scores per competency criterion, derived by AI simulation consistent with the strengths/weaknesses identified in the Test de Positionnement (section 6\) |
| Membres du Jury / Fiche de Mission (Jury Members / Assignment Sheet) | Fixed Template | Organization's jury (section 7\) — does not depend on the candidate |
| QCM / Support de Certification / Trame Dossier Certification (Quiz / Certification Support / Certification File Template) | Template | Fixed content per certification, independent of the candidate except for the header identity |

## **5.3 Category C — Isolated documents (no correlation)**

The Évaluations Intermédiaires (Intermediate Evaluations), Évaluation Finale (Final Evaluation), and Cas Pratiques (Case Studies) are generic pedagogical documents per certification and organization, reused identically for every candidate. They must be handled completely independently: the application must establish NO link between the simulated answers in these documents and those in the Recueil des Besoins, the Test de Positionnement, or the Grille d'évaluation. Their only personalization is the candidate's identity (name, date) inserted in the header; their pedagogical content (quiz questions, case studies) remains whatever has already been validated in the existing Automatisation Project and must not be regenerated by this tool.

# **6\. AI simulation engine — theme-by-theme correlation**

This is the core logic of the tool for Category B. The principle: a candidate's simulated level on a given theme must be consistent from one document to the next, so that a trainer reviewing a candidate's complete file sees a credible pedagogical story rather than independent, disconnected scores.

### **6.1 Competency theme reference list per certification**

For each certification, a reference list of 4 to 8 competency themes must be defined once and for all (drawn from the criteria already present in the existing evaluation grids). Example for RS6485 (Accounting): fundamentals of accounting, reading accounting documents, VAT and tax, invoicing and legal obligations, accounting organization. Example for RS7200 (Social media): strategy and persona, platform selection, content creation, editorial calendar and planning, performance analysis. These reference lists must be supplied as a technical annex by the pedagogical team before development starts (they correspond to criteria C1 through C6/C8 already present in the Excel evaluation grids of the Automatisation Project).

### **6.2 Correlated generation algorithm**

For a given candidate on a given certification, the application must:

* 1\. Draw a starting level per theme (1-to-5 scale) from the industry stated in experience\_pro: a candidate whose experience is close to the certification's target trade gets higher starting levels on the corresponding themes; a candidate whose experience is unrelated gets lower levels, particularly on technical themes (tax, algorithms, etc.).

* 2\. Fill in the Recueil des Besoins with these declared levels (1-5 scale per theme) and coherent free-text expectations (a candidate who is weak on a theme should express an explicit expectation of reinforcement on that theme).

* 3\. Derive the Test de Positionnement: for each question tied to a theme (question-to-theme mapping to be established once per certification, see Annex B), the probability of a correct answer is a function of the declared level on that theme (e.g. level 1-2 → 20-40% correct answers on that theme; level 4-5 → 80-100%). The final score must remain non-eliminatory (no pass/fail threshold) but realistic.

* 4\. Derive the final Grille d'évaluation (exam day): each competency criterion (C1, C2...) of the grid must be mapped to its corresponding theme(s). The score assigned per theme must be higher than the initial placement score (expected pedagogical progress after training) but remain relatively consistent — a theme that was weak at placement stays, all else equal, the weakest point of the final grid, without ever causing the candidate to fail (the overall score must respect the certification's pass threshold, cf. existing documents: 10/20).

* 5\. Derive the PV de Jury from the total of the Grille d'évaluation ("Note/60" column converted to a score out of 20, with the mention "Admis"/"Ajourné" — Pass/Fail).

### **6.3 Variability parameters**

To avoid overly uniform profiles, the algorithm must introduce controlled random variance (± 1 level) around the base level computed in step 6.2.1, using a seed derived from the candidate's identifier so that two successive generations for the same candidate produce identical results (reproducibility), unless the user explicitly requests a regeneration.

### **6.4 Syntactic variability and measured spelling errors**

Every piece of free-text content generated by the AI (open-ended answers in the Recueil des Besoins, the Test de Positionnement, the Cas Pratiques, comments in the Grille d'évaluation, etc.) must be phrased with different syntax and wording on every generation, even for candidates with a similar level or profile: no reused sentence structures repeated identically from one candidate to another, no fixed text template filled in like a variable. The goal is for each answer to read as if it were individually written by that specific candidate, in their own style.

In this same spirit of realism, the AI is permitted to introduce a reasonable and measured number of minor spelling, typing, or grammar mistakes in the candidate-authored free-text answers (never in identity fields, dates, amounts, or in official documents completed by the organization such as the PV de Jury or the Grille d'évaluation). These imperfections must remain subtle and plausible (one to a few minor errors per long answer, never to the point of harming comprehension), and may be modulated based on the candidate's profile (for example, slightly more frequent for a profile whose professional experience suggests less frequent use of written communication).

# **7\. Jury and organization rules**

The jury is fixed per organization and never depends on the candidate or the certification. Any document generation that mentions a jury must exclusively use this correspondence table, hard-coded (or set as an admin-editable configuration parameter, never inferred or invented by the AI).

| Organization | Jury Chair | Jury Member | Contact |
| :---- | :---- | :---- | :---- |
| Proforma Institut | Kaina Nassim | Tom Fournaise | proformainstitut@gmail.com |
| Proskills Institut | Anthony Malheiro | Romain Picano Palombo | proskillsinstitut@gmail.com |

The "Responsable de l'organisation des épreuves" (Exam Organization Officer) and the "Responsable pédagogique" (Pedagogical Officer) are, for each organization, the jury chair (Kaina Nassim for Proforma Institut, Anthony Malheiro for Proskills Institut), consistent with the "Membres du Jury" documents already in place in the project.

# **8\. Mandatory constraints**

## **8.1 Exam dates**

Session/exam dates (dates\_session, DATE\_DEBUT\_SESSION, DATE\_FIN\_SESSION, date\_examen) must NEVER be auto-generated or modified by the application if they are empty in the AUTOMATISATION tab. An empty date field in the source must remain empty in the generated document (never a fictitious date or today's date by default). Only a manual entry in the AUTOMATISATION tab may populate these fields.

## **8.2 File naming and output folder structure**

Generated documents must exactly follow the naming convention already in place in the Automatisation Project: « \<Document type\> \- \<RS code\> \- \<Organization\> \- \<Template|Filled\>.\<extension\> », in French, placed directly at the root of the "Automatisation Project/\<Organization\>/\<RS code \+ title\>/" folder (no "wedof" subfolder, which was removed during the project's file-naming cleanup).

## **8.3 No modification of source data**

The application must never write to the original EDOF.xlsx file or to the source tabs (proforma, PROSKILLS, WEDOF PROFORMA, etc.), except for updating the PRET\_POUR\_GENERATION column and the GENERER\_MAINTENANT checkbox (which must automatically reset to FALSE once generation is complete, to avoid accidental re-generation).

## **8.4 Brand color palettes per organization**

| Organization | Primary color (navy) | Accent | Light background |
| :---- | :---- | :---- | :---- |
| Proforma Institut | \#6E1F14 (burgundy red) | \#A8442B | \#FBEEE9 |
| Proskills Institut | \#0B3D3D (teal) | \#168F82 | \#E8F5F3 |

## **8.5 Scores and results must always be above the pass mark**

Mandatory, non-negotiable constraint: regardless of the level simulated by the AI engine (section 6\) based on the candidate's professional experience, ALL scores generated by the tool must consistently be above the average / pass threshold of the relevant certification — with no exceptions and no failing candidates whatsoever. This rule applies to every scored or evaluated document generated by the tool: Test de Positionnement (informational score, non-eliminatory), Grille d'évaluation, PV de Jury (mention must always be "Admis" / Pass, never "Ajourné" / Fail), Évaluation Finale, and Évaluations Intermédiaires.

In practice: the simulation variance (section 6.3) and the per-theme starting levels (section 6.2) may move the final score up or down to stay realistic and differentiated between candidates, but a floor must be applied at the end of the computation to guarantee that the overall score never drops below the pass threshold specific to each certification (cf. section 6.2.4: reference threshold 10/20, to be confirmed per certification). A theme declared weak at placement may remain the lowest point of the candidate's profile, but must never, alone or combined with others, push the overall score below the pass mark.

# **9\. Web application technical specifications**

## **9.1 Overview**

The application is a custom-built web application, with an interface listing the rows of the AUTOMATISATION tab (filterable by organization, certification, PRET\_POUR\_GENERATION status), allowing GENERER\_MAINTENANT to be checked row by row, viewing generation history, and downloading or syncing the produced documents.

## **9.2 Expected functional modules**

* Import module: periodic or on-demand reading of the AUTOMATISATION tab (file upload or connection to a database synced from Excel).

* Completeness calculation module: evaluates PRET\_POUR\_GENERATION per the rules in section 4.1.

* Document generation module: one generator per document type (Word via python-docx or equivalent, Excel via openpyxl or equivalent, PowerPoint via python-pptx or equivalent), with native checkbox injection (OOXML content-control technique — see the scripts already used in the Automatisation Project as an implementation reference: inject\_checkboxes\_filled.py).

* Correlated AI simulation module: implements the algorithm from section 6, with the per-certification theme reference list stored as configuration (a JSON file editable without redeployment).

* Template management module: Word/Excel/PowerPoint templates per certification and organization must be stored as versioned reference files (no on-the-fly layout generation), filled in by placeholder replacement or content-control substitution, never by fully recreating the document.

* Logging module: tracks who triggered which generation, when, and with what result (success, error, documents produced).

* Export module: places generated files in the output folder structure (section 8.2), with the option to sync to a shared storage location (Drive, network folder).

## **9.3 AI provider and API key handling**

Document content simulation (section 6\) will run on the Claude API (Anthropic). The API key required to call this service is confidential and will be provided to the developer separately, through a secure channel (password manager or shared environment secret) — it is intentionally NOT included in this document.

* The API key must be stored as an environment variable (e.g. CLAUDE\_API\_KEY) or in a secrets manager, never hard-coded in the source code.

* The key must never be committed to a Git repository, written into a configuration file tracked by version control, or included in any document shared with third parties.

* The developer should design the AI integration layer so the key can be rotated at any time without a code change (config/env-based only).

* If a key is ever accidentally exposed (chat, document, repository, screenshot), it must be treated as compromised and regenerated immediately from the Anthropic console.

## **9.4 Non-binding recommendations**

The choice of framework (backend and frontend) is left to the developer. It is recommended to keep Python for document generation (python-docx, openpyxl, python-pptx), since that is the technology used to produce all of the project's current templates, which makes it easier to directly reuse the existing scripts as a starting point.

# **10\. Acceptance plan / test scenarios**

Before going into production, the tool must be validated against the following scenarios:

* A candidate with fully complete information correctly triggers PRET\_POUR\_GENERATION \= TRUE and produces the full set of Category A and B documents with no errors.

* A candidate missing a required field (e.g. empty experience\_pro) stays at PRET\_POUR\_GENERATION \= FALSE and generation is not allowed.

* Jury documents (Category B, jury sub-group) are never generated without the manual GENERER\_MAINTENANT checkbox, even with automatic mode enabled.

* The jury and contact details displayed in the documents exactly match the table in section 7, without exception, for both organizations.

* A candidate whose declared professional experience is close to the target trade gets higher starting levels in the Recueil des Besoins, and this consistency carries through to the Test de Positionnement and the Grille d'évaluation (manual check on at least 3 test candidates, one per strong/weak/mixed theme profile).

* An empty exam date in the AUTOMATISATION tab stays empty in every generated document (PV, grid, attestations).

* Category C documents (Évaluations, Cas Pratiques) remain strictly identical from one candidate to another aside from the header identity, with no influence from the Test de Positionnement.

* On a sample of at least 10 generated candidates (strong, weak, and mixed profiles), 100% of the final scores and mentions produced (Grille d'évaluation, PV de Jury, Évaluation Finale, Évaluations Intermédiaires) are above the pass threshold — no "Ajourné" (fail) result or equivalent should ever be generated (section 8.5).

* On a sample of several candidates, the generated free-text answers show no repeated phrasing from one file to another, and any introduced spelling mistakes remain minor, plausible, and never impair comprehension (section 6.4).

* Generated files follow the naming convention and output folder structure (section 8.2), verifiable through automated naming checks.

# **11\. Deliverables expected from the developer**

* Application source code (backend \+ frontend), documented.

* Configuration file for the per-certification theme reference list (editable by the pedagogical team without developer involvement).

* Installation and operating documentation (how to update the AUTOMATISATION tab, how to add a certification, how to edit the jury table).

* An automated test suite covering the scenarios in section 10\.

* A short user guide (1-2 pages) for the non-technical pedagogical team.

# **Annex A — Detailed EDOF field → document mapping**

This table must be completed and validated by the pedagogical team together with the developer before development starts; it constitutes the executable specification of the fill-in engine.

| Source field (AUTOMATISATION tab) | Document(s) using this field | Target tag / placeholder |
| :---- | :---- | :---- |
| NOM, PRENOM (last/first name) | All documents | Header, candidate table, signature |
| Organisme (Organization) | All documents | Determines the template and color palette (section 8.4) |
| formation, code\_certif (course, cert. code) | All documents | Title, banner, RS reference |
| adresse / variants (address) | CV, Dossier de Présentation, PV de Jury (if required) | Contact info block |
| mail / variants, numero\_tel / variants | CV, Recueil des Besoins | Contact info block |
| experience\_pro | CV, Dossier de Présentation, AI engine (section 6\) | CV body, basis for per-theme level calculation |
| dates\_session / DATE\_DEBUT/FIN\_SESSION | Convocation, PV de Jury ("jury date" field left empty if absent, cf. 8.1) | Session header |
| date\_examen (exam date) | Attestation sur l'honneur, PV de Jury | Exam date field (left empty if absent) |
| PRET\_POUR\_GENERATION, GENERER\_MAINTENANT | No document — internal application control | N/A |

# **Annex B — Competency theme reference list per certification** 

### **RS6485 — Réaliser les opérations comptables courantes d'une TPE (Handle a small business's day-to-day accounting)**

* Accounting fundamentals

* Reading accounting documents (balance sheet, income statement, cash flow)

* VAT and tax

* Invoicing and legal obligations

* Accounting organization and routine operations

### **RS7200 — Communiquer sur les réseaux sociaux pour promouvoir sa TPE (Promote a small business on social media)**

* Strategy, targeting, and persona

* Platform selection and specifics

* Content creation and visual identity

* Editorial calendar and planning

* Advertising, online reputation, and influencer marketing

* Performance analysis and KPIs

### **RS7311 — Améliorer l'efficacité de sa TPE à l'aide de l'IA (Improve a small business's efficiency using AI)**

* AI fundamentals and ethical/GDPR considerations

* Prompt engineering and generative AI

* Internal process automation

* AI-assisted data analysis

* No-code / low-code tools and integrations

### **RS7344 — Développer son activité avec l'intelligence artificielle (Grow a business using artificial intelligence)**

* General uses of generative and predictive AI

* AI strategy and operational roadmap

* Prompt engineering

* Legal framework, GDPR, and liability

* Change management and AI usage charter

* Impact measurement and continuous optimization

