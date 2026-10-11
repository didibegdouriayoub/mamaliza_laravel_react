import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Printer, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { finishedProductService, FinishedProduct, sellableTotal } from '@/services/finishedProductService';
import { recipeService } from '@/services/recipeService';
import { inventoryService } from '@/services/inventoryService';
import { recipeLabel } from '@/lib/recipeLabel';
import { printDocument, fmtEur } from '@/lib/printDocument';
import { buildPlan, NeedRow, PlanItem, PlanLine, PlanRecipe } from '@/lib/estimationPlan';

const emptyLine = (): PlanLine => ({ productId: '', qty: 1, unit: 'pieces', recipeId: '' });
const num = (n: number, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString();

export default function ByProduct() {
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [recipes, setRecipes] = useState<PlanRecipe[]>([]);
  const [inventory, setInventory] = useState<PlanItem[]>([]);
  const [lines, setLines] = useState<PlanLine[]>([emptyLine()]);
  const [subtractStock, setSubtractStock] = useState(true);

  useEffect(() => {
    (async () => {
      const [prods, recs, inv] = await Promise.all([
        finishedProductService.getAll().catch(() => []),
        recipeService.getAll().catch(() => []),
        inventoryService.getAll().catch(() => []),
      ]);
      setProducts((prods || []).filter((p: FinishedProduct) => p.type === 'piece' || p.type === 'box'));
      setRecipes((recs || []).map((r: any) => ({
        id: String(r.id),
        name: r.name,
        targetWeight: Number(r.target_weight ?? r.targetWeight) || 0,
        ingredients: (r.ingredients || []).map((i: any) => ({
          materialId: String(i.materialId ?? i.material_id ?? ''),
          materialName: i.materialName ?? i.material_name ?? '',
          quantity: Number(i.quantity) || 0,
          unit: i.unit ?? '',
          unitPrice: Number(i.unitPrice ?? i.unit_price) || 0,
        })),
      })));
      setInventory((inv || []).map((i: any) => ({
        id: String(i.id),
        name: i.name,
        unit: i.unit ?? '',
        quantity: Number(i.quantity) || 0,
        price: Number(i.price) || 0,
        supplier: typeof i.supplier === 'string' ? i.supplier : (i.supplier?.name ?? ''),
        leadTimeDays: Number(i.leadTimeDays ?? i.lead_time_days) || 0,
      })));
    })();
  }, []);

  const pieceProducts = products.filter(p => p.type === 'piece');
  const productOf = (id: string) => products.find(p => String(p.id) === id);

  const plan = useMemo(() => buildPlan({
    lines, recipes, inventory, subtractStock,
    products: products as any,
    stockOf: id => { const p = products.find(x => String(x.id) === id); return p ? sellableTotal(p) : 0; },
  }), [lines, recipes, inventory, subtractStock, products]);

  const updateLine = (i: number, patch: Partial<PlanLine>) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  const pickProduct = (i: number, productId: string) => {
    const p = productOf(productId);
    // a product with a single recipe is filled in for you; cartons only when the product has one
    const only = p && p.inputs.length === 1 ? String(p.inputs[0].recipe_id) : '';
    setLines(prev => prev.map((l, j) => j === i ? { ...l, productId, recipeId: only, unit: p?.carton ? l.unit : 'pieces' } : l));
  };

  const hasPlan = plan.lines.length > 0;
  const lineResult = (l: PlanLine) => plan.lines.find(r => r.productId === l.productId);

  const handlePrint = () => {
    const rows = (list: NeedRow[]) => list.map(r => `<tr><td>${r.name}</td><td class="r">${num(r.needed)} ${r.unit}</td><td class="r">${num(r.inStock)}</td><td class="r">${r.deficit > 0 ? `<b style="color:#dc2626">${num(r.deficit)}</b>` : '—'}</td></tr>`).join('');
    const html = `
      <h2 style="margin:0 0 8px">Production Estimation</h2>
      <p style="font-size:9pt;color:#64748b">${plan.lines.map(l => `${l.piecesToMake} × ${l.name}`).join(' · ')}</p>
      <h3>Recipes</h3>
      <table><thead><tr><th>Recipe</th><th class="r">Dough</th><th class="r">Batches</th><th class="r">Makes</th><th class="r">Surplus</th></tr></thead><tbody>
        ${plan.recipes.map(r => `<tr><td>${r.name}</td><td class="r">${num(r.doughKg)} kg</td><td class="r">${r.batches}</td><td class="r">${num(r.producedKg)} kg</td><td class="r">${num(r.surplusKg)} kg</td></tr>`).join('')}
      </tbody></table>
      <h3>Ingredients</h3>
      <table><thead><tr><th>Item</th><th class="r">Needed</th><th class="r">In stock</th><th class="r">Missing</th></tr></thead><tbody>${rows(plan.ingredients)}</tbody></table>
      <h3>Packaging</h3>
      <table><thead><tr><th>Item</th><th class="r">Needed</th><th class="r">In stock</th><th class="r">Missing</th></tr></thead><tbody>${rows(plan.packaging)}</tbody></table>
      <h3>Cost</h3>
      <p>From stock: ${fmtEur(plan.cost.inStock)} · To buy: ${fmtEur(plan.cost.toBuy)} · <b>Total: ${fmtEur(plan.cost.total)}</b>${plan.cost.perPiece !== null ? ` · ${fmtEur(plan.cost.perPiece)} per piece` : ''}</p>`;
    printDocument('Production Estimation — by product', html);
  };

  const NeedTable = ({ title, rows }: { title: string; rows: NeedRow[] }) => rows.length === 0 ? null : (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base font-display">{title}</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Needed</TableHead>
              <TableHead className="text-right">In stock</TableHead>
              <TableHead className="text-right">Missing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right">{num(r.needed)} {r.unit}</TableCell>
                <TableCell className="text-right">{num(r.inStock)}</TableCell>
                <TableCell className="text-right">
                  {r.deficit > 0 ? <Badge variant="destructive">{num(r.deficit)} {r.unit}</Badge> : <CheckCircle2 className="h-4 w-4 text-green-600 inline" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-display">What do you need to make?</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l, i) => {
            const p = productOf(l.productId);
            const r = lineResult(l);
            return (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-[1.4fr_90px_120px_1.4fr_36px] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select value={l.productId} onValueChange={v => pickProduct(i, v)}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>{pieceProducts.map(x => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">How many</Label>
                    <Input type="number" min="1" value={l.qty} onChange={e => updateLine(i, { qty: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Select value={l.unit} onValueChange={v => updateLine(i, { unit: v as PlanLine['unit'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pieces">Pieces</SelectItem>
                        {p?.carton && <SelectItem value="cartons">Cartons of {p.carton.qty_per_box}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Recipe</Label>
                    <Select value={l.recipeId} onValueChange={v => updateLine(i, { recipeId: v })} disabled={!p}>
                      <SelectTrigger><SelectValue placeholder={p && p.inputs.length === 0 ? 'No recipe linked' : 'Select recipe'} /></SelectTrigger>
                      <SelectContent>
                        {(p?.inputs ?? []).map(inp => {
                          const rec = recipes.find(x => x.id === String(inp.recipe_id));
                          return (
                            <SelectItem key={String(inp.recipe_id)} value={String(inp.recipe_id)}>
                              {rec ? recipeLabel(rec) : `#${inp.recipe_id}`} — {Number(inp.kg_per_piece) > 0 ? `${inp.kg_per_piece} kg/pc` : 'kg/pc not set'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : [emptyLine()])}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {r && (
                  <p className="text-sm text-muted-foreground">
                    Wanted <b className="text-foreground">{r.wantedPieces}</b>
                    {subtractStock && <> · in stock <b className="text-foreground">{r.inStock}</b></>}
                    {' '}→ make <b className="text-foreground">{r.piecesToMake} pcs</b>
                    {r.doughKg !== null && <> · dough <b className="text-foreground">{num(r.doughKg)} kg</b></>}
                    {r.cartons > 0 && <> · {r.cartons} cartons{r.loosePieces > 0 ? ` + ${r.loosePieces} loose` : ''}</>}
                  </p>
                )}
                {r?.warnings.map(w => (
                  <p key={w} className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" />{w}</p>
                ))}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setLines(prev => [...prev, emptyLine()])}><Plus className="h-3 w-3 mr-1" /> Add product</Button>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={subtractStock} onCheckedChange={v => setSubtractStock(v === true)} /> Subtract finished pieces already in stock
            </label>
          </div>
        </CardContent>
      </Card>

      {hasPlan && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              {[
                { label: 'Pieces to make', value: plan.totalPieces.toLocaleString() },
                { label: 'Dough needed', value: `${num(plan.recipes.reduce((s, r) => s + r.doughKg, 0))} kg` },
                { label: 'Batches', value: String(plan.recipes.reduce((s, r) => s + r.batches, 0)) },
                { label: 'Total cost', value: `DH${num(plan.cost.total)}`, sub: plan.cost.perPiece !== null ? `DH${num(plan.cost.perPiece)} per piece` : undefined },
              ].map(k => (
                <Card key={k.label}><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                  {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
                </CardContent></Card>
              ))}
            </div>
            <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </div>

          {plan.recipes.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-display">Batches to make</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipe</TableHead>
                      <TableHead className="text-right">Dough needed</TableHead>
                      <TableHead className="text-right">Whole batches</TableHead>
                      <TableHead className="text-right">Makes</TableHead>
                      <TableHead className="text-right">Surplus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.recipes.map(r => (
                      <TableRow key={r.recipeId}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{num(r.doughKg)} kg</TableCell>
                        <TableCell className="text-right"><b>{r.batches}</b> × {r.target} kg <span className="text-xs text-muted-foreground">(exact: {r.exactBatches})</span></TableCell>
                        <TableCell className="text-right">{num(r.producedKg)} kg</TableCell>
                        <TableCell className="text-right">{num(r.surplusKg)} kg{r.extraPieces > 0 ? <span className="text-xs text-muted-foreground"> ≈ {r.extraPieces} more pcs</span> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <NeedTable title="Ingredients" rows={plan.ingredients} />
            <NeedTable title="Packaging" rows={plan.packaging} />
          </div>

          {plan.shortages.length > 0 ? (
            <Card className="border-amber-300">
              <CardHeader className="pb-2"><CardTitle className="text-base font-display flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> What to buy</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Buy</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Lead time</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.shortages.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{num(r.deficit)} {r.unit}</TableCell>
                        <TableCell>{r.supplier}</TableCell>
                        <TableCell className="text-right">{r.leadTimeDays > 0 ? `${r.leadTimeDays} d` : '—'}</TableCell>
                        <TableCell className="text-right">DH{num(r.deficit * r.unitPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {plan.criticalLeadTime > 0 && (
                  <p className="px-4 py-3 text-sm flex items-center gap-2 border-t"><Clock className="h-4 w-4 text-amber-600" /> The longest wait is <b>{plan.criticalLeadTime} days</b>: that is the earliest you can start.</p>
                )}
              </CardContent>
            </Card>
          ) : plan.ingredients.length + plan.packaging.length > 0 && (
            <Card className="border-green-300"><CardContent className="p-4 text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> You have everything in stock for this plan.</CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-display">Cost</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-muted-foreground">From your stock</p><p className="font-semibold">DH{num(plan.cost.inStock)}</p></div>
              <div><p className="text-muted-foreground">To buy</p><p className="font-semibold">DH{num(plan.cost.toBuy)}</p></div>
              <div><p className="text-muted-foreground">Total</p><p className="font-bold text-lg">DH{num(plan.cost.total)}</p></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
