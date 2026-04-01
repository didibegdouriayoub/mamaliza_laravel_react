import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Factory, Plus, Edit, Trash2, Printer, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BatchStatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/DataStates';
import { batchService } from '@/services/batchService';
import { Batch, BatchStatus, Recipe } from '@/models/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { recipeService } from '@/services/recipeService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const statusOrder: BatchStatus[] = ['draft', 'in_production', 'completed', 'failed'];
const statusLabels: Record<BatchStatus, string> = {
  draft: '📝 Draft', in_production: '🔥 In Production', completed: '✅ Completed', failed: '❌ Failed',
};

export default function Batches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [formOpen, setFormOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [recipeId, setRecipeId] = useState('');
  const [batchCount, setBatchCount] = useState(1);
  const [status, setStatus] = useState<BatchStatus>('draft');
  const [outputQty, setOutputQty] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [printableData, setPrintableData] = useState<{ recipe: Recipe; count: number } | null>(null);
  const [search, setSearch] = useState('');
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchData, recipeData] = await Promise.all([
        batchService.getAll(),
        recipeService.getAll()
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
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingBatch(null); setRecipeId(''); setBatchCount(1); setStatus('draft'); setOutputQty(0); setNoteText('');
    setFormOpen(true);
  };

  const openEdit = (b: Batch) => {
    setEditingBatch(b); setRecipeId(b.recipeId); setBatchCount(1); setStatus(b.status); setOutputQty(b.outputQuantity); setNoteText('');
    setFormOpen(true); setSelected(null);
  };

  const selectedRecipe = recipes.find(r => String(r.id) === String(recipeId));

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
      } else {
        // Create multiple batches
        for (let i = 0; i < batchCount; i++) {
          const created = await batchService.create({
            recipeId, recipeName: recipe.name, status,
            inputMaterials: recipe.ingredients,
            outputQuantity: outputQty || recipe.targetWeight, outputUnit: recipe.pieceWeight,
            operatorId: user?.id, operatorName: user?.name,
          });
          // T12.14: add note to first batch after creation
          if (noteText.trim() && i === 0 && created?.id) {
            await batchService.addNote(created.id, { text: noteText, author: user?.name || 'Unknown' });
          }
        }
        toast({ title: `${batchCount} batch${batchCount > 1 ? 'es' : ''} created` });
        setPrintableData({ recipe, count: batchCount });
      }
      setFormOpen(false);
      loadData();
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

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingBatch ? 'Edit Batch' : 'New Batch'}</DialogTitle>
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
            {!editingBatch && (
              <div className="space-y-1.5">
                <Label>Number of Batches</Label>
                <Input type="number" min={1} value={batchCount} onChange={e => setBatchCount(Math.max(1, Number(e.target.value)))} />
              </div>
            )}
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
                <Input type="number" value={outputQty} onChange={e => setOutputQty(Number(e.target.value))} placeholder={selectedRecipe ? String(selectedRecipe.targetWeight) : ''} />
              </div>
            </div>

            {/* Preview materials table */}
            {selectedRecipe && !editingBatch && batchCount > 0 && (
              <div className="border rounded-lg p-3 space-y-2 bg-accent/30">
                <p className="text-sm font-semibold">Preview: {batchCount} × {selectedRecipe.name}</p>
                <p className="text-xs text-muted-foreground">Total yield: {selectedRecipe.targetWeight * batchCount} {selectedRecipe.pieceWeight}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-xs text-right">Per Batch</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{ing.materialName}</TableCell>
                        <TableCell className="text-xs text-right">{ing.quantity} {ing.unit}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{(ing.quantity * batchCount).toFixed(1)} {ing.unit}</TableCell>
                        <TableCell className="text-xs text-right">€{(ing.quantity * batchCount * ing.unitPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-xs font-semibold">Total Cost</TableCell>
                      <TableCell className="text-xs text-right font-bold">
                        €{selectedRecipe.ingredients.reduce((s, i) => s + i.quantity * batchCount * i.unitPrice, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingBatch ? 'Update' : `Create ${batchCount > 1 ? `${batchCount} Batches` : 'Batch'}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable batch table dialog */}
      <Dialog open={!!printableData} onOpenChange={() => setPrintableData(null)}>
        <DialogContent className="max-w-2xl">
          {printableData && (
            <>
              <DialogHeader className="print:block">
                <DialogTitle className="font-display text-xl">
                  Batch Production Sheet — {printableData.recipe.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 print:block" id="printable-batch">
                <div className="flex justify-between text-sm">
                  <span>Date: {new Date().toISOString().split('T')[0]}</span>
                  <span>Batches: {printableData.count}</span>
                  <span>Total Yield: {printableData.recipe.targetWeight * printableData.count} {printableData.recipe.pieceWeight}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Per Batch</TableHead>
                      <TableHead className="text-right">Total Needed</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printableData.recipe.ingredients.map((ing, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{ing.materialName}</TableCell>
                        <TableCell className="text-right">{ing.quantity}</TableCell>
                        <TableCell className="text-right font-semibold">{(ing.quantity * printableData.count).toFixed(1)}</TableCell>
                        <TableCell>{ing.unit}</TableCell>
                        <TableCell className="text-right">€{ing.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">€{(ing.quantity * printableData.count * ing.unitPrice).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell colSpan={5}>TOTAL</TableCell>
                      <TableCell className="text-right">
                        €{printableData.recipe.ingredients.reduce((s, i) => s + i.quantity * printableData.count * i.unitPrice, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div>
                  <h4 className="font-display font-semibold text-sm mb-2">Production Steps</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    {printableData.recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>

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
