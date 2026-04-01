import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Factory, Plus, Edit, Trash2, Printer, Search, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BatchStatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/DataStates';
import { batchService } from '@/services/batchService';
import { inventoryService } from '@/services/inventoryService';
import { Batch, BatchStatus, Recipe, InventoryItem } from '@/models/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { recipeService } from '@/services/recipeService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const statusOrder: BatchStatus[] = ['draft', 'in_production', 'completed', 'failed'];
const statusLabels: Record<BatchStatus, string> = {
  draft: '📝 Draft', in_production: '🔥 In Production', completed: '✅ Completed', failed: '❌ Failed',
};

type BatchDraftIngredient = {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type BatchDraft = {
  lot: string;
  outputQty: number;
  note: string;
  ingredients: BatchDraftIngredient[];
};

type PrintData = {
  recipe: Recipe;
  batches: Array<{ batchNum: number; lot: string; outputQty: number; ingredients: BatchDraftIngredient[] }>;
};

export default function Batches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [formOpen, setFormOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [recipeId, setRecipeId] = useState('');
  const [batchCount, setBatchCount] = useState(1);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<number | null>(0);
  // Edit-only fields
  const [status, setStatus] = useState<BatchStatus>('draft');
  const [outputQty, setOutputQty] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [printableData, setPrintableData] = useState<PrintData | null>(null);
  const [search, setSearch] = useState('');
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchData, recipeData, invData] = await Promise.all([
        batchService.getAll(),
        recipeService.getAll(),
        inventoryService.getAll(),
      ]);
      const bData = (batchData || []).map((b: any) => ({
        ...b,
        inputMaterials: b.inputMaterials || [],
        notes: b.notes || [],
      }));
      setBatches(bData);
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

  const openCreate = () => {
    setEditingBatch(null); setRecipeId(''); setBatchCount(1); setCreateStep(1);
    setBatchDrafts([]); setExpandedBatch(0); setFormOpen(true);
  };

  const openEdit = (b: Batch) => {
    setEditingBatch(b); setRecipeId(b.recipeId); setBatchCount(1);
    setStatus(b.status); setOutputQty(b.outputQuantity); setNoteText('');
    setFormOpen(true); setSelected(null);
  };

  const selectedRecipe = recipes.find(r => String(r.id) === String(recipeId));

  const handleNextStep = () => {
    if (!selectedRecipe) return;
    const drafts: BatchDraft[] = Array.from({ length: batchCount }, (_, i) => ({
      lot: `LOT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(i + 1).padStart(2,'0')}`,
      outputQty: selectedRecipe.targetWeight || 0,
      note: '',
      ingredients: selectedRecipe.ingredients.map(ing => ({ ...ing })),
    }));
    setBatchDrafts(drafts);
    setExpandedBatch(0);
    setCreateStep(2);
  };

  const updateDraft = (bIdx: number, updates: Partial<BatchDraft>) => {
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? { ...d, ...updates } : d));
  };

  const updateIngredient = (bIdx: number, iIdx: number, updates: Partial<BatchDraftIngredient>) => {
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? {
      ...d,
      ingredients: d.ingredients.map((ing, j) => j === iIdx ? { ...ing, ...updates } : ing),
    } : d));
  };

  const removeIngredient = (bIdx: number, iIdx: number) => {
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? {
      ...d, ingredients: d.ingredients.filter((_, j) => j !== iIdx),
    } : d));
  };

  const addIngredient = (bIdx: number) => {
    setBatchDrafts(prev => prev.map((d, i) => i === bIdx ? {
      ...d, ingredients: [...d.ingredients, { materialId: '', materialName: '', quantity: 0, unit: '', unitPrice: 0 }],
    } : d));
  };

  const setDraftIngredientMaterial = (bIdx: number, iIdx: number, materialId: string) => {
    const mat = inventory.find(m => String(m.id) === String(materialId));
    if (mat) updateIngredient(bIdx, iIdx, { materialId: String(mat.id), materialName: mat.name, unit: mat.unit, unitPrice: mat.price });
  };

  const handleSave = async () => {
    const recipe = recipes.find(r => String(r.id) === String(recipeId));
    if (!recipe) return;
    try {
      if (editingBatch) {
        await batchService.update(editingBatch.id, {
          recipeId, recipeName: recipe.name, status, outputQuantity: outputQty,
          inputMaterials: recipe.ingredients,
        });
        if (noteText.trim()) {
          await batchService.addNote(editingBatch.id, { text: noteText, author: user?.name || 'Unknown' });
        }
        toast({ title: 'Batch updated' });
        setFormOpen(false);
        loadData();
      } else {
        // Create all batches from drafts
        const printBatches: PrintData['batches'] = [];
        for (let i = 0; i < batchDrafts.length; i++) {
          const draft = batchDrafts[i];
          const created = await batchService.create({
            recipeId, recipeName: recipe.name, status: 'draft',
            inputMaterials: draft.ingredients,
            outputQuantity: draft.outputQty || recipe.targetWeight,
            outputUnit: recipe.pieceWeight,
            operatorId: user?.id, operatorName: user?.name,
          });
          if (draft.note.trim() && created?.id) {
            await batchService.addNote(created.id, { text: draft.note, author: user?.name || 'Unknown' });
          }
          printBatches.push({ batchNum: i + 1, lot: draft.lot, outputQty: draft.outputQty, ingredients: draft.ingredients });
        }
        toast({ title: `${batchDrafts.length} batch${batchDrafts.length > 1 ? 'es' : ''} created` });
        setPrintableData({ recipe, batches: printBatches });
        setFormOpen(false);
        loadData();
      }
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await batchService.delete(id);
      toast({ title: 'Batch deleted', variant: 'destructive' });
      setSelected(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (batchId: string, newStatus: BatchStatus) => {
    try {
      await batchService.update(batchId, {
        status: newStatus,
        completedAt: (newStatus === 'completed' || newStatus === 'failed')
          ? new Date().toISOString().split('T')[0]
          : undefined,
      });
      toast({ title: `Status changed to ${newStatus.replace('_', ' ')}` });
      loadData();
      setSelected(null);
    } catch (err: any) {
      toast({ title: 'Status update failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    }
  };

  const handlePrintBatchTable = () => window.print();

  if (loading) return <div className="space-y-6"><TableSkeleton /></div>;

  const visibleBatches = search.trim()
    ? batches.filter(b => b.recipeName.toLowerCase().includes(search.toLowerCase()) || b.operatorName.toLowerCase().includes(search.toLowerCase()))
    : batches;

  const grouped = statusOrder.reduce((acc, s) => {
    acc[s] = visibleBatches.filter(b => b.status === s);
    return acc;
  }, {} as Record<BatchStatus, Batch[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Factory className="h-6 w-6" /> Batches</h1>
          <p className="text-sm text-muted-foreground">Track production batches from draft to completion</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-48" placeholder="Search batches..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Tabs value={view} onValueChange={v => setView(v as 'kanban' | 'table')}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
          {hasPermission('batches.write') && (
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Batch</Button>
          )}
        </div>
      </div>

      <div className="print:hidden">
        {view === 'kanban' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statusOrder.map(st => (
              <div key={st} className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  {statusLabels[st]} <span className="text-muted-foreground">({grouped[st].length})</span>
                </h3>
                {grouped[st].map((batch, idx) => (
                  <motion.div key={batch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="shadow-soft hover:shadow-card transition-shadow cursor-pointer" onClick={() => setSelected(batch)}>
                      <CardContent className="p-4 space-y-2">
                        <p className="font-medium text-sm">{batch.recipeName}</p>
                        <p className="text-xs text-muted-foreground">Started: {batch.startedAt}</p>
                        {batch.qualityScore && <p className="text-xs">⭐ {batch.qualityScore}/5</p>}
                        <p className="text-xs text-muted-foreground">By {batch.operatorName}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <Card className="shadow-card">
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left">
                  <th className="pb-2 font-medium">Recipe</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium hidden sm:table-cell">Started</th><th className="pb-2 font-medium hidden sm:table-cell">Score</th><th className="pb-2 font-medium hidden md:table-cell">Operator</th>
                </tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id} className="border-b last:border-0 cursor-pointer hover:bg-accent/30" onClick={() => setSelected(b)}>
                      <td className="py-2 font-medium">{b.recipeName}</td>
                      <td className="py-2"><BatchStatusBadge status={b.status} /></td>
                      <td className="py-2 text-muted-foreground hidden sm:table-cell">{b.startedAt}</td>
                      <td className="py-2 hidden sm:table-cell">{b.qualityScore ? `⭐ ${b.qualityScore}` : '—'}</td>
                      <td className="py-2 text-muted-foreground hidden md:table-cell">{b.operatorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-3">
                  {selected.recipeName} <BatchStatusBadge status={selected.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Started:</span> {selected.startedAt}</div>
                  <div><span className="text-muted-foreground">Completed:</span> {selected.completedAt || '—'}</div>
                  <div><span className="text-muted-foreground">Output:</span> {selected.outputQuantity} {selected.outputUnit}</div>
                  <div><span className="text-muted-foreground">Quality:</span> {selected.qualityScore ? `⭐ ${selected.qualityScore}/5` : '—'}</div>
                </div>
                <div>
                  <h4 className="font-display font-semibold text-sm mb-2">Input Materials</h4>
                  {(selected.inputMaterials || []).map((m, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span>{m.materialName}</span>
                      <span className="text-muted-foreground">{m.quantity} {m.unit}</span>
                    </div>
                  ))}
                </div>
                {(selected.notes || []).length > 0 && (
                  <div>
                    <h4 className="font-display font-semibold text-sm mb-2">Notes</h4>
                    {selected.notes.map(n => (
                      <div key={n.id} className="text-sm py-1 border-b last:border-0">
                        <p>{n.text}</p>
                        <p className="text-xs text-muted-foreground">{n.author} — {n.createdAt}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Change Status</Label>
                  {hasPermission('batches.write') && (
                    <div className="flex gap-2 flex-wrap">
                      {statusOrder.filter(s => s !== selected.status).map(s => (
                        <Button key={s} variant="outline" size="sm" onClick={() => handleStatusChange(selected.id, s)} className="capitalize">
                          {s.replace('_', ' ')}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2">
                {hasPermission('batches.write') && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete this batch?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(selected.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button size="sm" onClick={() => openEdit(selected)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog — multi-step */}
      <Dialog open={formOpen && !editingBatch} onOpenChange={open => { if (!open) setFormOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">New Batch — Step {createStep} of 2</DialogTitle>
          </DialogHeader>

          {createStep === 1 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Select the recipe and how many batches to create.</p>
              <div className="space-y-1.5">
                <Label>Recipe</Label>
                <Select value={recipeId} onValueChange={setRecipeId}>
                  <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
                  <SelectContent>
                    {recipes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedRecipe && (
                <div className="p-3 bg-accent/40 rounded-lg text-sm space-y-1 border">
                  <p><span className="text-muted-foreground">Target yield:</span> <span className="font-medium">{selectedRecipe.targetWeight} {selectedRecipe.pieceWeight}</span></p>
                  <p><span className="text-muted-foreground">Ingredients:</span> <span className="font-medium">{selectedRecipe.ingredients.length} materials</span></p>
                  <p><span className="text-muted-foreground">Base cost / batch:</span> <span className="font-medium">€{selectedRecipe.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</span></p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Number of Batches</Label>
                <Input
                  type="number" min={1} max={20}
                  value={batchCount}
                  onChange={e => setBatchCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                />
              </div>
              {selectedRecipe && batchCount > 1 && (
                <p className="text-sm text-muted-foreground">
                  Total yield: <span className="font-medium text-foreground">{selectedRecipe.targetWeight * batchCount} {selectedRecipe.pieceWeight}</span> ·
                  Est. cost: <span className="font-medium text-foreground">€{(selectedRecipe.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * batchCount).toFixed(2)}</span>
                </p>
              )}
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Edit ingredients, lot numbers, and output for each batch individually.
              </p>
              {batchDrafts.map((draft, bIdx) => {
                const isOpen = expandedBatch === bIdx;
                const draftCost = draft.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                return (
                  <div key={bIdx} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 bg-accent/20 hover:bg-accent/40 transition-colors text-left"
                      onClick={() => setExpandedBatch(isOpen ? null : bIdx)}
                    >
                      <span className="font-medium text-sm">Batch #{bIdx + 1}</span>
                      <span className="text-xs text-muted-foreground">{draft.lot} · {draft.ingredients.length} materials · €{draftCost.toFixed(2)}</span>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-3 space-y-3 border-t">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Lot Number</Label>
                            <Input className="h-8 text-sm" value={draft.lot} onChange={e => updateDraft(bIdx, { lot: e.target.value })} placeholder="e.g. LOT-001" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Output Qty ({selectedRecipe?.pieceWeight})</Label>
                            <Input type="number" className="h-8 text-sm" value={draft.outputQty || ''} onChange={e => updateDraft(bIdx, { outputQty: Number(e.target.value) })} />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ingredients</p>
                          {draft.ingredients.map((ing, iIdx) => (
                            <div key={iIdx} className="grid grid-cols-[1fr_90px_32px] gap-1.5 items-center">
                              {ing.materialId ? (
                                <span className="text-sm truncate">{ing.materialName}</span>
                              ) : (
                                <Select value={ing.materialId} onValueChange={v => setDraftIngredientMaterial(bIdx, iIdx, v)}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select material" /></SelectTrigger>
                                  <SelectContent>
                                    {inventory.map(m => (
                                      <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.unit})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  value={ing.quantity || ''}
                                  onChange={e => updateIngredient(bIdx, iIdx, { quantity: Number(e.target.value) })}
                                />
                                <span className="text-xs text-muted-foreground w-8 shrink-0">{ing.unit}</span>
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeIngredient(bIdx, iIdx)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => addIngredient(bIdx)}>
                            <Plus className="h-3 w-3 mr-1" /> Add ingredient
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Note (optional)</Label>
                          <Input className="h-8 text-sm" value={draft.note} onChange={e => updateDraft(bIdx, { note: e.target.value })} placeholder="Production notes..." />
                        </div>

                        <p className="text-xs text-right text-muted-foreground">
                          Batch cost: <span className="font-semibold text-foreground">€{draftCost.toFixed(2)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-sm text-right text-muted-foreground pt-1">
                Total estimated cost:{' '}
                <span className="font-semibold text-foreground">
                  €{batchDrafts.reduce((sum, d) => sum + d.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 0).toFixed(2)}
                </span>
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {createStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button disabled={!recipeId} onClick={handleNextStep}>Next →</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateStep(1)}>← Back</Button>
                <Button onClick={handleSave}>
                  Create {batchDrafts.length} Batch{batchDrafts.length !== 1 ? 'es' : ''}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={formOpen && !!editingBatch} onOpenChange={open => { if (!open) setFormOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Recipe</Label>
              <Select value={recipeId} onValueChange={setRecipeId}>
                <SelectTrigger><SelectValue placeholder="Select recipe" /></SelectTrigger>
                <SelectContent>
                  {recipes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as BatchStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOrder.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Output Qty</Label>
                <Input type="number" value={outputQty} onChange={e => setOutputQty(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print report dialog */}
      <Dialog open={!!printableData} onOpenChange={() => setPrintableData(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {printableData && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  Batch Production Report — {printableData.recipe.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5" id="printable-batch">
                {/* Report header */}
                <div className="flex justify-between text-sm border-b pb-3">
                  <div>
                    <p className="font-semibold">{printableData.recipe.name}</p>
                    <p className="text-muted-foreground">Piece weight: {printableData.recipe.pieceWeight}</p>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <p>Date: {new Date().toISOString().split('T')[0]}</p>
                    <p>Operator: {user?.name}</p>
                    <p>{printableData.batches.length} batch{printableData.batches.length !== 1 ? 'es' : ''}</p>
                  </div>
                </div>

                {/* Per-batch sections */}
                {printableData.batches.map((b, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-semibold">Batch #{b.batchNum}</h4>
                      <span className="text-sm text-muted-foreground">Lot: <span className="font-mono font-medium text-foreground">{b.lot}</span> · Output: {b.outputQty} {printableData.recipe.pieceWeight}</span>
                    </div>
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
                        {b.ingredients.map((ing, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{ing.materialName}</TableCell>
                            <TableCell className="text-right">{ing.quantity}</TableCell>
                            <TableCell>{ing.unit}</TableCell>
                            <TableCell className="text-right">€{ing.unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">€{(ing.quantity * ing.unitPrice).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={4} className="font-semibold text-right">Batch Total</TableCell>
                          <TableCell className="text-right font-bold">
                            €{b.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}

                {/* Grand total */}
                <div className="border-t pt-3 flex justify-between items-center font-semibold">
                  <span>Grand Total ({printableData.batches.length} batches)</span>
                  <span className="text-lg">
                    €{printableData.batches.reduce((sum, b) => sum + b.ingredients.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 0).toFixed(2)}
                  </span>
                </div>

                {/* Recipe steps */}
                {printableData.recipe.steps.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="font-display font-semibold text-sm mb-2">Production Steps</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      {printableData.recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                )}

                {/* Signature lines */}
                <div className="grid grid-cols-2 gap-8 text-sm border-t pt-4">
                  <div>
                    <p className="text-muted-foreground mb-8">Operator Signature:</p>
                    <div className="border-b border-foreground"></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-8">Supervisor Signature:</p>
                    <div className="border-b border-foreground"></div>
                  </div>
                </div>
              </div>

              <DialogFooter className="print:hidden">
                <Button variant="outline" onClick={() => setPrintableData(null)}>Close</Button>
                <Button onClick={handlePrintBatchTable}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
