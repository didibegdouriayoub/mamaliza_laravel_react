import { describe, it, expect } from 'vitest';
import { allocateByStock, overAllocated, missingInBatch, StockIngredient } from './batchStock';

const mk = (...qty: number[]) => qty.map(q => ({ ingredients: [{ materialId: 'm1', materialName: 'Milk', quantity: q } as StockIngredient] }));
const stock = (n: number) => (id: string) => (id === 'm1' ? n : undefined);

describe('allocateByStock', () => {
  it('first batch takes what exists, the others get 0', () => {
    const out = allocateByStock(mk(5, 5, 5), stock(3));
    expect(out.map(d => d.ingredients[0].quantity)).toEqual([3, 0, 0]);
    expect(out[0].ingredients[0].needed).toBe(5);
  });

  it('spreads the stock over the batches in order', () => {
    expect(allocateByStock(mk(5, 5, 5), stock(7)).map(d => d.ingredients[0].quantity)).toEqual([5, 2, 0]);
  });

  it('leaves everything alone when the stock is enough', () => {
    const out = allocateByStock(mk(5, 5), stock(10));
    expect(out.map(d => d.ingredients[0].quantity)).toEqual([5, 5]);
    expect(out[0].ingredients[0].needed).toBeUndefined();
  });

  it('zero stock gives zero everywhere; unknown materials are untouched', () => {
    expect(allocateByStock(mk(5, 5), stock(0)).map(d => d.ingredients[0].quantity)).toEqual([0, 0]);
    expect(allocateByStock(mk(5, 5), () => undefined).map(d => d.ingredients[0].quantity)).toEqual([5, 5]);
  });
});

describe('overAllocated', () => {
  it('flags a material used above its stock across batches', () => {
    expect(overAllocated(mk(3, 2), stock(4))).toEqual([{ materialId: 'm1', name: 'Milk', stock: 4, total: 5 }]);
  });
  it('is quiet when the total fits', () => {
    expect(overAllocated(mk(3, 1), stock(4))).toEqual([]);
  });
});

describe('missingInBatch', () => {
  it('counts a replacement lot of the same material towards the need', () => {
    const batch = [
      { materialId: 'm1', materialName: 'Milk', quantity: 3, needed: 5 },
      { materialId: 'm2', materialName: 'Milk', quantity: 1 },
    ];
    expect(missingInBatch(batch, 0)).toBe(1);
    expect(missingInBatch([...batch, { materialId: 'm3', materialName: 'Milk', quantity: 1 }], 0)).toBe(0);
  });
  it('is 0 for rows that were not short', () => {
    expect(missingInBatch([{ materialId: 'm1', materialName: 'Milk', quantity: 5 }], 0)).toBe(0);
  });
});
