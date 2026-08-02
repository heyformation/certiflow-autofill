/**
 * resolver-config-schema.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TypeScript types for the per-document resolver configuration.
 *
 * Each document type has ONE config that describes how every {{FILL: label}},
 * {{FILL}}, and {{CHECKBOX}} placeholder resolves to a concrete value.
 *
 * There are exactly 3 resolver types (matching the spec §5 categories):
 *   Type 1 — Direct field copy from CandidateRow (deterministic, no AI)
 *   Type 2 — AI-generated content, correlated by competency theme
 *   Type 3 — Fixed / static content (jury names, brand, org-specific)
 */

import { Organization, RSCertificationCode } from './types';

// ─── Resolver Types ──────────────────────────────────────────────────────────

/** Type 1: Direct copy from CandidateRow or derived value */
export interface DirectResolver {
  type: 1;
  /** Key in CandidateRow or a derived-field key like 'fullName', 'email', 'address', 'phone' */
  source: string;
  /** Optional fallback sources tried in order (e.g. ['mail', 'mail_wedof', 'mail_crm']) */
  fallback_sources?: string[];
  /** If true, leave empty when source is empty — never invent (§8.1, mainly for dates) */
  allow_empty?: boolean;
  /** Optional format hint: 'date', 'text', 'number' */
  format?: 'date' | 'text' | 'number';
}

/** Type 2: AI-generated, constrained by competency theme level */
export interface AiResolver {
  type: 2;
  /** The theme id (e.g. 'c1') from theme-config — null for general AI text */
  theme?: string;
  /** Describes what the AI should produce for this field */
  ai_prompt_hint: string;
  /** Content type the AI generates */
  content_type: 'free_text' | 'mcq_answer' | 'checkbox_selection' | 'score' | 'appreciation';
}

/** Type 3: Static / fixed value, never varies per candidate */
export interface StaticResolver {
  type: 3;
  /** Hardcoded value (used directly) */
  static_value?: string;
  /** Or a key into the jury/org config: 'jury_chair', 'jury_member', 'jury_contact', etc. */
  static_source?: 'jury_chair' | 'jury_member' | 'jury_contact' | 'exam_officer' | 'ped_officer' | 'organisme';
}

export type FieldResolverRule = DirectResolver | AiResolver | StaticResolver;

// ─── Field & Checkbox Config Entries ─────────────────────────────────────────

/**
 * Config entry for a single {{FILL: label}} or {{FILL}} placeholder.
 * `tag` is the exact label text (empty string for unlabeled {{FILL}}).
 * `position_hint` disambiguates unlabeled tags by their context.
 */
export interface FieldConfig {
  tag: string;
  resolver: FieldResolverRule;
  /** For unlabeled {{FILL}}, describes the positional context (e.g. "Stagiaire header row") */
  position_hint?: string;
  /** If tag appears N times, which occurrence (0-based). null = all occurrences */
  occurrence?: number | null;
}

/**
 * Config for a group of {{CHECKBOX}} tags that form a single question/option set.
 * The group is identified by the section heading above it.
 */
export interface CheckboxGroupConfig {
  /** Section heading text (closest bold heading above the checkboxes) */
  section: string;
  /** How the selection is determined */
  resolver: FieldResolverRule;
  /** Number of options in this group (for validation) */
  option_count?: number;
}

// ─── Document-Level Config ───────────────────────────────────────────────────

export type DocumentCategory = 'A' | 'B' | 'C';

/**
 * The top-level config for one document type.
 * One config covers all RS codes and both institutes for that document type.
 * RS-specific theme names are looked up at runtime from theme-config.ts.
 */
export interface DocumentResolverConfig {
  /** Document type name (matches filename prefix, e.g. "Recueil des Besoins") */
  document: string;
  /** Spec §5 category */
  category: DocumentCategory;
  /** Which RS codes this document type exists for */
  rs_codes: RSCertificationCode[];
  /** Which institutes this document type exists for */
  institutes: Organization[];
  /** Resolver rules for all {{FILL: label}} and {{FILL}} placeholders */
  fields: FieldConfig[];
  /** Resolver rules for {{CHECKBOX}} groups, keyed by section heading */
  checkbox_groups: CheckboxGroupConfig[];
  /** If true, this document has no real placeholders to fill (e.g. QCM answer keys) */
  skip_fill?: boolean;
}

// ─── Utility Types ───────────────────────────────────────────────────────────

/** Map from document type name to its resolver config */
export type ResolverConfigRegistry = Record<string, DocumentResolverConfig>;

/** Derived value keys that the fill engine can compute from CandidateRow */
export type DerivedFieldKey =
  | 'fullName'        // `${prenom} ${nom}`
  | 'email'           // first non-empty of mail, mail_wedof, mail_crm
  | 'address'         // first non-empty of adresse, adresse_wedof, adresse_postale
  | 'phone'           // numero_tel
  | 'certification'   // `${code_certif} — ${formation}`
  | 'dateSession'     // dates_session or date_debut_session
  | 'dateExamen';     // date_examen

/**
 * Resolve a derived field key from a CandidateRow.
 */
export function resolveDerivedField(key: string, candidate: any): string {
  switch (key) {
    case 'fullName':
      return `${candidate.prenom || ''} ${candidate.nom || ''}`.trim();
    case 'email':
      return candidate.mail || candidate.mail_wedof || candidate.mail_crm || '';
    case 'address':
      return candidate.adresse || candidate.adresse_wedof || candidate.adresse_postale || '';
    case 'phone':
      return candidate.numero_tel || '';
    case 'certification':
      return `${candidate.code_certif} — ${candidate.formation}`;
    case 'dateSession':
      return candidate.dates_session || candidate.date_debut_session || '';
    case 'dateExamen':
      return candidate.date_examen || '';
    default:
      // Try direct field access
      return candidate[key] != null ? String(candidate[key]) : '';
  }
}
