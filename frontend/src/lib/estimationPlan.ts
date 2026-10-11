/**
 * Production estimation by product: "I need N pieces (or cartons) of product X, made with recipe R".
 * Pieces to make = wanted - stock already available; dough = pieces x kg per piece; batches are whole
 * (rounded up per recipe, so two products on the same recipe share batches); ingredients come from the
 * recipe x batches; packaging from the product (per piece) and its carton (per carton).
 */

export interface PlanProduct {
  id: number | string;
  name: string;
  type: 'piece' | 'box';
  inputs: { recipe_id: number | string; kg_per_piece: number }[];
  materials: { inventory_item_id: number | string; qty_per_piece: number; inventory_item?: { name: string; unit: string } }[];
  components: { component_id: number | string; qty_per_box: number }[];
  carton?: { box_id: number | string; qty_per_box: number } | null;
}

export interface PlanRecipe {
  id: string;
  name: string;
  targetWeight: number;
  ingredients: { materialId: string; materialName: string; quantity: number; unit: string; unitPrice: number }[];
}

export interface PlanItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  supplier: string;
  leadTimeDays: number;
}

export interface PlanLine {
  productId: string;
  qty: number;
  unit: 'pieces' | 'cartons';
  recipeId: string;
}

export interface PlanInput {
  lines: PlanLine[];
  products: PlanProduct[];
  recipes: PlanRecipe[];
  inventory: PlanItem[];
  /** pieces already available (loose + sealed cartons), per product id */
  stockOf: (productId: string) => number;
  subtractStock: boolean;
}

export interface NeedRow {
  id: string;
  name: string;
  unit: string;
  needed: number;
  inStock: number;
  deficit: number;
  unitPrice: number;
  supplier: string;
  leadTimeDays: number;
}

export interface LineResult {
  productId: string;
  name: string;
  wantedPieces: number;
  inStock: number;
  piecesToMake: number;
  kgPerPiece: number | null;
  doughKg: number | null;
  cartons: number;
  loosePieces: number;
  warnings: string[];
}

export interface RecipePlan {
  recipeId: string;
  name: string;
  doughKg: number;
  target: number;
  batches: number;
  exactBatches: number;
  producedKg: number;
  surplusKg: number;
  /** pieces the surplus dough could still make */
  extraPieces: number;
}

export interface Plan {
  lines: LineResult[];
  recipes: RecipePlan[];
  ingredients: NeedRow[];
  packaging: NeedRow[];
  shortages: NeedRow[];
  totalPieces: number;
  criticalLeadTime: number;
  cost: { inStock: number; toBuy: number; total: number; perPiece: number | null };
  warnings: string[];
}

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

export function buildPlan(input: PlanInput): Plan {
  const { products, recipes, inventory } = input;
  const lines: LineResult[] = [];
  const doughByRecipe = new Map<string, { dough: number; pieces: number }>();
  const packagingNeeds = new Map<string, { name: string; unit: string; needed: number }>();

  for (const line of input.lines) {
    const product = products.find(p => String(p.id) === line.productId);
    if (!product || !(line.qty > 0)) continue;

    const warnings: string[] = [];
    const perBox = Number(product.carton?.qty_per_box) || 0;
    if (line.unit === 'cartons' && !perBox) warnings.push('This product has no carton defined, so cartons cannot be converted to pieces.');
    const wanted = Math.round(line.unit === 'cartons' ? line.qty * perBox : line.qty);
    const inStock = input.subtractStock ? Math.max(0, input.stockOf(line.productId)) : 0;
    const piecesToMake = Math.max(0, wanted - inStock);

    // dough
    const link = product.inputs.find(i => String(i.recipe_id) === line.recipeId);
    let kgPerPiece: number | null = null;
    let doughKg: number | null = null;
    if (!line.recipeId) {
      warnings.push('Choose a recipe.');
    } else if (!link) {
      warnings.push('This recipe is not linked to the product (Products page).');
    } else if (!(Number(link.kg_per_piece) > 0)) {
      warnings.push('Kg per piece is 0 for this recipe: set it on the Products page to get the dough and ingredients.');
    } else {
      kgPerPiece = Number(link.kg_per_piece);
      doughKg = round(piecesToMake * kgPerPiece);
      const acc = doughByRecipe.get(line.recipeId) ?? { dough: 0, pieces: 0 };
      acc.dough += doughKg;
      acc.pieces += piecesToMake;
      doughByRecipe.set(line.recipeId, acc);
    }

    // cartons: packed automatically when the carton holds this product alone (same rule as Finishing)
    const box = product.carton ? products.find(b => String(b.id) === String(product.carton!.box_id)) : undefined;
    const autoPack = !!box && box.components.length === 1 && perBox > 0;
    const cartons = autoPack ? Math.floor(piecesToMake / perBox) : 0;
    const loosePieces = piecesToMake - cartons * perBox * (autoPack ? 1 : 0);

    const addPackaging = (m: PlanProduct['materials'][number], amount: number) => {
      const key = String(m.inventory_item_id);
      const row = packagingNeeds.get(key) ?? { name: m.inventory_item?.name ?? `#${key}`, unit: m.inventory_item?.unit ?? '', needed: 0 };
      row.needed += amount;
      packagingNeeds.set(key, row);
    };
    product.materials.forEach(m => addPackaging(m, m.qty_per_piece * piecesToMake));
    if (autoPack && cartons > 0) box!.materials.forEach(m => addPackaging(m, m.qty_per_piece * cartons));

    lines.push({ productId: line.productId, name: product.name, wantedPieces: wanted, inStock, piecesToMake, kgPerPiece, doughKg, cartons, loosePieces, warnings });
  }

  // whole batches per recipe (lines on the same recipe share batches)
  const recipePlans: RecipePlan[] = [];
  const ingredientNeeds = new Map<string, { name: string; unit: string; needed: number; recipePrice: number }>();
  const warnings: string[] = [];
  for (const [recipeId, acc] of doughByRecipe) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) continue;
    const target = recipe.targetWeight;
    if (!(target > 0)) warnings.push(`Recipe "${recipe.name}" has no target weight, so batches cannot be counted.`);
    const batches = target > 0 ? Math.max(0, Math.ceil(acc.dough / target - 1e-9)) : 0;
    const producedKg = batches * target;
    const surplusKg = round(Math.max(0, producedKg - acc.dough));
    const avg = acc.pieces > 0 ? acc.dough / acc.pieces : 0;
    recipePlans.push({
      recipeId, name: recipe.name, doughKg: round(acc.dough), target, batches,
      exactBatches: target > 0 ? round(acc.dough / target, 2) : 0, producedKg: round(producedKg), surplusKg,
      extraPieces: avg > 0 ? Math.floor(surplusKg / avg) : 0,
    });
    recipe.ingredients.forEach(ing => {
      const row = ingredientNeeds.get(ing.materialId) ?? { name: ing.materialName, unit: ing.unit, needed: 0, recipePrice: ing.unitPrice };
      row.needed += ing.quantity * batches;
      ingredientNeeds.set(ing.materialId, row);
    });
  }

  const toRow = (id: string, name: string, unit: string, needed: number, fallbackPrice = 0): NeedRow => {
    const inv = inventory.find(i => i.id === id);
    const inStock = inv?.quantity ?? 0;
    const price = inv && inv.price > 0 ? inv.price : fallbackPrice;
    return {
      id, name: inv?.name ?? name, unit: inv?.unit ?? unit, needed: round(needed), inStock,
      deficit: round(Math.max(0, needed - inStock)), unitPrice: price,
      supplier: inv?.supplier ?? '—', leadTimeDays: inv?.leadTimeDays ?? 0,
    };
  };
  const ingredients = [...ingredientNeeds].map(([id, r]) => toRow(id, r.name, r.unit, r.needed, r.recipePrice));
  const packaging = [...packagingNeeds].map(([id, r]) => toRow(id, r.name, r.unit, r.needed));

  const all = [...ingredients, ...packaging];
  const shortages = all.filter(r => r.deficit > 0);
  const inStockCost = all.reduce((s, r) => s + Math.min(r.needed, r.inStock) * r.unitPrice, 0);
  const toBuy = all.reduce((s, r) => s + r.deficit * r.unitPrice, 0);
  const totalPieces = lines.reduce((s, l) => s + l.piecesToMake, 0);

  return {
    lines, recipes: recipePlans, ingredients, packaging, shortages, totalPieces,
    criticalLeadTime: shortages.reduce((m, r) => Math.max(m, r.leadTimeDays), 0),
    cost: {
      inStock: round(inStockCost, 2), toBuy: round(toBuy, 2), total: round(inStockCost + toBuy, 2),
      perPiece: totalPieces > 0 ? round((inStockCost + toBuy) / totalPieces, 2) : null,
    },
    warnings,
  };
}
