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

// ---- Tasting ----------------------------------------------------------------

export type CheeseType = 'mozzarella' | 'fondue' | null | undefined;
export type Verdict = 'approved' | 'review' | 'rejected';
export type TastingScores = Partial<Record<string, number | null>>;

export interface TastingCriterion { key: string; label: string; weight: number }

/** Scores run 1 (poor) to 5 (excellent). Taste counts double. Criteria depend on the cheese type. */
export function tastingCriteria(type: CheeseType): TastingCriterion[] {
  const base = [{ key: 'taste', label: 'Taste', weight: 2 }, { key: 'texture', label: 'Texture', weight: 1 }];
  if (type === 'mozzarella') return [...base, { key: 'stretch', label: 'Stretch', weight: 1 }, { key: 'melt', label: 'Melt', weight: 1 }];
  if (type === 'fondue') return [...base, { key: 'creaminess', label: 'Creaminess', weight: 1 }, { key: 'smoothness', label: 'Smoothness', weight: 1 }];
  return base;
}

/** Weighted average of the scores, or null until every criterion has a score. */
export function tastingScore(scores: TastingScores | null | undefined, type: CheeseType): number | null {
  const criteria = tastingCriteria(type);
  let sum = 0, weights = 0;
  for (const c of criteria) {
    const v = scores?.[c.key];
    if (v == null) return null;
    sum += v * c.weight;
    weights += c.weight;
  }
  return Math.round((sum / weights) * 100) / 100;
}

/** 4 and above is approved, 3 to 4 needs a review, below 3 is rejected. A pH outside the range never gets better than "review". */
export function suggestedVerdict(score: number | null, ph: PhStatus): Verdict | null {
  if (score == null) return null;
  const v: Verdict = score >= 4 ? 'approved' : score >= 3 ? 'review' : 'rejected';
  return v === 'approved' && (ph === 'low' || ph === 'high') ? 'review' : v;
}

/** The verdict that counts: the taster's choice when set, else the suggestion. */
export const finalVerdict = (override: Verdict | null | undefined, suggested: Verdict | null): Verdict | null => override ?? suggested;

export const tastingDone = (q: { tastingScores?: TastingScores | null } | null | undefined, type: CheeseType) =>
  tastingScore(q?.tastingScores, type) != null;
