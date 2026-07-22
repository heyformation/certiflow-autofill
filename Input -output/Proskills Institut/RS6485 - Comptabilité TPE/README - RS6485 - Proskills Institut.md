# Trames RS6485 — Réutilisables pour tout nouvel apprenant

**Organisme : PROSKILLS INSTITUT (Marseille, 13006)**
**Jury : Anthony MANEIRO (Président), Tom FOURNAISE et Romain PICANO PALOMBO (jurés évaluateurs)**

Ces 6 documents sont les trames vierges validées, avec balises `[...]` à la place des données candidat. La mise en forme (alignements, couleurs, styles, structure des tableaux) a été testée et corrigée — elle ne doit plus être retouchée, seul le contenu des balises doit être remplacé.

## Liste des fichiers

| Fichier | Contenu à remplir |
|---|---|
| `1_PV_evaluation_TRAME.docx` | `[ORGANISME]`, `[DATE_JURY]`, `[NOM]`, `[PRENOM]`, `[VOIE_ACCES]`, `[NOTE_60]`, `[ADMIS]`/`[AJOURNE]`, `[NB_H]`/`[NB_F]`/`[NB_TOTAL]` |
| `2_Membres_equipe_TRAME.docx` | Aucune balise — document fixe côté organisme (Anthony MANEIRO, Romain PICANO PALOMBO, Tom FOURNAISE) |
| `3_Fiche_mission_TRAME.docx` | `[NOM_PRENOM_1]`, `[NOM_PRENOM_2]` (jusqu'à 2 candidats par session), `[DATE_JURY]` |
| `4_Grilles_evaluation_TRAME.xlsx` | Onglet **Ordre de passage** ligne 9 + onglet **Participant 1** : `[NOM_1]`, `[PRENOM_1]`, `[HEURE_1]`, `[NOTE]` ×24 (8 critères × 3 jurés), `[COMMENTAIRE_J1/J2/J3_C1...C8]`, `[APPRECIATION_J1/J2/J3]`. Dupliquer l'onglet "Participant 1" vers "Participant 2", etc. pour plusieurs candidats |
| `5_QCM_RS6485_TRAME.docx` | `[NOM_PRENOM]`, `[DATE_JURY]` uniquement — les questions et corrigés sont fixes (théorie RS6485). **Réponses variées par candidat** via `scripts/gen_qcm_varied.py` (voir détail ci-dessous) |
| `6_Support_certification_TRAME.pptx` | Voir détail ci-dessous |

## Variation des réponses QCM (document 5)

Le script `scripts/gen_qcm_varied.py` génère, pour chaque candidat, une version du QCM avec 3 à 5 questions "ratées" parmi les questions à choix unique simples (Q1, Q5, Q6, Q7, Q9, Q10, Q14, Q15, Q16, Q17, Q19, Q20, Q22). Les questions complexes (choix multiples, calculs, associations) restent toujours correctes pour ne pas casser leur cohérence logique.

- Le texte des bonnes/mauvaises réponses reste **toujours en noir** (jamais en vert) — toute personnalisation ultérieure doit conserver cette règle.
- Le score final est toujours **> 70%** (16/22 minimum), condition d'admission du critère C8.
- Pour générer : `python3 scripts/gen_qcm_varied.py candidat.json dossier_sortie/`

## Détail du support PowerPoint (document 6)

Slide par slide, balises à remplacer par le candidat ou à adapter à son secteur :

- **Slide 1** (page de garde) : `[NOM] [PRENOM] – [Intitulé du projet/structure]`
- **Slide 4** (synthèse projet) : `[FORME JURIDIQUE]`, `[SECTEUR D'ACTIVITE]`, et les 5 bullet points entre crochets
- **Slide 6** (organisation administrative) : documents réceptionnés, sous-catégories de classement, logiciels utilisés
- **Slide 8** (tableau de bord) : `[Nom entreprise/secteur]`, 4 indicateurs au choix + CA mensuel sur 3 mois. **Important : recalculer `[Evol M2]` et `[Evol M3]` à partir des vrais CA** (ne jamais laisser "+x%" générique — variation réelle = (CA mois N - CA mois N-1) / CA mois N-1)
- **Slide 10** (hypothèse de CA) : 3 prestations avec prix moyen + volume/an sur N1/N2/N3, calculer les totaux CA prestation et le total général
- **Slide 12** (FR/BFR) : image générée par `scripts/gen_frbfr_image_TRAME.py` — dupliquer ce script, remplacer les valeurs, **toujours vérifier que la trésorerie nette reste positive sur les 4 colonnes** (objectif pédagogique du slide)
- **Slide 15** (facture) : image générée par `scripts/gen_facture_TRAME.py` — dupliquer ce script, remplacer les placeholders. Possibilité d'introduire une erreur de calcul volontaire pour l'oral (cf. méthode utilisée pour LAREF Faouzi)
- **Slide 19** (gestion des stocks) : 3 références produit avec leurs entrées/sorties/stocks
- **Slide 21** (écarts prévisionnel/réel) : CA, Achats, MARGE BRUTE + 1 indicateur libre, avec actions courtes (**garder les textes d'action courts, 2-3 mots max, sinon le tableau déborde sur le texte explicatif en dessous**)

## Points de vigilance techniques (erreurs déjà rencontrées et corrigées)

1. **Cellules `<a:t/>` vides dans le XML PowerPoint** : un simple remplacement texte ne les détecte pas. Toujours vérifier visuellement (conversion PDF + capture d'écran) qu'aucune cellule n'est restée vide après remplissage.
2. **Tableaux FR/BFR et facture sont des images**, pas des tableaux PowerPoint éditables. Il faut régénérer l'image entière via les scripts Python dédiés (`gen_frbfr_image_TRAME.py`, `gen_facture_TRAME.py`), pas éditer le XML.
3. **Alignement des colonnes numériques** : toujours `algn="ctr"` ou `algn="r"` de façon cohérente sur toute une colonne — ne jamais mélanger gauche/centre/droite dans une même colonne de valeurs.
4. **Style des valeurs** : aucune valeur ne doit avoir un style différent (gras, couleur) des autres valeurs de la même colonne, sauf totaux/surlignages volontaires et cohérents sur tout le tableau.
5. **Bulles d'annotation rouges (slide15)** : leur position est en coordonnées EMU absolues. Si l'image de la facture change de proportions, recalculer la position via le ratio (position_y_relative × hauteur_image_EMU + offset_image_y).
6. **Textes d'action courts** : dans les tableaux à hauteur de ligne fixe (slide21), des textes trop longs font déborder le tableau sur le contenu en dessous.

## Workflow recommandé pour un nouveau candidat

1. Copier les 6 fichiers `*_TRAME.*` vers un nouveau dossier `NOM_Prénom/`
2. Renseigner les documents Word/Excel (1, 2, 3, 4, 5) avec python-docx / openpyxl en remplaçant les balises
3. Pour le PowerPoint (6) : dupliquer `unpacked_trame/`, remplacer les balises XML par les vraies valeurs, régénérer les images FR/BFR et facture avec les scripts adaptés, repacker
4. **QA obligatoire** : convertir en PDF, vérifier visuellement chaque slide modifiée (aucune balise `[...]` ne doit subsister, aucun débordement, alignements cohérents)
5. Uploader le dossier complet dans Drive
