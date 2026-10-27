export type PhStatus = 'none' | 'low' | 'high' | 'ok';

/** Where a pH sits against the recipe's target range (none = no pH entered or no range set). */
export function phStatus(ph: number | null | undefined, min: number | null | undefined, max: number | null | undefined): PhStatus {
  if (ph == null || Number.isNaN(Number(ph))) return 'none';
  if (min == null && max == null) return 'none';
  if (min != null && ph < min) return 'low';
  if (max != null && ph > max) return 'high';
  return 'ok';
}

/** The production stage counts as done once the main field (final pH) is entered. */
export const productionDone = (q?: { ph?: number | null } | null) => q?.ph != null;
