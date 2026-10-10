import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Factory, Plus, Trash2, Printer, Search, ChevronDown, ChevronRight, CheckCircle2, XCircle, Eye, Pencil } from 'lucide-react';
import { printDocument, fmtDate, fmtEur } from '@/lib/printDocument';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/DataStates';
import { recipeLabel } from '@/lib/recipeLabel';
import { batchService, batchGroupService } from '@/services/batchService';
import { inventoryService } from '@/services/inventoryService';
import { qualityService } from '@/services/qualityService';
import { Batch, BatchStatus, BatchGroup, Recipe, RecipeIngredient, InventoryItem, QualityControl } from '@/models/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { recipeService } from '@/services/recipeService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatDate';

type BatchDraftIngredient = { materialId: string; materialName: string; quantity: number; unit: string; unitPrice: number; lot?: string; linkId?: string; linkSource?: number; custom?: boolean; };
type BatchDraft = { startedAt: string; outputQty: number; note: string; ingredients: BatchDraftIngredient[]; };
type PrintData = { recipe: Recipe; batches: Array<{ batchNum: number; lot: string; outputQty: number; ingredients: BatchDraftIngredient[] }>; groupId: string; };

const parsePieceWeight = (str: string): number => {
  const m = str?.match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
};

export default function Batches() {
  const [groups, setGroups] = useState<BatchGroup[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Create flow
  const [formOpen, setFormOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [recipeId, setRecipeId] = useState('');
  const [batchCount, setBatchCount] = useState('1');
  const [groupDate, setGroupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(0);

  // Record leftover & close
  const [closeGroup, setCloseGroup] = useState<BatchGroup | null>(null);
  const [leftoverKg, setLeftoverKg] = useState('');

  // View group dialog
  const [viewGroup, setViewGroup] = useState<BatchGroup | null>(null);

  // View batch + update recipe
  const [qualityControls, setQualityControls] = useState<QualityControl[]>([]);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);
  const [viewMode, setViewMode] = useState<'detail' | 'edit-recipe'>('detail');
  // recipe edit fields
  const [rName, setRName] = useState('');
  const [rDescription, setRDescription] = useState('');
  const [rTargetWeight, setRTargetWeight] = useState('0');
  const [rPieceWeight, setRPieceWeight] = useState('');
  const [rStatus, setRStatus] = useState<'semi_final' | 'final'>('semi_final');
  const [rSteps, setRSteps] = useState<string[]>([]);
  const [rIngredients, setRIngredients] = useState<RecipeIngredient[]>([]);

  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  // ── Batch Group print  (pivot: ingredients = rows, batches = columns) ───────
  const printBatchGroup = (data: PrintData) => {
    const now     = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // ── 1. Unique ingredients, preserving order of first appearance ──────────
    const ingMap = new Map<string, { name: string; unit: string; lot: string }>();
    for (const b of data.batches) {
      for (const ing of b.ingredients) {
        if (!ingMap.has(ing.materialName)) {
          ingMap.set(ing.materialName, { name: ing.materialName, unit: ing.unit, lot: ing.lot || '' });
        }
      }
    }
    const ingredients = Array.from(ingMap.values());

    // ── 2. Pastel palette for batch columns ──────────────────────────────────
    const palette = [
      { bg: '#EFF6FF', fg: '#1D4ED8' },
      { bg: '#F0FDF4', fg: '#15803D' },
      { bg: '#FFF7ED', fg: '#C2410C' },
      { bg: '#FAF5FF', fg: '#7E22CE' },
      { bg: '#FFF1F2', fg: '#BE123C' },
      { bg: '#ECFEFF', fg: '#0E7490' },
      { bg: '#FEFCE8', fg: '#A16207' },
      { bg: '#F0F9FF', fg: '#0369A1' },
    ];

    // ── 3. Batch column headers ──────────────────────────────────────────────
    const batchHeaderCells = data.batches.map((b, idx) => {
      const { bg, fg } = palette[idx % palette.length];
      return `
        <th class="c" style="background:${bg};color:${fg};min-width:52px;padding:4px 5px;border-bottom:2px solid ${fg}40">
          <div style="font-size:8.5pt;font-weight:700;letter-spacing:.01em">Batch ${b.batchNum}</div>
          ${b.lot ? `<div style="font-size:6.5pt;font-weight:500;margin-top:2px;opacity:.75">Lot ${b.lot}</div>` : ''}
        </th>`;
    }).join('');

    // ── 4. Ingredient rows ───────────────────────────────────────────────────
    const ingRows = ingredients.map((ing, rowIdx) => {
      const batchCells = data.batches.map((b, idx) => {
        const { bg, fg } = palette[idx % palette.length];
        const f = b.ingredients.find(i => i.materialName === ing.name);
        return f
          ? `<td class="c" style="background:${bg}30;color:${fg};font-weight:600;font-size:8.5pt">${f.quantity}</td>`
          : `<td class="c" style="color:#cbd5e1;font-size:8pt">—</td>`;
      }).join('');

      const lotBadge = ing.lot
        ? `<span style="margin-left:6px;background:#f1f5f9;color:#64748b;border-radius:4px;padding:1px 5px;font-size:6.5pt;font-weight:500">${ing.lot}</span>`
        : '';

      return `
        <tr class="${rowIdx % 2 === 1 ? 'alt' : ''}">
          <td class="c" style="color:#94a3b8;font-size:7.5pt">${rowIdx + 1}</td>
          <td style="font-weight:500">${ing.name}${lotBadge}</td>
          <td class="c" style="color:#64748b">${ing.unit}</td>
          ${batchCells}
        </tr>`;
    }).join('');

    // ── 5. Steps ─────────────────────────────────────────────────────────────
    const stepsList = (data.recipe.steps?.length ?? 0) > 0
      ? `<div class="section-title" style="margin-top:22px">Process Steps</div>
         <ol style="padding-left:18px;font-size:8.5pt;line-height:1.9;color:#334155;columns:2;column-gap:32px">
           ${data.recipe.steps.map(s => `<li>${s}</li>`).join('')}
         </ol>`
      : '';

    const html = `
      <style>
        @page { size: A4 landscape; margin: 0; }
        .page { padding: 7mm 10mm !important; }
        .doc-header { padding-bottom: 10px !important; margin-bottom: 12px !important; }
        .cards { margin-bottom: 10px !important; gap: 8px !important; }
        .card { padding: 8px 10px !important; }
        .card-value { font-size: 12pt !important; }
        .section-title { margin: 10px 0 6px !important; }
        table { font-size: 7.5pt !important; }
        td, th { padding: 3px 7px !important; }
      </style>

      <div class="doc-header">
        <div class="brand">
          <div class="brand-icon">FM</div>
          <div>
            <div class="brand-name">Fromagerie Mamaliza</div>
            <div class="brand-sub">Production Report</div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">Batch Group #${data.groupId}</div>
          <div>Generated ${dateStr} at ${timeStr}</div>
          <div>Operator: ${user?.name ?? '—'}</div>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="card-label">Recipe</div>
          <div class="card-value" style="font-size:11pt">${data.recipe.name}</div>
          <div class="card-desc">v${data.recipe.version} · ${data.recipe.recipeStatus}</div>
        </div>
        <div class="card">
          <div class="card-label">Ingredients</div>
          <div class="card-value">${ingredients.length}</div>
          <div class="card-desc">unique materials</div>
        </div>
        <div class="card">
          <div class="card-label">Batches</div>
          <div class="card-value">${data.batches.length}</div>
          <div class="card-desc">piece weight: ${data.recipe.pieceWeight}</div>
        </div>
      </div>

      <div class="section-title">Ingredients × Batches — Quantities per Batch</div>

      <table style="table-layout:auto">
        <thead>
          <tr>
            <th class="c" style="width:24px">#</th>
            <th>Ingredient</th>
            <th class="c" style="width:40px">Unit</th>
            ${batchHeaderCells}
          </tr>
        </thead>
        <tbody>${ingRows}</tbody>
      </table>

      ${stepsList}

      <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;gap:48px">
        <div style="flex:0 0 200px">
          <div style="font-size:8pt;color:#64748b;margin-bottom:20px">Signature</div>
          <div style="border-bottom:1px solid #1a1a1a"></div>
          <div style="font-size:7.5pt;color:#94a3b8;margin-top:4px">${user?.name ?? ''} · ${dateStr}</div>
        </div>
        <div style="flex:1"></div>
      </div>

      <div class="doc-footer">
        <span>Fromagerie Mamaliza — Confidential Production Record</span>
        <span>Group #${data.groupId} · ${data.recipe.name} · ${dateStr}</span>
      </div>`;

    printDocument(`Batch Group #${data.groupId} — ${data.recipe.name}`, html, { fitOnePage: true, pageSizeMm: [297, 210] });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupData, recipeData, invData, qcData] = await Promise.all([
        batchGroupService.getAll(),
        recipeService.getAll().catch(() => []),
        inventoryService.getAll().catch(() => []),
        qualityService.getAll().catch(() => []),
      ]);
      setQualityControls((qcData || []).map((q: any) => ({
        ...q,
        batchId: String(q.batchId ?? q.batch_id ?? ''),
        overallScore: Number(q.overallScore ?? q.overall_score) || 0,
      })));
      const gData = (groupData || []).map((g: any) => ({
        ...g,
        recipeId: String(g.recipeId ?? g.recipe_id ?? ''),
        recipeName: g.recipeName ?? g.recipe_name ?? '',
        batchCount: Number(g.batchCount ?? g.batch_count) || 0,
        targetWeight: Number(g.targetWeight ?? g.target_weight) || 0,
        pieceWeightValue: Number(g.pieceWeightValue ?? g.piece_weight_value) || 0,
        createdAt: g.createdAt ?? g.created_at ?? '',
        usedKg: Number(g.usedKg ?? g.used_kg) || 0,
        leftoverQty: Number(g.leftoverQty ?? g.leftover_qty) || 0,
        closedAt: g.closedAt ?? g.closed_at ?? null,
        batches: (g.batches || []).map((b: any) => ({
          ...b,
          batchGroupId: String(g.id),
          lot: b.lot ?? '',
          inputMaterials: (b.inputMaterials ?? b.input_materials ?? []).map((m: any) => ({
            materialId: String(m.material_id ?? m.materialId ?? ''),
            materialName: m.material_name ?? m.materialName ?? '',
            quantity: Number(m.quantity) || 0,
            unit: m.unit ?? '',
            unitPrice: Number(m.unit_price ?? m.unitPrice) || 0,
          })),
          notes: b.notes ?? [],
          qualityControl: b.qualityControl ?? b.quality_control ?? null,
          startedAt: b.startedAt ?? b.started_at ?? '',
          completedAt: b.completedAt ?? b.completed_at ?? null,
          outputQuantity: Number(b.outputQuantity ?? b.output_quantity) || 0,
          outputUnit: b.outputUnit ?? b.output_unit ?? '',
          operatorName: b.operatorName ?? b.operator_name ?? '',
        })),
      }));
      setGroups(gData);
      const rData = (recipeData || []).map((r: any) => ({
        ...r,
        targetWeight: Number(r.target_weight ?? r.targetWeight) || 0,
        pieceWeight: r.piece_weight ?? r.pieceWeight ?? '',
        ingredients: (r.ingredients || []).map((i: any) => ({ ...i, quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice ?? i.unit_price) || 0 })),
      }));
      setRecipes(rData);
      setInventory((invData || []).map((m: any) => ({ ...m, price: Number(m.price) || 0 })));
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const selectedRecipe = recipes.find(r => String(r.id) === String(recipeId));

  const handleNextStep = () => {
    if (!selectedRecipe) return;
    const count = Math.max(1, Math.min(20, Math.floor(Number(batchCount)) || 1));
    const drafts: BatchDraft[] = Array.from({ length: count }, () => ({
      startedAt: groupDate,
      outputQty: selectedRecipe.targetWeight || 0,
      note: '',
      ingredients: selectedRecipe.ingredients.map(ing => ({ ...ing })),
    }));
    setBatchDrafts(drafts);
    setExpandedBatch(0);
    setCreateStep(2);
  };

  const updateDraft = (bIdx: number, updates: Partial<BatchDraft>) =>
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? { ...d, ...updates } : d));

  const updateIngredient = (bIdx: number, iIdx: number, updates: Partial<BatchDraftIngredient>) =>
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? { ...d, ingredients: d.ingredients.map((ing, j) => j === iIdx ? { ...ing, ...updates } : ing) } : d));

  // Quantity edit on an added ingredient: the first batch edited drives all batches;
  // adjusting any other batch makes that one independent.
  const updateQuantity = (bIdx: number, iIdx: number, quantity: number) =>
    setBatchDrafts(prev => {
      const edited = prev[bIdx]?.ingredients[iIdx];
      if (!edited) return prev;
      const { linkId } = edited;
      if (!linkId) return prev.map((d, i) => i !== bIdx ? d : { ...d, ingredients: d.ingredients.map((ing, j) => j === iIdx ? { ...ing, quantity } : ing) });
      const source = edited.linkSource ?? bIdx;
      return prev.map((d, i) => ({
        ...d,
        ingredients: d.ingredients.map((ing, j) => {
          if (ing.linkId !== linkId) return ing;
          const isEdited = i === bIdx && j === iIdx;
          if (source === bIdx) return isEdited || !ing.custom ? { ...ing, quantity, linkSource: source } : { ...ing, linkSource: source };
          return isEdited ? { ...ing, quantity, custom: true, linkSource: source } : { ...ing, linkSource: source };
        }),
      }));
    });

  const removeIngredient = (bIdx: number, iIdx: number) =>
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? { ...d, ingredients: d.ingredients.filter((_, j) => j !== iIdx) } : d));

  // Add a blank ingredient to every batch (shared linkId)
  const addIngredient = () => {
    const linkId = `new-${Date.now()}`;
    setBatchDrafts(prev => prev.map(d => ({ ...d, ingredients: [...d.ingredients, { materialId: '', materialName: '', quantity: 0, unit: '', unitPrice: 0, linkId }] })));
  };

  const setDraftIngredientMaterial = (bIdx: number, iIdx: number, materialId: string) => {
    const mat = inventory.find(m => String(m.id) === String(materialId));
    if (!mat) return;
    const linkId = batchDrafts[bIdx]?.ingredients[iIdx]?.linkId;
    const patch = { materialId: String(mat.id), materialName: mat.name, unit: mat.unit, unitPrice: mat.price };
    setBatchDrafts(prev => prev.map((d, i) => ({
      ...d,
      ingredients: d.ingredients.map((ing, j) =>
        (i === bIdx && j === iIdx) || (linkId && ing.linkId === linkId && !ing.materialId) ? { ...ing, ...patch } : ing),
    })));
  };

  const rawMaterials = [...inventory]
    .filter(m => m.type === 'raw')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || (a.lot || '').localeCompare(b.lot || ''));

  const handleCreate = async () => {
    const recipe = selectedRecipe;
    if (!recipe) return;
    try {
      // 1. Create the group
      const group = await batchGroupService.create({
        recipeId: String(recipe.id),
        recipeName: recipe.name,
        batchCount: batchDrafts.length,
        targetWeight: recipe.targetWeight,
        pieceWeightValue: parsePieceWeight(recipe.pieceWeight),
        createdBy: user?.name,
        date: groupDate,
      });

      // 2. Create each batch linked to the group
      const printBatches: PrintData['batches'] = [];
      for (let i = 0; i < batchDrafts.length; i++) {
        const draft = batchDrafts[i];
        const created = await batchService.create({
          recipeId: String(recipe.id), recipeName: recipe.name,
          status: 'completed' as BatchStatus,
          startedAt: draft.startedAt,
          inputMaterials: draft.ingredients.map(({ linkId, linkSource, custom, ...ing }) => ing),
          outputQuantity: draft.outputQty || recipe.targetWeight,
          outputUnit: recipe.pieceWeight,
          operatorId: user?.id, operatorName: user?.name,
          batchGroupId: String(group.id),
        } as any);
        if (draft.note.trim() && created?.id) {
          await batchService.addNote(created.id, { text: draft.note, author: user?.name || 'Unknown' });
        }
        printBatches.push({
          batchNum: i + 1, lot: created?.lot || '', outputQty: draft.outputQty,
          ingredients: draft.ingredients.map(ing => ({
            ...ing,
            lot: inventory.find(inv => String(inv.id) === String(ing.materialId))?.lot || '',
          })),
        });
      }

      toast({ title: `${batchDrafts.length} batch${batchDrafts.length !== 1 ? 'es' : ''} created` });
      setFormOpen(false);
      loadData();
      printBatchGroup({ recipe, batches: printBatches, groupId: String(group.id) });
    } catch (err: any) {
      toast({ title: 'Create failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (batchId: string, newStatus: BatchStatus) => {
    try {
      await batchService.update(batchId, { status: newStatus });
      toast({ title: `Batch marked as ${newStatus}` });
      loadData();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await batchGroupService.delete(groupId);
      toast({ title: 'Group deleted', variant: 'destructive' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleClose = async () => {
    if (!closeGroup) return;
    try {
      await batchGroupService.close(closeGroup.id, Number(leftoverKg) || 0);
      toast({ title: 'Batch group done', description: Number(leftoverKg) > 0 ? `${leftoverKg} kg leftover added to inventory.` : undefined });
      setCloseGroup(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Could not close', description: err.message, variant: 'destructive' });
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (loading) return <div className="space-y-6"><TableSkeleton /></div>;

  const visibleGroups = search.trim()
    ? groups.filter(g => g.recipeName.toLowerCase().includes(search.toLowerCase()))
    : groups;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Factory className="h-6 w-6" /> Batches</h1>
          <p className="text-sm text-muted-foreground print:hidden">Track production batches from recipe to product</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center print:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-48" placeholder="Search by recipe..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {hasPermission('batches.write') && (
            <Button onClick={() => { setCreateStep(1); setRecipeId(''); setBatchCount('1'); setGroupDate(new Date().toISOString().slice(0, 10)); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New Batch
            </Button>
          )}
        </div>
      </div>

      {/* Grouped list */}
      <div className="space-y-4">
        {visibleGroups.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No batches yet. Create your first batch group.</CardContent></Card>
        ) : visibleGroups.map(group => {
          const isExpanded = expandedGroups.has(group.id);
          const batches = group.batches ?? [];
          const completedCount = batches.filter(b => b.status === 'completed').length;
          const failedCount = batches.filter(b => b.status === 'failed').length;
          const expected = group.targetWeight * group.batchCount;

          return (
            <motion.div key={group.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-card overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-accent/20 hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="font-semibold text-sm">{group.recipeName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(group.createdAt)} · {group.batchCount} batches</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 text-xs">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />{completedCount}</Badge>
                      <Badge variant="outline" className={group.closedAt ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700 border-amber-200'}>{group.closedAt ? 'Done' : 'Open'}</Badge>
                      {failedCount > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />{failedCount}</Badge>}
                    </div>
                    <div className="flex gap-1 print:hidden" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setViewGroup(group)}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        // Fall back to name match for groups created before recipe_id was persisted
                        const recipe = recipes.find(r => String(r.id) === String(group.recipeId))
                                    || recipes.find(r => r.name === group.recipeName);
                        if (!recipe) {
                          toast({ title: 'Recipe not found', description: `Could not find recipe "${group.recipeName}" to generate the report.`, variant: 'destructive' });
                          return;
                        }
                        const batches = (group.batches ?? []).map((b, idx) => ({
                          batchNum: idx + 1,
                          lot: (b as any).lot || '',
                          outputQty: b.outputQuantity,
                          ingredients: (b.inputMaterials ?? []).map(m => ({
                            materialId: m.materialId,
                            materialName: m.materialName,
                            quantity: m.quantity,
                            unit: m.unit,
                            unitPrice: m.unitPrice,
                            lot: inventory.find(inv => String(inv.id) === String(m.materialId))?.lot || '',
                          })),
                        }));
                        printBatchGroup({ recipe, batches, groupId: String(group.id) });
                      }}>
                        <Printer className="h-3 w-3 mr-1" /> Print
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete this group?</AlertDialogTitle><AlertDialogDescription>All {group.batchCount} batches will be deleted. Inventory will be restored.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGroup(group.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>

                {/* Expanded: individual batches */}
                {isExpanded && (
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">#</TableHead>
                          <TableHead>Lot</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Output</TableHead>
                          <TableHead className="hidden sm:table-cell">Operator</TableHead>
                          <TableHead className="hidden md:table-cell">Started</TableHead>
                          <TableHead className="text-right print:hidden">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batches.map((b, idx) => (
                          <TableRow key={b.id}>
                            <TableCell className="pl-4 text-muted-foreground text-sm">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{b.lot || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={b.status === 'completed' ? 'default' : 'destructive'} className="text-xs capitalize">
                                {b.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">{b.outputQuantity} {b.outputUnit}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{b.operatorName}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(b.startedAt)}</TableCell>
                            <TableCell className="text-right print:hidden">
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setViewBatch(b); setViewMode('detail'); }}>
                                  <Eye className="h-3 w-3 mr-1" /> View
                                </Button>
                                {hasPermission('batches.write') && (
                                  <Button
                                    size="sm" variant="ghost" className="h-7 text-xs"
                                    onClick={() => handleStatusChange(b.id, b.status === 'completed' ? 'failed' : 'completed')}
                                  >
                                    {b.status === 'completed' ? <><XCircle className="h-3 w-3 mr-1 text-destructive" />Mark Failed</> : <><CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />Mark Completed</>}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {(() => {
                      const used = group.usedKg ?? 0;
                      const leftover = group.leftoverQty ?? 0;
                      const loss = expected - used - leftover;
                      const r = (n: number) => Math.round(n * 100) / 100;
                      return (
                        <div className="px-4 py-3 bg-muted/30 border-t text-sm flex flex-wrap items-center gap-x-6 gap-y-1">
                          <span>Expected: <span className="font-medium">{r(expected).toLocaleString()} kg</span></span>
                          <span>Used in finishing: <span className="font-medium">{r(used)} kg</span></span>
                          {group.closedAt ? (
                            <>
                              <span>Leftover: <span className="font-medium">{r(leftover)} kg</span></span>
                              <span className={loss > 0 ? 'text-destructive' : 'text-green-600'}>
                                {loss > 0 ? 'Loss' : 'Gain'}: <span className="font-medium">{r(Math.abs(loss))} kg{expected > 0 ? ` (${r(Math.abs(loss) / expected * 100)}%)` : ''}</span>
                              </span>
                            </>
                          ) : (
                            <span>Left to use: <span className="font-medium">{r(expected - used)} kg</span></span>
                          )}
                          {!group.closedAt && hasPermission('batches.write') && (
                            <Button size="sm" variant="outline" className="h-7 text-xs ml-auto print:hidden"
                              onClick={() => { setCloseGroup(group); setLeftoverKg(String(Math.max(0, r(expected - used)))); }}>
                              Record leftover &amp; close
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Create dialog — 2 steps */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">New Batch Group — Step {createStep} of 2</DialogTitle>
          </DialogHeader>

          {createStep === 1 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Select the recipe and number of batches to create together.</p>
              <div className="space-y-1.5">
                <Label>Recipe</Label>
                <Select value={recipeId} onValueChange={setRecipeId}>
                  <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
                  <SelectContent>{recipes.map(r => <SelectItem key={r.id} value={String(r.id)}>{recipeLabel(r)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedRecipe && (
                <div className="p-3 bg-accent/40 rounded-lg border text-sm space-y-1">
                  <p><span className="text-muted-foreground">Target yield:</span> <span className="font-medium">{selectedRecipe.targetWeight} {selectedRecipe.pieceWeight}</span></p>
                  <p><span className="text-muted-foreground">Ingredients:</span> <span className="font-medium">{selectedRecipe.ingredients.length} materials</span></p>
                  <p><span className="text-muted-foreground">Cost/batch:</span> <span className="font-medium">DH{selectedRecipe.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</span></p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Date (all batches)</Label>
                <Input type="date" value={groupDate} onChange={e => setGroupDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Number of Batches</Label>
                <Input type="number" inputMode="numeric" min={1} max={20} value={batchCount}
                  onChange={e => setBatchCount(e.target.value)}
                  onBlur={() => setBatchCount(String(Math.max(1, Math.min(20, Math.floor(Number(batchCount)) || 1))))} />
              </div>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Edit ingredients and output qty per batch. Batches start as <strong>Completed</strong>.</p>
              {batchDrafts.map((draft, bIdx) => {
                const isOpen = expandedBatch === bIdx;
                const draftCost = draft.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                return (
                  <div key={bIdx} className="border rounded-lg overflow-hidden">
                    <button type="button" className="w-full flex items-center justify-between px-4 py-3 bg-accent/20 hover:bg-accent/40 transition-colors text-left" onClick={() => setExpandedBatch(isOpen ? null : bIdx)}>
                      <span className="font-medium text-sm">Batch #{bIdx + 1}</span>
                      <span className="text-xs text-muted-foreground">{draft.ingredients.length} materials · DH{draftCost.toFixed(2)}</span>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-3 space-y-3 border-t">
                        <div className="space-y-1"><Label className="text-xs">Output Qty</Label><Input type="number" className="h-8 text-sm" value={draft.outputQty} onChange={e => updateDraft(bIdx, { outputQty: Number(e.target.value) })} /></div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ingredients</p>
                        {draft.ingredients.map((ing, iIdx) => (
                          <div key={iIdx} className="grid grid-cols-[1fr_140px_32px] gap-1.5 items-center">
                            {ing.materialId
                              ? <span className="text-sm truncate">{ing.materialName}</span>
                              : <Select value={ing.materialId} onValueChange={v => setDraftIngredientMaterial(bIdx, iIdx, v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select material" /></SelectTrigger>
                                  <SelectContent>{rawMaterials.map(m => (
                                    <SelectItem key={m.id} value={String(m.id)}>
                                      {m.name}{m.lot ? ` · Lot ${m.lot}` : ''} — {m.quantity} {m.unit} in stock
                                    </SelectItem>
                                  ))}</SelectContent>
                                </Select>
                            }
                            <div className="flex items-center gap-1">
                              <Input type="number" className="h-8 text-xs" value={ing.quantity} onChange={e => updateQuantity(bIdx, iIdx, Number(e.target.value))} />
                              <span className="text-xs text-muted-foreground w-8 shrink-0">{ing.unit}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeIngredient(bIdx, iIdx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        ))}
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={addIngredient}><Plus className="h-3 w-3 mr-1" /> Add ingredient (all batches)</Button>
                        <div className="space-y-1"><Label className="text-xs">Note</Label><Input className="h-8 text-sm" value={draft.note} onChange={e => updateDraft(bIdx, { note: e.target.value })} placeholder="Production notes..." /></div>
                        <p className="text-xs text-right text-muted-foreground">Cost: <span className="font-semibold text-foreground">DH{draftCost.toFixed(2)}</span></p>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-sm text-right text-muted-foreground">Total: <span className="font-semibold text-foreground">DH{batchDrafts.reduce((s, d) => s + d.ingredients.reduce((ss, i) => ss + i.quantity * i.unitPrice, 0), 0).toFixed(2)}</span></p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {createStep === 1 ? (
              <><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button disabled={!recipeId} onClick={handleNextStep}>Next →</Button></>
            ) : (
              <><Button variant="outline" onClick={() => setCreateStep(1)}>← Back</Button><Button onClick={handleCreate}>Create {batchDrafts.length} Batch{batchDrafts.length !== 1 ? 'es' : ''}</Button></>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record leftover & close */}
      <Dialog open={!!closeGroup} onOpenChange={v => { if (!v) setCloseGroup(null); }}>
        <DialogContent className="max-w-md">
          {closeGroup && (() => {
            const expected = closeGroup.targetWeight * closeGroup.batchCount;
            const used = closeGroup.usedKg ?? 0;
            const loss = expected - used - (Number(leftoverKg) || 0);
            const r = (n: number) => Math.round(n * 100) / 100;
            return (
              <>
                <DialogHeader><DialogTitle className="font-display">Close — {closeGroup.recipeName}</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2 text-sm">
                  <p className="text-muted-foreground">Expected {r(expected)} kg · used in finishing {r(used)} kg.</p>
                  <div className="space-y-1.5">
                    <Label>Leftover dough (kg)</Label>
                    <Input type="number" inputMode="decimal" min={0} step="0.001" value={leftoverKg} onChange={e => setLeftoverKg(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Added to inventory as a leftover item (no low-stock alert).</p>
                  </div>
                  <p className={loss > 0 ? 'text-destructive' : 'text-green-600'}>
                    {loss > 0 ? 'Loss' : 'Gain'}: <span className="font-semibold">{r(Math.abs(loss))} kg</span>
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCloseGroup(null)}>Cancel</Button>
                  <Button onClick={handleClose}>Mark as done</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Group dialog — full details */}
      <Dialog open={!!viewGroup} onOpenChange={v => { if (!v) setViewGroup(null); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {viewGroup && (() => {
            const expected = viewGroup.targetWeight * viewGroup.batchCount;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display flex items-center gap-2">
                    <Factory className="h-5 w-5" /> {viewGroup.recipeName} — Batch Group
                  </DialogTitle>
                </DialogHeader>

                {/* Group summary bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm border rounded-lg p-3 bg-accent/20">
                  <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{formatDate(viewGroup.createdAt)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Batches</p><p className="font-medium">{viewGroup.batchCount}</p></div>
                  <div><p className="text-xs text-muted-foreground">Target × batches</p><p className="font-medium">{viewGroup.targetWeight} kg × {viewGroup.batchCount} = {expected} kg</p></div>
                </div>

                {/* Per-batch cards */}
                <div className="space-y-4">
                  {(viewGroup.batches ?? []).map((b, idx) => {
                    const qc: QualityControl | null = (b as any).qualityControl
                      ?? qualityControls.find(q => q.batchId === String(b.id))
                      ?? null;
                    const qcNorm = qc ? {
                      taste: Number((qc as any).taste) || 0,
                      texture: Number((qc as any).texture) || 0,
                      smell: Number((qc as any).smell) || 0,
                      overallScore: Number((qc as any).overallScore ?? (qc as any).overall_score) || 0,
                      approved: Boolean((qc as any).approved),
                      evaluator: (qc as any).evaluator ?? '',
                      notes: (qc as any).notes ?? '',
                    } : null;

                    return (
                      <div key={b.id} className="border rounded-lg overflow-hidden">
                        {/* Batch header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-accent/20 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">Batch #{idx + 1}</span>
                            <span className="font-mono text-xs bg-background border rounded px-2 py-0.5">{b.lot || '—'}</span>
                            <Badge variant={b.status === 'completed' ? 'default' : 'destructive'} className="text-xs capitalize">
                              {b.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                              {b.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Output: <strong className="text-foreground">{b.outputQuantity} {b.outputUnit}</strong></span>
                            <span>Operator: <strong className="text-foreground">{b.operatorName || '—'}</strong></span>
                            <span>{formatDate(b.startedAt)}</span>
                          </div>
                        </div>

                        <div className="px-4 py-3 space-y-4">
                          {/* Ingredients */}
                          {b.inputMaterials && b.inputMaterials.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Ingredients</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {b.inputMaterials.map((m, mi) => (
                                    <TableRow key={mi}>
                                      <TableCell className="font-medium py-1.5">{m.materialName}</TableCell>
                                      <TableCell className="text-right py-1.5">{m.quantity}</TableCell>
                                      <TableCell className="py-1.5">{m.unit}</TableCell>
                                      <TableCell className="text-right py-1.5">DH{Number(m.unitPrice).toFixed(2)}</TableCell>
                                      <TableCell className="text-right font-medium py-1.5">DH{(m.quantity * m.unitPrice).toFixed(2)}</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-right font-semibold text-xs">Batch cost</TableCell>
                                    <TableCell className="text-right font-bold text-sm">DH{b.inputMaterials.reduce((s, m) => s + m.quantity * m.unitPrice, 0).toFixed(2)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* QC Evaluation */}
                          {qcNorm ? (
                            <div className="p-3 rounded-lg border bg-accent/10 text-sm">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quality Evaluation</p>
                              <div className="flex flex-wrap items-center gap-4">
                                <span>Taste: <strong>{qcNorm.taste}/5</strong></span>
                                <span>Texture: <strong>{qcNorm.texture}/5</strong></span>
                                <span>Smell: <strong>{qcNorm.smell}/5</strong></span>
                                <span className={cn('font-bold', qcNorm.overallScore > 4 ? 'text-green-600' : qcNorm.overallScore >= 3 ? 'text-amber-600' : 'text-red-600')}>
                                  ⭐ {qcNorm.overallScore}/5
                                </span>
                                <Badge className={qcNorm.approved ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                                  {qcNorm.approved ? 'Approved' : 'Rejected'}
                                </Badge>
                                {qcNorm.evaluator && <span className="text-muted-foreground">by {qcNorm.evaluator}</span>}
                              </div>
                              {qcNorm.notes && <p className="text-xs text-muted-foreground italic mt-1.5">"{qcNorm.notes}"</p>}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No quality evaluation yet.</p>
                          )}

                          {/* Notes */}
                          {b.notes && b.notes.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
                              <div className="space-y-1">
                                {b.notes.map(n => (
                                  <div key={n.id} className="text-sm bg-muted/30 rounded px-3 py-2">
                                    <span className="font-medium">{n.author}:</span> {n.text}
                                    <span className="text-xs text-muted-foreground ml-2">{formatDate(n.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setViewGroup(null)}>Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Batch / Update Recipe dialog */}
      <Dialog open={!!viewBatch} onOpenChange={v => { if (!v) setViewBatch(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewBatch && (() => {
            const qc = qualityControls.find(q => q.batchId === String(viewBatch.id));
            const recipe = recipes.find(r => String(r.id) === String(viewBatch.recipeId));
            const canUpdateRecipe = hasPermission('recipes.write') && qc && qc.overallScore > 4;

            const openEditRecipe = () => {
              if (!recipe) return;
              setRName(recipe.name);
              setRDescription(recipe.description || '');
              setRTargetWeight(String(recipe.targetWeight || '0'));
              setRPieceWeight(recipe.pieceWeight || '');
              setRStatus(recipe.recipeStatus || 'semi_final');
              setRSteps(recipe.steps.length ? [...recipe.steps] : ['']);
              setRIngredients(recipe.ingredients.map(i => ({ ...i })));
              setViewMode('edit-recipe');
            };

            const handleSaveRecipe = async () => {
              if (!recipe) return;
              try {
                await recipeService.update(recipe.id, {
                  name: rName,
                  description: rDescription,
                  targetWeight: Number(rTargetWeight) || 0,
                  pieceWeight: rPieceWeight,
                  recipeStatus: rStatus,
                  steps: rSteps.filter(s => s.trim()),
                  ingredients: rIngredients,
                  packages: recipe.packages,
                  version: (recipe.version || 1) + 1,
                });
                toast({ title: 'Recipe updated', description: `${rName} saved with new parameters.` });
                setViewBatch(null);
                loadData();
              } catch (err: any) {
                toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
              }
            };

            if (viewMode === 'detail') {
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                      <Factory className="h-5 w-5" /> Batch — {viewBatch.recipeName}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant={viewBatch.status === 'completed' ? 'default' : 'destructive'} className="capitalize">
                          {viewBatch.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                          {viewBatch.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Output</p>
                        <p className="font-medium">{viewBatch.outputQuantity} {viewBatch.outputUnit}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Operator</p>
                        <p className="font-medium">{viewBatch.operatorName || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Started</p>
                        <p className="font-medium">{formatDate(viewBatch.startedAt)}</p>
                      </div>
                    </div>

                    {/* Quality score */}
                    {qc ? (
                      <div className="p-3 rounded-lg border bg-accent/20 space-y-1 text-sm">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quality Evaluation</p>
                        <div className="flex items-center gap-4">
                          <span>Taste: <strong>{qc.taste}</strong></span>
                          <span>Texture: <strong>{qc.texture}</strong></span>
                          <span>Smell: <strong>{qc.smell}</strong></span>
                          <span className={cn('font-semibold', qc.overallScore > 4 ? 'text-green-600' : qc.overallScore >= 3 ? 'text-amber-600' : 'text-red-600')}>
                            ⭐ {qc.overallScore}/5
                          </span>
                          <Badge className={qc.approved ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                            {qc.approved ? 'Approved' : 'Rejected'}
                          </Badge>
                        </div>
                        {qc.notes && <p className="text-xs text-muted-foreground italic mt-1">"{qc.notes}"</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No quality evaluation yet.</p>
                    )}

                    {/* Ingredients */}
                    {viewBatch.inputMaterials && viewBatch.inputMaterials.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ingredients Used</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead className="text-right">Unit Price</TableHead>
                              <TableHead className="text-right">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {viewBatch.inputMaterials.map((m, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{m.materialName}</TableCell>
                                <TableCell className="text-right">{m.quantity}</TableCell>
                                <TableCell>{m.unit}</TableCell>
                                <TableCell className="text-right">DH{Number(m.unitPrice).toFixed(2)}</TableCell>
                                <TableCell className="text-right font-medium">DH{(m.quantity * m.unitPrice).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
                              <TableCell className="text-right font-bold">
                                DH{viewBatch.inputMaterials.reduce((s, m) => s + m.quantity * m.unitPrice, 0).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Notes */}
                    {viewBatch.notes && viewBatch.notes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
                        <div className="space-y-1">
                          {viewBatch.notes.map(n => (
                            <div key={n.id} className="text-sm bg-muted/30 rounded px-3 py-2">
                              <span className="font-medium">{n.author}:</span> {n.text}
                              <span className="text-xs text-muted-foreground ml-2">{formatDate(n.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setViewBatch(null)}>Close</Button>
                    {canUpdateRecipe && (
                      <Button onClick={openEditRecipe}>
                        <Pencil className="h-4 w-4 mr-1" /> Update Recipe
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            }

            // edit-recipe mode
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display flex items-center gap-2">
                    <Pencil className="h-5 w-5" /> Update Recipe — {recipe?.name}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground -mt-1">Quality score ⭐ {qc?.overallScore}/5 — updating recipe with new parameters.</p>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Name</Label>
                      <Input value={rName} onChange={e => setRName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Description</Label>
                      <Textarea value={rDescription} onChange={e => setRDescription(e.target.value)} rows={2} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Target Weight (kg)</Label>
                      <Input type="number" value={rTargetWeight} onChange={e => setRTargetWeight(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Piece Weight</Label>
                      <Input value={rPieceWeight} onChange={e => setRPieceWeight(e.target.value)} placeholder="e.g. 500g" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={rStatus} onValueChange={v => setRStatus(v as 'semi_final' | 'final')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semi_final">Semi Final</SelectItem>
                          <SelectItem value="final">Final</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ingredients</p>
                    <div className="space-y-2">
                      {rIngredients.map((ing, i) => (
                        <div key={i} className="grid grid-cols-[1fr_130px_70px_30px] gap-1.5 items-center">
                          <span className="text-sm truncate">{ing.materialName}</span>
                          <Input type="number" className="h-8 text-xs" value={ing.quantity} onChange={e => setRIngredients(prev => prev.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                          <span className="text-xs text-muted-foreground">{ing.unit}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRIngredients(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Steps */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Steps</p>
                    <div className="space-y-2">
                      {rSteps.map((step, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-xs text-muted-foreground mt-2 w-5 shrink-0">{i + 1}.</span>
                          <Input className="h-8 text-sm flex-1" value={step} onChange={e => setRSteps(prev => prev.map((s, j) => j === i ? e.target.value : s))} />
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setRSteps(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setRSteps(prev => [...prev, ''])}>
                        <Plus className="h-3 w-3 mr-1" /> Add step
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setViewMode('detail')}>← Back</Button>
                  <Button onClick={handleSaveRecipe}>Save Recipe</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
