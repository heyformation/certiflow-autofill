import { CheckboxTarget } from './types';
import { setCellText } from './replaceText';

export const GLYPH_UNCHECKED = '☐'; // \u2610
export const GLYPH_CHECKED = '☒';   // \u2612

/**
 * Step 5: Checkbox Option Rendering
 * Calculates checkbox states based on user answer (single option string or array of option keys),
 * renders unicode glyph string (☒ checked, ☐ unchecked), and writes to Word cell.
 */
export function computeCheckboxStates(
  answer: string | string[] | boolean | undefined | null,
  config: CheckboxTarget
): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  const selectedValues = Array.isArray(answer)
    ? answer.map((a) => String(a).toLowerCase().trim())
    : typeof answer === 'string'
    ? [answer.toLowerCase().trim()]
    : typeof answer === 'boolean'
    ? [answer ? config.options[0]?.toLowerCase() : '']
    : [];

  for (const opt of config.options) {
    const key = opt.toLowerCase().trim();
    states[opt] = selectedValues.includes(key);
  }

  return states;
}

export function renderCheckboxText(
  states: Record<string, boolean>,
  labels: Record<string, string>
): string {
  const parts: string[] = [];
  for (const [key, isChecked] of Object.entries(states)) {
    const glyph = isChecked ? GLYPH_CHECKED : GLYPH_UNCHECKED;
    const label = labels[key] || labels[key.toLowerCase()] || key;
    parts.push(`${glyph} ${label}`);
  }
  return parts.join('   ');
}

export function fillCheckboxCell(
  cellNode: Element,
  answer: string | string[] | boolean | undefined | null,
  config: CheckboxTarget
): void {
  const states = computeCheckboxStates(answer, config);
  const text = renderCheckboxText(states, config.labels);
  setCellText(cellNode, text);
}
