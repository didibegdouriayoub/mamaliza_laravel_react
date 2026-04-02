import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Plus, Trash2, Printer, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { printDocument, fmtEur } from '@/lib/printDocument';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { recipeService } from '@/services/recipeService';
import { inventoryService } from '@/services/inventoryService';
import { Recipe, InventoryItem } from '@/models/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface EstimationLine {
  recipeId: string;
  batchCount: number;
}

export default function Estimation() {
  const { user } = useAuth();
  const [lines, setLines] = useState<EstimationLine[]>([{ recipeId: '', batchCount: 1 }]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recipeData, invData] = await Promise.all([
          recipeService.getAll(),
          inventoryService.getAll(),
        ]);
        const rData = (recipeData || []).map((r: any) => ({
          ...r,
          targetWeight: Number(r.target_weight ?? r.targetWeight) || 0,
          pieceWeight: r.piece_weight ?? r.pieceWeight ?? '',
          recipeStatus: r.recipe_status ?? r.recipeStatus ?? 'semi_final',
          packages: (r.packages || []).map((p: any) => ({
            id: String(p.id),
            name: p.name,
            quantity: Number(p.quantity) || 0,
          })),
          ingredients: (r.ingredients || []).map((i: any) => ({
            ...i,
            materialId: String(i.materialId ?? i.material_id ?? ''),
            materialName: i.materialName ?? i.material_name ?? '',
            quantity: Number(i.quantity) || 0,
            unitPrice: Number(i.unitPrice ?? i.unit_price) || 0,
          })),
        }));
        setRecipes(rData);
        const iData = (invData || []).map((i: any) => ({
          ...i,
          quantity: Number(i.quantity) || 0,
          price: Number(i.price) || 0,
          leadTimeDays: Number(i.leadTimeDays ?? i.lead_time_days) || 0,
          supplierId: String(i.supplierId ?? i.supplier?.id ?? ''),
          supplier: i.supplier?.name ?? i.supplier ?? '',
        }));
        setInventory(iData);
      } catch (e) { console.error(e); }
    };
    loadData();
  }, []);

  const addLine = () => setLines(prev => [...prev, { recipeId: '', batchCount: 1 }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx: number, updates: Partial<EstimationLine>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l));

  const hasEstimation = lines.some(l => l.recipeId);

  // ── Aggregate raw material needs (by materialId) ──────────────────────────
  const rawNeeds = new Map<string, {
    materialId: string; name: string; unit: string;
    unitPrice: number; needed: number;
  }>();

  lines.forEach(line => {
    const recipe = recipes.find(r => String(r.id) === String(line.recipeId));
    if (!recipe) return;
    recipe.ingredients.forEach(ing => {
      const key = ing.materialId;
      const existing = rawNeeds.get(key);
      const needed = ing.quantity * line.batchCount;
      if (existing) {
        existing.needed += needed;
      } else {
        rawNeeds.set(key, {
          materialId: key,
          name: ing.materialName,
          unit: ing.unit,
          unitPrice: ing.unitPrice,
          needed,
        });
      }
    });
  });

  // ── Aggregate packaging needs (from recipe.packages × batchCount) ─────────
  const pkgNeeds = new Map<string, {
    invItemId: string; name: string; unit: string;
    price: number; needed: number;
  }>();

  lines.forEach(line => {
    const recipe = recipes.find(r => String(r.id) === String(line.recipeId));
    if (!recipe) return;
    recipe.packages.forEach(pkg => {
      const invItem = inventory.find(i => String(i.id) === String(pkg.id));
      const key = String(pkg.id);
      const needed = pkg.quantity * line.batchCount;
      const existing = pkgNeeds.get(key);
      if (existing) {
        existing.needed += needed;
      } else {
        pkgNeeds.set(key, {
          invItemId: key,
          name: pkg.name,
          unit: invItem?.unit ?? 'pcs',
          price: invItem?.price ?? 0,
          needed,
        });
      }
    });
  });

  // ── Stock check ───────────────────────────────────────────────────────────
  type StockRow = {
    id: string; name: string; unit: string; unitPrice: number;
    needed: number; inStock: number; deficit: number; sufficient: boolean;
    supplier: string; leadTimeDays: number;
  };

  const rawRows: StockRow[] = Array.from(rawNeeds.values()).map(r => {
    const inv = inventory.find(i => String(i.id) === String(r.materialId));
    const inStock = inv?.quantity ?? 0;
    const deficit = Math.max(0, r.needed - inStock);
    return {
      id: r.materialId, name: r.name, unit: r.unit, unitPrice: r.unitPrice,
      needed: r.needed, inStock, deficit, sufficient: deficit === 0,
      supplier: inv?.supplier ?? '—',
      leadTimeDays: inv?.leadTimeDays ?? 0,
    };
  });

  const pkgRows: StockRow[] = Array.from(pkgNeeds.values()).map(p => {
    const inv = inventory.find(i => String(i.id) === p.invItemId);
    const inStock = inv?.quantity ?? 0;
    const deficit = Math.max(0, p.needed - inStock);
    return {
      id: p.invItemId, name: p.name, unit: p.unit, unitPrice: p.price,
      needed: p.needed, inStock, deficit, sufficient: deficit === 0,
      supplier: inv?.supplier ?? '—',
      leadTimeDays: inv?.leadTimeDays ?? 0,
    };
  });

  // ── Procurement plan (deficit rows only) ─────────────────────────────────
  const procurementRows = [...rawRows, ...pkgRows].filter(r => r.deficit > 0);
  const criticalLeadTime = procurementRows.reduce((max, r) => Math.max(max, r.leadTimeDays), 0);

  // ── Cost breakdown ────────────────────────────────────────────────────────
  // Materials already in stock (cost of the portion we consume from existing stock)
  const rawInStockCost = rawRows.reduce((s, r) => {
    const consumed = Math.min(r.needed, r.inStock);
    return s + consumed * r.unitPrice;
  }, 0);
  const pkgInStockCost = pkgRows.reduce((s, r) => {
    const consumed = Math.min(r.needed, r.inStock);
    return s + consumed * r.unitPrice;
  }, 0);
  const inStockCost = rawInStockCost + pkgInStockCost;

  // Materials to order (deficit × unit price)
  const rawOrderCost = rawRows.reduce((s, r) => s + r.deficit * r.unitPrice, 0);
  const pkgOrderCost = pkgRows.reduce((s, r) => s + r.deficit * r.unitPrice, 0);
  const orderCost = rawOrderCost + pkgOrderCost;

  const totalInvestment = inStockCost + orderCost;

  // ── Feasibility ───────────────────────────────────────────────────────────
  const allSufficient = procurementRows.length === 0;
  const criticalCount = procurementRows.filter(r => r.deficit > 0).length;

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const planRows = lines.filter(l => l.recipeId).map(l => {
      const r = recipes.find(rr => String(rr.id) === String(l.recipeId));
      return r ? `${r.name} × ${l.batchCount} batch${l.batchCount !== 1 ? 'es' : ''}` : '';
    }).filter(Boolean).join(', ');

    const mkStockRow = (r: typeof rawRows[0], idx: number) => `
      <tr class="${idx % 2 === 1 ? 'alt' : ''}">
        <td>${r.name}</td>
        <td class="r">${r.needed.toLocaleString('fr-FR')}</td>
        <td>${r.unit}</td>
        <td class="r">${r.inStock.toLocaleString('fr-FR')}</td>
        <td>${r.sufficient
          ? '<span class="badge badge-ok">In Stock</span>'
          : `<span class="badge-need">Need ${r.deficit.toLocaleString('fr-FR')} more</span>`}</td>
        <td class="r">${fmtEur(r.needed * r.unitPrice)}</td>
      </tr>`;

    const mkProcRow = (r: typeof rawRows[0], idx: number) => `
      <tr class="${idx % 2 === 1 ? 'alt' : ''}">
        <td>${r.name}</td>
        <td class="r" style="color:#D4162E;font-weight:700">${r.deficit.toLocaleString('fr-FR')}</td>
        <td>${r.unit}</td>
        <td>${r.supplier}</td>
        <td class="r">${r.leadTimeDays > 0
          ? `<span style="color:#d97706;font-weight:600">${r.leadTimeDays}d</span>`
          : '—'}</td>
        <td class="r">${fmtEur(r.deficit * r.unitPrice)}</td>
      </tr>`;

    const prodSummaryRows = lines.filter(l => l.recipeId).map((l, idx) => {
      const r = recipes.find(rr => String(rr.id) === String(l.recipeId));
      if (!r) return '';
      const batchCost = r.ingredients.reduce((s, ing) => s + ing.quantity * ing.unitPrice, 0);
      const totalYield = (r.targetWeight ?? 0) * l.batchCount;
      return `<tr class="${idx % 2 === 1 ? 'alt' : ''}">
        <td>${r.name}</td>
        <td class="r">${l.batchCount}</td>
        <td class="r">${r.targetWeight ?? '—'} kg</td>
        <td class="r">${totalYield} kg</td>
        <td class="r">${fmtEur(batchCost)}</td>
        <td class="r">${fmtEur(batchCost * l.batchCount)}</td>
      </tr>`;
    }).join('');

    const feasibilityBanner = allSufficient
      ? `<div class="alert ok">✓ All materials are in stock. Production can start immediately.</div>`
      : `<div class="alert warn">⚠ ${criticalCount} material${criticalCount !== 1 ? 's' : ''} need to be ordered before production can start.
          ${criticalLeadTime > 0 ? `Earliest start: <strong>${criticalLeadTime} days</strong>.` : ''}</div>`;

    const html = `
      <div class="doc-header">
        <div class="brand">
          <div class="brand-icon">FM</div>
          <div>
            <div class="brand-name">Fromagerie Mamaliza</div>
            <div class="brand-sub">Production Estimation</div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">Estimation Report</div>
          <div>Generated on ${dateStr} at ${timeStr}</div>
          <div>By ${user?.name ?? '—'} · ${user?.role ?? ''}</div>
        </div>
      </div>

      <div style="margin-bottom:12px;font-size:8.5pt;color:#64748b">
        <strong style="color:#1a1a1a">Plan:</strong> ${planRows || '—'}
      </div>

      ${feasibilityBanner}

      <div class="cards">
        <div class="card">
          <div class="card-label">Already in Stock</div>
          <div class="card-value green">${fmtEur(inStockCost)}</div>
          <div class="card-desc">value consumed from existing stock</div>
        </div>
        <div class="card">
          <div class="card-label">To Order</div>
          <div class="card-value ${orderCost > 0 ? 'orange' : 'green'}">${fmtEur(orderCost)}</div>
          <div class="card-desc">purchase cost of missing materials</div>
        </div>
        <div class="card">
          <div class="card-label">Total Investment</div>
          <div class="card-value red">${fmtEur(totalInvestment)}</div>
          <div class="card-desc">stock used + materials to buy</div>
        </div>
      </div>

      ${rawRows.length > 0 ? `
      <div class="section-title">Raw Materials</div>
      <table>
        <thead><tr>
          <th>Material</th><th class="r">Needed</th><th>Unit</th>
          <th class="r">In Stock</th><th>Status</th><th class="r">Cost</th>
        </tr></thead>
        <tbody>${rawRows.map(mkStockRow).join('')}</tbody>
      </table>` : ''}

      ${pkgRows.length > 0 ? `
      <div class="section-title">Packaging</div>
      <table>
        <thead><tr>
          <th>Item</th><th class="r">Needed</th><th>Unit</th>
          <th class="r">In Stock</th><th>Status</th><th class="r">Cost</th>
        </tr></thead>
        <tbody>${pkgRows.map(mkStockRow).join('')}</tbody>
      </table>` : ''}

      ${procurementRows.length > 0 ? `
      <div class="section-title" style="color:#D4162E">Procurement Plan</div>
      <table>
        <thead><tr>
          <th>Material</th><th class="r">To Order</th><th>Unit</th>
          <th>Supplier</th><th class="r">Lead Time</th><th class="r">Order Cost</th>
        </tr></thead>
        <tbody>${procurementRows.map(mkProcRow).join('')}</tbody>
        <tfoot>
          <tr class="total">
            <td colspan="5">Total to order</td>
            <td class="r">${fmtEur(orderCost)}</td>
          </tr>
        </tfoot>
      </table>` : ''}

      ${prodSummaryRows ? `
      <div class="section-title">Production Summary</div>
      <table>
        <thead><tr>
          <th>Recipe</th><th class="r">Batches</th><th class="r">Yield / Batch</th>
          <th class="r">Total Yield</th><th class="r">Cost / Batch</th><th class="r">Total Cost</th>
        </tr></thead>
        <tbody>${prodSummaryRows}</tbody>
        <tfoot>
          <tr class="total">
            <td colspan="5">Total Investment</td>
            <td class="r">${fmtEur(totalInvestment)}</td>
          </tr>
        </tfoot>
      </table>` : ''}

      <div class="doc-footer">
        <span>Fromagerie Mamaliza — Confidential</span>
        <span>Estimation Report · ${dateStr}</span>
      </div>`;

    printDocument('Estimation Report — Fromagerie Mamaliza', html);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" /> Production Estimation
          </h1>
          <p className="text-sm text-muted-foreground">Plan batches, check stock and procurement needs</p>
        </div>
        {hasEstimation && (
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        )}
      </div>

      {/* Recipe selection */}
      <Card className="shadow-card print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Select Recipes & Batch Counts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              <div className="flex-1 space-y-1.5 w-full">
                <Label className="text-xs">Recipe</Label>
                <Select value={line.recipeId} onValueChange={v => updateLine(idx, { recipeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
                  <SelectContent>
                    {recipes.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name} — {r.targetWeight} {r.pieceWeight}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-32 space-y-1.5">
                <Label className="text-xs">Batches</Label>
                <Input
                  type="number" min={1}
                  value={line.batchCount}
                  onChange={e => updateLine(idx, { batchCount: Math.max(1, Number(e.target.value)) })}
                />
              </div>
              {lines.length > 1 && (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeLine(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3 w-3 mr-1" /> Add Recipe
          </Button>
        </CardContent>
      </Card>

      {hasEstimation && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Feasibility banner */}
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-lg border text-sm font-medium',
            allSufficient
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          )}>
            {allSufficient ? (
              <><CheckCircle2 className="h-5 w-5 shrink-0" /> All materials are in stock — ready to produce.</>
            ) : (
              <><AlertTriangle className="h-5 w-5 shrink-0" /> {criticalCount} material{criticalCount !== 1 ? 's' : ''} need to be ordered before production can start.</>
            )}
          </div>

          {/* Critical path */}
          {!allSufficient && criticalLeadTime > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-blue-50 border-blue-200 text-sm text-blue-800">
              <Clock className="h-5 w-5 shrink-0" />
              <span>
                Earliest production start: <strong>{criticalLeadTime} day{criticalLeadTime !== 1 ? 's' : ''}</strong>
                {' '}— waiting for{' '}
                <strong>{procurementRows.find(r => r.leadTimeDays === criticalLeadTime)?.name}</strong>
                {' '}(longest lead time).
              </span>
            </div>
          )}

          {/* Investment summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Already in Stock</p>
                <p className="text-2xl font-display font-bold text-green-600">€{inStockCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">value consumed from existing stock</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">To Order</p>
                <p className={cn('text-2xl font-display font-bold', orderCost > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                  €{orderCost.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">purchase cost of missing materials</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
                <p className="text-2xl font-display font-bold text-primary">€{totalInvestment.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">stock used + materials to buy</p>
              </CardContent>
            </Card>
          </div>

          {/* Raw materials table */}
          {rawRows.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Raw Materials</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Needed</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">In Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.needed.toFixed(2)}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell className="text-right">{r.inStock}</TableCell>
                        <TableCell>
                          {r.sufficient ? (
                            <Badge className="bg-success text-success-foreground">OK</Badge>
                          ) : (
                            <Badge className="bg-destructive text-destructive-foreground">
                              Need {r.deficit.toFixed(2)} more
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">€{(r.needed * r.unitPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Packaging table */}
          {pkgRows.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Packaging</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Needed</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">In Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pkgRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.needed}</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell className="text-right">{r.inStock}</TableCell>
                        <TableCell>
                          {r.sufficient ? (
                            <Badge className="bg-success text-success-foreground">OK</Badge>
                          ) : (
                            <Badge className="bg-destructive text-destructive-foreground">
                              Need {r.deficit} more
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">€{(r.needed * r.unitPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Procurement plan */}
          {procurementRows.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Procurement Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">To Order</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Lead Time</TableHead>
                      <TableHead className="text-right">Order Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procurementRows
                      .sort((a, b) => b.leadTimeDays - a.leadTimeDays)
                      .map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">
                            {r.deficit % 1 === 0 ? r.deficit : r.deficit.toFixed(2)}
                          </TableCell>
                          <TableCell>{r.unit}</TableCell>
                          <TableCell className="text-muted-foreground">{r.supplier}</TableCell>
                          <TableCell className="text-right">
                            {r.leadTimeDays > 0 ? (
                              <span className={cn(
                                'font-medium',
                                r.leadTimeDays === criticalLeadTime ? 'text-red-600' : 'text-amber-600'
                              )}>
                                {r.leadTimeDays}d
                                {r.leadTimeDays === criticalLeadTime && ' ⚠️'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            €{(r.deficit * r.unitPrice).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-semibold text-sm">Total to order</TableCell>
                      <TableCell className="text-right font-bold">€{orderCost.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Production summary */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Production Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe</TableHead>
                    <TableHead className="text-right">Batches</TableHead>
                    <TableHead className="text-right">Yield / Batch</TableHead>
                    <TableHead className="text-right">Total Yield</TableHead>
                    <TableHead className="text-right">Cost / Batch</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.filter(l => l.recipeId).map((line, i) => {
                    const recipe = recipes.find(r => String(r.id) === String(line.recipeId))!;
                    const batchCost = recipe.ingredients.reduce((s, ing) => s + ing.quantity * ing.unitPrice, 0);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{recipe.name}</TableCell>
                        <TableCell className="text-right">{line.batchCount}</TableCell>
                        <TableCell className="text-right">{recipe.targetWeight} {recipe.pieceWeight}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {(recipe.targetWeight * line.batchCount).toLocaleString()} {recipe.pieceWeight}
                        </TableCell>
                        <TableCell className="text-right">€{batchCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">€{(batchCost * line.batchCount).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </motion.div>
      )}
    </div>
  );
}
