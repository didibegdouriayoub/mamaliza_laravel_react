import { buildPlan, PlanInput, PlanProduct, PlanRecipe, PlanItem } from './estimationPlan';

const box: PlanProduct = {
  id: 20, name: 'Kroom pot caisse', type: 'box', inputs: [], carton: null,
  components: [{ component_id: 1, qty_per_box: 6 }],
  materials: [{ inventory_item_id: 'tape', qty_per_piece: 1, inventory_item: { name: 'Tape', unit: 'pc' } }],
};
const pot: PlanProduct = {
  id: 1, name: 'Kroom pot', type: 'piece',
  inputs: [{ recipe_id: 'A', kg_per_piece: 0.4 }, { recipe_id: 'B', kg_per_piece: 0 }],
  materials: [{ inventory_item_id: 'lid', qty_per_piece: 1, inventory_item: { name: 'Lid', unit: 'pc' } }],
  components: [], carton: { box_id: 20, qty_per_box: 6 },
};
const cup: PlanProduct = { id: 2, name: 'Kroom cup', type: 'piece', inputs: [{ recipe_id: 'A', kg_per_piece: 0.3 }], materials: [], components: [], carton: null };

const recipes: PlanRecipe[] = [
  { id: 'A', name: 'Kroom 100', targetWeight: 100, ingredients: [{ materialId: 'milk', materialName: 'Milk', quantity: 50, unit: 'kg', unitPrice: 2 }] },
  { id: 'B', name: 'Kroom 150', targetWeight: 150, ingredients: [] },
];
const inventory: PlanItem[] = [
  { id: 'milk', name: 'Milk', unit: 'kg', quantity: 80, price: 2, supplier: 'Laiterie', leadTimeDays: 2 },
  { id: 'lid', name: 'Lid', unit: 'pc', quantity: 1000, price: 0.5, supplier: 'Pack', leadTimeDays: 0 },
  { id: 'tape', name: 'Tape', unit: 'pc', quantity: 10, price: 1, supplier: 'Pack', leadTimeDays: 5 },
];

const plan = (over: Partial<PlanInput> & Pick<PlanInput, 'lines'>) =>
  buildPlan({ products: [pot, cup, box], recipes, inventory, stockOf: () => 0, subtractStock: true, ...over });

describe('estimation by product', () => {
  it('turns pieces into dough, whole batches, surplus and ingredients', () => {
    const p = plan({ lines: [{ productId: '1', qty: 450, unit: 'pieces', recipeId: 'A' }] });
    expect(p.lines[0].doughKg).toBe(180);                 // 450 x 0.4
    expect(p.recipes[0]).toMatchObject({ batches: 2, producedKg: 200, surplusKg: 20, extraPieces: 50 });
    const milk = p.ingredients.find(i => i.id === 'milk')!;
    expect(milk.needed).toBe(100);                        // 50 kg x 2 batches
    expect(milk.deficit).toBe(20);                        // only 80 kg in stock
    expect(milk.supplier).toBe('Laiterie');
  });

  it('subtracts the stock already available', () => {
    const p = plan({ lines: [{ productId: '1', qty: 450, unit: 'pieces', recipeId: 'A' }], stockOf: () => 100 });
    expect(p.lines[0]).toMatchObject({ wantedPieces: 450, inStock: 100, piecesToMake: 350, doughKg: 140 });
    expect(plan({ lines: [{ productId: '1', qty: 450, unit: 'pieces', recipeId: 'A' }], stockOf: () => 100, subtractStock: false }).lines[0].piecesToMake).toBe(450);
  });

  it('accepts cartons and prices packaging per piece and per carton', () => {
    const p = plan({ lines: [{ productId: '1', qty: 75, unit: 'cartons', recipeId: 'A' }] });
    expect(p.lines[0]).toMatchObject({ wantedPieces: 450, cartons: 75, loosePieces: 0 });
    expect(p.packaging.find(r => r.id === 'lid')!.needed).toBe(450);   // 1 per piece
    const tape = p.packaging.find(r => r.id === 'tape')!;
    expect(tape.needed).toBe(75);                                      // 1 per carton
    expect(tape.deficit).toBe(65);                                     // 10 in stock
    expect(p.criticalLeadTime).toBe(5);
  });

  it('shares batches between products on the same recipe before rounding up', () => {
    const p = plan({ lines: [
      { productId: '1', qty: 150, unit: 'pieces', recipeId: 'A' },   // 60 kg
      { productId: '2', qty: 100, unit: 'pieces', recipeId: 'A' },   // 30 kg
    ] });
    expect(p.recipes).toHaveLength(1);
    expect(p.recipes[0]).toMatchObject({ doughKg: 90, batches: 1 }); // not 1 + 1
  });

  it('costs the plan: what stock covers and what must be bought', () => {
    const p = plan({ lines: [{ productId: '1', qty: 450, unit: 'pieces', recipeId: 'A' }] });
    // milk 100 kg: 80 in stock + 20 to buy at 2; lids 450 in stock at 0.5; tape 75: 10 in stock + 65 to buy at 1
    expect(p.cost.inStock).toBe(80 * 2 + 450 * 0.5 + 10 * 1);
    expect(p.cost.toBuy).toBe(20 * 2 + 65 * 1);
    expect(p.cost.perPiece).toBe(Math.round(p.cost.total / 450 * 100) / 100);
  });

  it('warns instead of guessing when kg per piece or the recipe link is missing, but still plans packaging', () => {
    const noKg = plan({ lines: [{ productId: '1', qty: 60, unit: 'pieces', recipeId: 'B' }] });
    expect(noKg.lines[0].doughKg).toBeNull();
    expect(noKg.lines[0].warnings[0]).toMatch(/Kg per piece is 0/);
    expect(noKg.recipes).toHaveLength(0);
    expect(noKg.packaging.find(r => r.id === 'lid')!.needed).toBe(60);

    const notLinked = plan({ lines: [{ productId: '2', qty: 10, unit: 'pieces', recipeId: 'B' }] });
    expect(notLinked.lines[0].warnings[0]).toMatch(/not linked/);
  });

  it('plans nothing when stock already covers the order', () => {
    const p = plan({ lines: [{ productId: '1', qty: 50, unit: 'pieces', recipeId: 'A' }], stockOf: () => 80 });
    expect(p.lines[0].piecesToMake).toBe(0);
    expect(p.recipes[0]?.batches ?? 0).toBe(0);
    expect(p.shortages).toHaveLength(0);
  });
});
