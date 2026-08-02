# Comprehensive Bug Fix Plan - Mapping Issues

## Analysis Complete

**Total mapping files:** 96  
**Dossier de Presentation unique required fields:** 9  
**PV Evaluation unique required fields:** 22  

---

## BUG 1: Incomplete responses objects ✅ PARTIALLY FIXED

### Current State in `lib/certiflow-engine.ts`:

```typescript
responses.dossier_de_presentation = {
  stagiaire, nom_prenom, votre_nom, votre_prenom,
  employeur, statut, element_cle_projet_3, appreciation_detaillee_membre,
  contenu_developpe_5, point_fort_3,
  '4_pieces_justificatives_du_dossier', '5_attestation_de_conformite'
}
```

**MISSING:** `2_resultats_de_la_certification`

```typescript
responses.pv_evaluation = {
  stagiaire,
  date_du_jury, date_d_enregistrement_du_proces_verbal, date_du_constat,
  transmission_conforme_des_grilles_d_evaluation_au_jury (+ 3 variants),
  mise_en_place_conforme_de_l_organisation_permettant_l_appreciation_des_resultats_pour_les (+ 4 variants),
  resultats_et_commentaires (+ 2 variants),
  proces_verbal_de_jury_d_evaluation
}
```

**MISSING for RS7344:**
- `deliberation_des_resultats`
- `prenom_nom_c1_acquis_non_acquis_c2_acquis_non_acquis_c3_acquis_non_acquis_c4_acquis_non_ac`

**MISSING variants:**
- transmission_conforme_des_grilles_d_evaluation_au_jury_d_evaluation (RS7344 variant)
- All the `_transmission_conforme_des_grilles_d_eval` variants for RS7344

### Fix Required:

Add to `responses.dossier_de_presentation`:
```typescript
'2_resultats_de_la_certification': 'Certification obtenue avec succès',
```

Add to `responses.pv_evaluation`:
```typescript
// For RS7344 specifically
deliberation_des_resultats: `Délibération du ${formatDate(dateExamen)}`,
prenom_nom_c1_acquis_non_acquis_c2_acquis_non_acquis_c3_acquis_non_acquis_c4_acquis_non_ac: generateCompetencyList(candidate, evalResult),

// Add RS7344 transmission variants
transmission_conforme_des_grilles_d_evaluation_au_jury_d_evaluation: 'Conforme',
transmission_conforme_des_grilles_d_evaluation_au_jury_d_evaluation_transmission_conforme_des_grilles_d_eval: 'Oui',
transmission_conforme_des_grilles_d_evaluation_au_jury_d_evaluation_transmission_conforme_des_grilles_d_eval_2: 'Validé',
transmission_conforme_des_grilles_d_evaluation_au_jury_d_evaluation_transmission_conforme_des_grilles_d_eval_3: 'Conforme',
```

---

## BUG 2: PV Evaluation missing //TAG// placeholders ⚠️ NEEDS TEMPLATE ANALYSIS

### RS7344 Missing Fields (from user report):

The template contains these placeholders with NO mapping:
- `//ANNEE//`, `//JOUR//`, `//MOIS//`, `//HEURE//`
- `//NB CANDIDATS//`
- `//MOIS ANNÉE SESSION//`
- `//PRENOM// //NOM//`
- `//ACQUIS / NON ACQUIS//` (×5 per candidate, appears twice)
- `//SIGNATURE JURY 1//`, `//SIGNATURE JURY 2//`
- `//CIVILITE PRENOM NOM RESPONSABLE ORGANISATION DES EPREUVES//`
- `//JJ/MM/AAAA//` (×multiple)
- `//SIGNATURE RESPONSABLE ORGANISATION DES ÉPREUVES//` (×2)

### Required Action:

**Cannot fix without template inspection.** Need to:
1. Extract paragraph indices for each `//TAG//` from the actual .docx
2. Add mapping entries with correct paragraph_index
3. Add data to responses.pv_evaluation

### Recommendation:
Create a script to:
```bash
unzip "templates/final-templates/Proskills_Institut/RS7344/.../PV Evaluation - RS7344 - Proskills Institut - Template.docx"
grep -n "//ANNEE//" word/document.xml
```
Then manually create mapping entries.

---

## BUG 3: Wrong field mappings ✅ PARTIALLY FIXED

### Issue 3a: Fiche Eligibilite trainer name ✅ FIXED

**Fixed in commit c9e0f2f:**
- Changed paragraphs 80-81 from `candidate.identity.last_name` to `jury.trainer_evaluator_name`
- Applied to RS7311 only

**TODO:** Apply same fix to RS6485, RS7200, RS7344 for both orgs

### Issue 3b: Wrong candidate.professional.current_position mappings ✅ PARTIALLY FIXED

**Fixed in commit c9e0f2f:**
- Disabled 3 instances in RS7311 PV Evaluation (paragraphs 92, 164, 166)

**TODO:** Check and fix in RS6485, RS7200, RS7344

### Issue 3c: Wrong jury.members mappings ⚠️ NEEDS INVESTIGATION

User reports: "RS7344: jury.members mapped into MULTIPLE grille-de-contrôle cells"

**Action:** Search all RS7344 PV Evaluation mappings for `jury.members` and remove if in grille_controle sections.

---

## BUG 4: Dossier Inscription (RS7344) ⚠️ NEEDS HASH VERIFICATION

User reports: "Dossier Inscription shows placeholder text instead of values"

Possible causes:
1. Paragraph indices shifted (template edited after mapping created)
2. `template_text_sha256` mismatches causing populateDocx() to skip fields
3. Missing data in buildCanonicalInput()

**Action:**
1. Run hash verification script
2. Check populateDocx() logs for "hash mismatch" warnings
3. Update mapping if template changed

---

## BUG 5: Duplicate Cas Pratiques answers ⚠️ NEEDS CODE REVIEW

User reports: Scenarios 1 and 2 have identical answers.

**Code location:** `lib/certiflow-engine.ts` line ~690

```typescript
for (let i = 1; i <= 10; i++) {
  const key = `votre_production_${i}`;
  const keyAlt = `votre_production_votre_production${i > 1 ? `_${i - 1}` : ''}`;
  // BUG: When i=2, keyAlt = votre_production_votre_production_1
  // This might collide with i=1's keyAlt = votre_production_votre_production
}
```

**Fix:** Review key generation logic to ensure each i gets unique keys that don't collide.

---

## BUG 6: "A faire" in templates ⚠️ MANUAL TEMPLATE FIX

This is baked into the .docx files, NOT in code.

**Action:** Run search script:
```bash
find templates/final-templates -name "*.docx" -exec sh -c 'unzip -p "{}" word/document.xml | grep -l "A faire" && echo "{}"' \;
```

Then manually edit each .docx to remove "A faire" text.

---

## PRIORITY ORDER

### HIGH PRIORITY (Can fix now):
1. ✅ Add missing `2_resultats_de_la_certification` to dossier_de_presentation
2. ✅ Add RS7344-specific PV fields (deliberation_des_resultats, transmission variants)
3. ⚠️ Fix Cas Pratiques duplicate answers bug
4. ⚠️ Apply Fiche Eligibilite trainer name fix to all RS codes

### MEDIUM PRIORITY (Needs investigation):
5. ⚠️ Verify and fix Dossier Inscription hashes
6. ⚠️ Remove wrong jury.members mappings from RS7344
7. ⚠️ Remove wrong current_position mappings from all RS codes

### LOW PRIORITY (Requires template work):
8. ⚠️ Add //TAG// mappings to RS7344 PV Evaluation (needs paragraph extraction)
9. ⚠️ Search and report "A faire" occurrences in templates

---

## RECOMMENDED NEXT STEPS

1. **Immediate:** Fix remaining missing fields in responses objects (5 minutes)
2. **Next:** Fix Cas Pratiques key collision bug (10 minutes)
3. **Then:** Apply trainer name fix to all certifications (15 minutes)
4. **Later:** Create template analysis scripts for //TAG// placeholders (1 hour)
5. **Manual:** Edit .docx files to remove "A faire" (30 minutes per file)

---

## VERIFICATION SCRIPT NEEDED

Create `scripts/verify-mappings.ts` that:
1. Loads all mapping files
2. Checks if every required field has data in buildCanonicalInput()
3. Verifies template_text_sha256 matches current templates
4. Reports coverage % per document type
5. Lists all unmapped placeholders found in templates

**Estimated total effort:** 4-6 hours for complete fix across all 96 mappings.

