import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Factory, Plus, Trash2, Printer, Search, ChevronDown, ChevronRight, CheckCircle2, XCircle, ClipboardList, Eye, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/DataStates';
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

type BatchDraftIngredient = { materialId: string; materialName: string; quantity: number; unit: string; unitPrice: number; };
type BatchDraft = { lot: string; outputQty: number; note: string; ingredients: BatchDraftIngredient[]; };
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
  const [batchCount, setBatchCount] = useState(1);
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(0);

  // Fill details dialog
  const [fillGroup, setFillGroup] = useState<BatchGroup | null>(null);
  const [fillPieces, setFillPieces] = useState('');
  const [fillLeftover, setFillLeftover] = useState('');
  const [fillLeftoverUnit, setFillLeftoverUnit] = useState('kg');

  // Print
  const [printableData, setPrintableData] = useState<PrintData | null>(null);

  // View batch + update recipe
  const [qualityControls, setQualityControls] = useState<QualityControl[]>([]);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);
  const [viewMode, setViewMode] = useState<'detail' | 'edit-recipe'>('detail');
  // recipe edit fields
  const [rName, setRName] = useState('');
  const [rDescription, setRDescription] = useState('');
  const [rTargetWeight, setRTargetWeight] = useState('');
  const [rPieceWeight, setRPieceWeight] = useState('');
  const [rStatus, setRStatus] = useState<'semi_final' | 'final'>('semi_final');
  const [rSteps, setRSteps] = useState<string[]>([]);
  const [rIngredients, setRIngredients] = useState<RecipeIngredient[]>([]);

  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupData, recipeData, invData, qcData] = await Promise.all([
        batchGroupService.getAll(),
        recipeService.getAll(),
        inventoryService.getAll(),
        qualityService.getAll(),
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
        piecesProduced: g.piecesProduced != null ? Number(g.piecesProduced) : undefined,
        leftoverQty: g.leftoverQty != null ? Number(g.leftoverQty) : undefined,
        leftoverUnit: g.leftoverUnit ?? g.leftover_unit ?? 'kg',
        createdAt: g.createdAt ?? g.created_at ?? '',
        batches: (g.batches || []).map((b: any) => ({
          ...b,
          batchGroupId: String(g.id),
          inputMaterials: b.inputMaterials ?? b.input_materials ?? [],
          notes: b.notes ?? [],
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
    const drafts: BatchDraft[] = Array.from({ length: batchCount }, (_, i) => ({
      lot: `LOT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}${String(i + 1).padStart(2,'0')}`,
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

  const removeIngredient = (bIdx: number, iIdx: number) =>
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? { ...d, ingredients: d.ingredients.filter((_, j) => j !== iIdx) } : d));

  const addIngredient = (bIdx: number) =>
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? { ...d, ingredients: [...d.ingredients, { materialId: '', materialName: '', quantity: 0, unit: '', unitPrice: 0 }] } : d));

  const setDraftIngredientMaterial = (bIdx: number, iIdx: number, materialId: string) => {
    const mat = inventory.find(m => String(m.id) === String(materialId));
    if (mat) updateIngredient(bIdx, iIdx, { materialId: String(mat.id), materialName: mat.name, unit: mat.unit, unitPrice: mat.price });
  };

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
      });

      // 2. Create each batch linked to the group
      const printBatches: PrintData['batches'] = [];
      for (let i = 0; i < batchDrafts.length; i++) {
        const draft = batchDrafts[i];
        const created = await batchService.create({
          recipeId: String(recipe.id), recipeName: recipe.name,
          status: 'completed' as BatchStatus,
          inputMaterials: draft.ingredients,
          outputQuantity: draft.outputQty || recipe.targetWeight,
          outputUnit: recipe.pieceWeight,
          operatorId: user?.id, operatorName: user?.name,
          batchGroupId: String(group.id),
        } as any);
        if (draft.note.trim() && created?.id) {
          await batchService.addNote(created.id, { text: draft.note, author: user?.name || 'Unknown' });
        }
        printBatches.push({ batchNum: i + 1, lot: draft.lot, outputQty: draft.outputQty, ingredients: draft.ingredients });
      }

      toast({ title: `${batchDrafts.length} batch${batchDrafts.length !== 1 ? 'es' : ''} created` });
      setPrintableData({ recipe, batches: printBatches, groupId: String(group.id) });
      setFormOpen(false);
      loadData();
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

  const handleFillDetails = async () => {
    if (!fillGroup) return;
    try {
      await batchGroupService.updateStats(fillGroup.id, {
        piecesProduced: fillPieces ? Number(fillPieces) : undefined,
        leftoverQty: fillLeftover ? Number(fillLeftover) : undefined,
        leftoverUnit: fillLeftoverUnit,
      });
      toast({ title: 'Group details saved', description: 'Inventory updated.' });
      setFillGroup(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (group?.batches) {
        for (const b of group.batches) { await batchService.delete(b.id); }
      }
      toast({ title: 'Group deleted', variant: 'destructive' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
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
            <Button onClick={() => { setCreateStep(1); setRecipeId(''); setBatchCount(1); setFormOpen(true); }}>
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
          const produced = (group.piecesProduced ?? 0) * (group.pieceWeightValue || 1);
          const leftover = group.leftoverQty ?? 0;
          const loss = expected - produced + leftover;
          const hasFilled = group.piecesProduced != null || group.leftoverQty != null;

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
                      {failedCount > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />{failedCount}</Badge>}
                    </div>
                    {hasFilled ? (
                      <Badge variant="secondary" className="text-xs">
                        {group.piecesProduced ?? '—'} pcs · {group.leftoverQty ?? '—'} {group.leftoverUnit}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">Awaiting details</Badge>
                    )}
                    <div className="flex gap-1 print:hidden" onClick={e => e.stopPropagation()}>
                      {hasPermission('batches.write') && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                          setFillGroup(group);
                          setFillPieces(group.piecesProduced != null ? String(group.piecesProduced) : '');
                          setFillLeftover(group.leftoverQty != null ? String(group.leftoverQty) : '');
                          setFillLeftoverUnit(group.leftoverUnit ?? 'kg');
                        }}>
                          <ClipboardList className="h-3 w-3 mr-1" /> Fill
                        </Button>
                      )}
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

                {/* Expanded: individual batches + loss summary */}
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
                            <TableCell className="font-mono text-xs">—</TableCell>
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

                    {/* Loss summary */}
                    <div className="px-4 py-3 bg-muted/30 border-t flex flex-wrap gap-4 text-sm">
                      <span>Expected: <span className="font-medium">{expected.toLocaleString()} kg</span></span>
                      <span>Produced: <span className="font-medium">{produced > 0 ? `${produced.toLocaleString()} kg` : '—'}</span></span>
                      <span>Leftover: <span className="font-medium">{leftover > 0 ? `${leftover} ${group.leftoverUnit}` : '—'}</span></span>
                      {hasFilled && <span className={cn('font-semibold', loss > 0 ? 'text-red-600' : 'text-green-600')}>Loss: {loss.toFixed(2)} kg</span>}
                    </div>
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
                  <SelectContent>{recipes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedRecipe && (
                <div className="p-3 bg-accent/40 rounded-lg border text-sm space-y-1">
                  <p><span className="text-muted-foreground">Target yield:</span> <span className="font-medium">{selectedRecipe.targetWeight} {selectedRecipe.pieceWeight}</span></p>
                  <p><span className="text-muted-foreground">Ingredients:</span> <span className="font-medium">{selectedRecipe.ingredients.length} materials</span></p>
                  <p><span className="text-muted-foreground">Cost/batch:</span> <span className="font-medium">€{selectedRecipe.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</span></p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Number of Batches</Label>
                <Input type="number" min={1} max={20} value={batchCount} onChange={e => setBatchCount(Math.max(1, Math.min(20, Number(e.target.value))))} />
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
                      <span className="text-xs text-muted-foreground">{draft.lot} · {draft.ingredients.length} materials · €{draftCost.toFixed(2)}</span>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-3 space-y-3 border-t">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Lot Number</Label><Input className="h-8 text-sm" value={draft.lot} onChange={e => updateDraft(bIdx, { lot: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Output Qty</Label><Input type="number" className="h-8 text-sm" value={draft.outputQty || ''} onChange={e => updateDraft(bIdx, { outputQty: Number(e.target.value) })} /></div>
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ingredients</p>
                        {draft.ingredients.map((ing, iIdx) => (
                          <div key={iIdx} className="grid grid-cols-[1fr_90px_32px] gap-1.5 items-center">
                            {ing.materialId
                              ? <span className="text-sm truncate">{ing.materialName}</span>
                              : <Select value={ing.materialId} onValueChange={v => setDraftIngredientMaterial(bIdx, iIdx, v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select material" /></SelectTrigger>
                                  <SelectContent>{inventory.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
                                </Select>
                            }
                            <div className="flex items-center gap-1">
                              <Input type="number" className="h-8 text-xs" value={ing.quantity || ''} onChange={e => updateIngredient(bIdx, iIdx, { quantity: Number(e.target.value) })} />
                              <span className="text-xs text-muted-foreground w-8 shrink-0">{ing.unit}</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeIngredient(bIdx, iIdx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        ))}
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => addIngredient(bIdx)}><Plus className="h-3 w-3 mr-1" /> Add ingredient</Button>
                        <div className="space-y-1"><Label className="text-xs">Note</Label><Input className="h-8 text-sm" value={draft.note} onChange={e => updateDraft(bIdx, { note: e.target.value })} placeholder="Production notes..." /></div>
                        <p className="text-xs text-right text-muted-foreground">Cost: <span className="font-semibold text-foreground">€{draftCost.toFixed(2)}</span></p>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-sm text-right text-muted-foreground">Total: <span className="font-semibold text-foreground">€{batchDrafts.reduce((s, d) => s + d.ingredients.reduce((ss, i) => ss + i.quantity * i.unitPrice, 0), 0).toFixed(2)}</span></p>
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

      {/* Fill Details dialog */}
      <Dialog open={!!fillGroup} onOpenChange={() => setFillGroup(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Fill Group Details — {fillGroup?.recipeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">These values will create inventory entries for products and leftover materials.</p>
            <div className="space-y-1.5">
              <Label>Pieces Produced (qty)</Label>
              <Input type="number" min={0} value={fillPieces} onChange={e => setFillPieces(e.target.value)} placeholder="e.g. 45" />
              <p className="text-xs text-muted-foreground">Will add to <em>{fillGroup?.recipeName}</em> inventory as <strong>product</strong></p>
            </div>
            <div className="space-y-1.5">
              <Label>Leftover Quantity</Label>
              <div className="flex gap-2">
                <Input type="number" min={0} value={fillLeftover} onChange={e => setFillLeftover(e.target.value)} placeholder="e.g. 2.5" />
                <Select value={fillLeftoverUnit} onValueChange={setFillLeftoverUnit}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Will add to inventory as <strong>leftover</strong> (LO-date-recipe)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFillGroup(null)}>Cancel</Button>
            <Button onClick={handleFillDetails} disabled={!fillPieces && !fillLeftover}>Save & Update Inventory</Button>
          </DialogFooter>
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
              setRTargetWeight(String(recipe.targetWeight || ''));
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
                                <TableCell className="text-right">€{Number(m.unitPrice).toFixed(2)}</TableCell>
                                <TableCell className="text-right font-medium">€{(m.quantity * m.unitPrice).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-semibold">Total</TableCell>
                              <TableCell className="text-right font-bold">
                                €{viewBatch.inputMaterials.reduce((s, m) => s + m.quantity * m.unitPrice, 0).toFixed(2)}
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
                        <div key={i} className="grid grid-cols-[1fr_80px_70px_30px] gap-1.5 items-center">
                          <span className="text-sm truncate">{ing.materialName}</span>
                          <Input type="number" className="h-8 text-xs" value={ing.quantity || ''} onChange={e => setRIngredients(prev => prev.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
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

      {/* Print report dialog */}
      <Dialog open={!!printableData} onOpenChange={() => setPrintableData(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {printableData && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Batch Report — {printableData.recipe.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5" id="printable-batch">
                <div className="flex justify-between text-sm border-b pb-3">
                  <div><p className="font-semibold">{printableData.recipe.name}</p><p className="text-muted-foreground">Piece: {printableData.recipe.pieceWeight}</p></div>
                  <div className="text-right text-muted-foreground"><p>Date: {new Date().toISOString().split('T')[0]}</p><p>Operator: {user?.name}</p><p>{printableData.batches.length} batches</p></div>
                </div>
                {printableData.batches.map((b, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between"><h4 className="font-semibold">Batch #{b.batchNum}</h4><span className="text-sm text-muted-foreground">Lot: <span className="font-mono font-medium text-foreground">{b.lot}</span> · Output: {b.outputQty}</span></div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {b.ingredients.map((ing, i) => <TableRow key={i}><TableCell className="font-medium">{ing.materialName}</TableCell><TableCell className="text-right">{ing.quantity}</TableCell><TableCell>{ing.unit}</TableCell><TableCell className="text-right">€{ing.unitPrice.toFixed(2)}</TableCell><TableCell className="text-right font-medium">€{(ing.quantity * ing.unitPrice).toFixed(2)}</TableCell></TableRow>)}
                        <TableRow><TableCell colSpan={4} className="font-semibold text-right">Batch Total</TableCell><TableCell className="text-right font-bold">€{b.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
                <div className="border-t pt-3 flex justify-between font-semibold"><span>Grand Total</span><span>€{printableData.batches.reduce((sum, b) => sum + b.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 0).toFixed(2)}</span></div>
                {printableData.recipe.steps.length > 0 && <div className="border-t pt-3"><h4 className="font-semibold text-sm mb-2">Steps</h4><ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">{printableData.recipe.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
                <div className="grid grid-cols-2 gap-8 text-sm border-t pt-4"><div><p className="text-muted-foreground mb-8">Operator Signature:</p><div className="border-b border-foreground"></div></div><div><p className="text-muted-foreground mb-8">Supervisor Signature:</p><div className="border-b border-foreground"></div></div></div>
              </div>
              <DialogFooter className="print:hidden">
                <Button variant="outline" onClick={() => setPrintableData(null)}>Close</Button>
                <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
