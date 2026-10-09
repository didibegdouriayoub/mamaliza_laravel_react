export interface SplitGroup { id: string; capacity: number; }

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Spread `totalKg` over the groups in the order given (oldest first): each takes what it has
 * left, and the last one takes whatever remains, so using more than the target is allowed.
 */
export function splitKg(totalKg: number, groups: SplitGroup[]): Record<string, number> {
  const out: Record<string, number> = {};
  let remaining = Math.max(0, totalKg);
  groups.forEach((g, i) => {
    const take = i === groups.length - 1 ? remaining : Math.min(remaining, Math.max(0, g.capacity));
    out[g.id] = round3(take);
    remaining -= take;
  });
  return out;
}
