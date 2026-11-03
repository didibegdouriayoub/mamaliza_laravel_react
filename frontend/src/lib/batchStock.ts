// Stock rules for the batch creation form: an ingredient's stock never goes below zero.

export interface StockIngredient {
  materialId: string;
  materialName?: string;
  quantity: number;
  /** what the recipe asked for, kept when the stock could not cover it */
  needed?: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const EPS = 0.0005;

/**
 * Give each batch what is left in stock, in batch order: with 3 in stock and 5 asked per batch,
 * batch 1 gets 3, the others 0. Materials we do not know the stock of are left as asked.
 */
export function allocateByStock<D extends { ingredients: StockIngredient[] }>(
  drafts: D[], stockOf: (materialId: string) => number | undefined,
): D[] {
  const left = new Map<string, number>();
  return drafts.map(d => ({
    ...d,
    ingredients: d.ingredients.map(ing => {
      const stock = ing.materialId ? stockOf(ing.materialId) : undefined;
      if (stock === undefined) return ing;
      const remaining = left.get(ing.materialId) ?? stock;
      const qty = round3(Math.min(ing.quantity, Math.max(remaining, 0)));
      left.set(ing.materialId, round3(remaining - qty));
      return qty < ing.quantity ? { ...ing, quantity: qty, needed: ing.quantity } : ing;
    }),
  }));
}

export interface StockProblem { materialId: string; name: string; stock: number; total: number }

/** Materials whose quantities over all batches add up to more than the stock. */
export function overAllocated<D extends { ingredients: StockIngredient[] }>(
  drafts: D[], stockOf: (materialId: string) => number | undefined,
): StockProblem[] {
  const totals = new Map<string, { name: string; total: number }>();
  for (const d of drafts) for (const ing of d.ingredients) {
    if (!ing.materialId) continue;
    const t = totals.get(ing.materialId) ?? { name: ing.materialName || '', total: 0 };
    t.total += Number(ing.quantity) || 0;
    totals.set(ing.materialId, t);
  }
  const problems: StockProblem[] = [];
  totals.forEach((t, materialId) => {
    const stock = stockOf(materialId);
    if (stock !== undefined && t.total > stock + EPS) problems.push({ materialId, name: t.name, stock, total: round3(t.total) });
  });
  return problems;
}

/**
 * How much of what the recipe asked is still missing in one batch. A replacement lot of the same
 * material (same name) added to the batch counts towards it.
 */
export function missingInBatch(ingredients: (StockIngredient & { materialName?: string })[], index: number): number {
  const ing = ingredients[index];
  if (!ing || ing.needed === undefined) return 0;
  const covered = ingredients
    .filter(o => o.materialName && o.materialName === ing.materialName)
    .reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  return Math.max(0, round3(ing.needed - covered));
}
