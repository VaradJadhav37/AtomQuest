export type UomType = 'Numeric' | 'Percentage' | 'Timeline' | 'Zero';

export const UOM_TYPES: UomType[] = ['Numeric', 'Percentage', 'Timeline', 'Zero'];

export function normalizeUomType(value: string | undefined | null): UomType {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'percentage' || text === '%') return 'Percentage';
  if (text === 'timeline' || text === 'date' || text === 'deadline') return 'Timeline';
  if (text === 'zero' || text === 'zero-based' || text === 'boolean' || text === 'bool') return 'Zero';
  return 'Numeric';
}

export function uomLabel(value: string | undefined | null): string {
  return normalizeUomType(value);
}

export function uomPlaceholder(value: string | undefined | null): string {
  switch (normalizeUomType(value)) {
    case 'Percentage':
      return 'e.g. 15';
    case 'Timeline':
      return 'YYYY-MM-DD';
    case 'Zero':
      return 'e.g. 0';
    default:
      return 'e.g. 2000000';
  }
}

export function isTimelineUom(value: string | undefined | null): boolean {
  return normalizeUomType(value) === 'Timeline';
}

export function computeProgressScore(
  uomType: string | undefined | null,
  targetValue: string | number | null | undefined,
  actualValue: string | number | boolean | null | undefined
): number {
  const type = normalizeUomType(uomType);
  const actualText = actualValue === undefined || actualValue === null ? '' : String(actualValue).trim();
  if (!actualText) return 0;

  if (type === 'Zero') {
    if (['0', 'false', 'no', 'none'].includes(actualText.toLowerCase())) return 100;
    const numeric = Number(actualText);
    if (!Number.isNaN(numeric)) return numeric === 0 ? 100 : 0;
    return 0;
  }

  if (type === 'Timeline') {
    const deadline = new Date(String(targetValue || ''));
    const completion = new Date(actualText);
    if (Number.isNaN(deadline.getTime()) || Number.isNaN(completion.getTime())) return 0;
    if (completion <= deadline) return 100;
    const lateDays = Math.ceil((completion.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 100 - lateDays * 10);
  }

  const target = parseFloat(String(targetValue));
  const actual = parseFloat(actualText);
  if (Number.isNaN(target) || Number.isNaN(actual)) return 0;
  if (target === 0) return actual === 0 ? 100 : 0;
  return Math.min(100, Math.round((actual / target) * 1000) / 10);
}

export function formatProgressFormula(
  uomType: string | undefined | null,
  targetValue: string | number | null | undefined,
  actualValue: string | number | boolean | null | undefined
): string {
  const type = normalizeUomType(uomType);
  const actualText = actualValue === undefined || actualValue === null ? '' : String(actualValue).trim();
  if (!actualText) return 'Enter an actual value to calculate progress.';
  if (type === 'Zero') return `Zero-based: actual "${actualText}" means ${computeProgressScore(type, targetValue, actualValue)}%`;
  if (type === 'Timeline') return `Timeline: actual date ${actualText} vs deadline ${String(targetValue || '').trim()}`;
  return `Achievement (${actualText}) / Target (${String(targetValue || '').trim()})`;
}
