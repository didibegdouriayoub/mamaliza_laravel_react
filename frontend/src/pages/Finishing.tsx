import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Factory, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { finishedProductService, FinishedProduct, fridgeTotal } from '@/services/finishedProductService';
import { finishingLogService, FinishingLog, FinishingLogBatchSource } from '@/services/finishingLogService';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';
import { splitKg } from '@/lib/doughSplit';
import { defaultLotLetters, isValidLotCode, suggestLotCode } from '@/lib/lotCode';

interface BatchGroupOption {
  id: number;
  recipeId: string;
  recipeName: string;
  outputQuantity: number;
  batchCount: number;
  targetWeight: number;
  createdAt: string;
  usedKg: number;
  closed: boolean;
  date: string; // production date of the group (YYYY-MM-DD)
}

export default function Finishing() {
  const { toast } = useToast();
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [logs, setLogs] = useState<FinishingLog[]>([]);
  const [batchGroups, setBatchGroups] = useState<BatchGroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [piecesProduced, setPiecesProduced] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [batchSources, setBatchSources] = useState<FinishingLogBatchSource[]>([{ batch_group_id: '', kg_used: 0 }]);
  const [saving, setSaving] = useState(false);
  const [lotCode, setLotCode] = useState('');
  const [lotEdited, setLotEdited] = useState(false); // false: the code follows the suggestion
  const [cartonsOverride, setCartonsOverride] = useState<string | null>(null); // null = pack the maximum

  const selectedProduct = products.find(p => String(p.id) === selectedProductId);

  // A piece product is packed into its carton automatically (only for a carton that holds this product alone)
  const boxProduct = selectedProduct?.type === 'piece' && selectedProduct.carton
    ? products.find(b => b.id === selectedProduct.carton!.box_id)
    : undefined;
  const autoPack = boxProduct && boxProduct.components.length === 1 ? selectedProduct!.carton! : null;
  const pieceCount = parseInt(piecesProduced) || 0;
  const maxCartons = autoPack ? Math.floor(pieceCount / autoPack.qty_per_box) : 0;
  const cartonsToPack = autoPack
    ? Math.max(0, Math.min(maxCartons, cartonsOverride !== null ? parseInt(cartonsOverride) || 0 : maxCartons))
    : 0;

  // Dough batches offered as sources: only those made from the product's recipes (all when it has none)
  const productRecipeIds = new Set((selectedProduct?.inputs ?? []).map(i => String(i.recipe_id)));
  const sourceOptions = (productRecipeIds.size
    ? batchGroups.filter(bg => productRecipeIds.has(bg.recipeId))
    : batchGroups).filter(bg => !bg.closed);

  const leftKg = (bg: BatchGroupOption) => bg.targetWeight * bg.batchCount - bg.usedKg;
  const chosenIds = batchSources.map(s => s.batch_group_id).filter(Boolean).map(String);
  const chosenKey = chosenIds.join(',');

  // kg of dough per piece, from the recipe of the first chosen batch group (else the product's first rate)
  const kgPerPiece = (() => {
    const inputs = selectedProduct?.inputs ?? [];
    const first = batchGroups.find(bg => String(bg.id) === chosenIds[0]);
    const match = first ? inputs.find(i => String(i.recipe_id) === first.recipeId) : undefined;
    return (match ?? inputs.find(i => i.kg_per_piece > 0))?.kg_per_piece ?? 0;
  })();
  const neededKg = Math.round(pieceCount * kgPerPiece * 1000) / 1000;
  const assignedKg = batchSources.reduce((s, x) => s + (x.batch_group_id ? x.kg_used : 0), 0);

  // Suggested lot code: one source batch group -> that group's date, several -> today
  const suggestedLot = (() => {
    if (!selectedProduct || selectedProduct.type !== 'piece') return '';
    const today = new Date().toLocaleDateString('sv');
    const single = chosenIds.length === 1 ? batchGroups.find(bg => String(bg.id) === chosenIds[0]) : undefined;
    const day = single?.date || today;
    return suggestLotCode(selectedProduct.lot_prefix || 'TA', day, selectedProduct.lot_letters || defaultLotLetters(selectedProduct.name));
  })();
  useEffect(() => {
    if (!lotEdited) setLotCode(suggestedLot);
  }, [suggestedLot, lotEdited]);

  // Default split of the needed kg, oldest batch group first (still editable per row afterwards)
  useEffect(() => {
    if (!neededKg || !chosenIds.length) return;
    const ordered = chosenIds
      .map(id => batchGroups.find(bg => String(bg.id) === id))
      .filter((bg): bg is BatchGroupOption => !!bg)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map(bg => ({ id: String(bg.id), capacity: leftKg(bg) }));
    const split = splitKg(neededKg, ordered);
    setBatchSources(prev => prev.map(s => s.batch_group_id ? { ...s, kg_used: split[String(s.batch_group_id)] ?? s.kg_used } : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededKg, chosenKey, selectedProductId, batchGroups]);

  const load = async () => {
    setLoading(true);
    // Load each source independently so one failing endpoint doesn't blank the others
    const fail = (what: string) => (e: any) => {
      console.error(e);
      toast({ title: `Failed to load ${what}`, description: e?.message, variant: 'destructive' });
      return null;
    };
    const [prods, logData, bgData] = await Promise.all([
      finishedProductService.getAll().catch(fail('products')),
      finishingLogService.getAll().catch(fail('production history')),
      apiClient.get<any>('/batch-groups').catch(fail('batch groups')),
    ]);
    setProducts(prods || []);
    setLogs(logData || []);
    const bgList = Array.isArray(bgData) ? bgData : (bgData?.data ?? []);
    setBatchGroups(bgList.map((bg: any) => ({
      id: bg.id,
      recipeId: String(bg.recipeId ?? bg.recipe_id ?? bg.recipe?.id ?? ''),
      recipeName: bg.recipeName ?? bg.recipe?.name ?? bg.name ?? '—',
      outputQuantity: bg.outputQuantity ?? 0,
      batchCount: Number(bg.batchCount ?? bg.batch_count) || 0,
      targetWeight: Number(bg.targetWeight ?? bg.target_weight) || 0,
      createdAt: bg.createdAt,
      usedKg: Number(bg.usedKg ?? bg.used_kg) || 0,
      closed: !!(bg.closedAt ?? bg.closed_at),
      date: String(bg.batches?.[0]?.startedAt ?? bg.batches?.[0]?.started_at ?? bg.createdAt ?? bg.created_at ?? '').slice(0, 10),
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!selectedProductId) { toast({ title: 'Select a product', variant: 'destructive' }); return; }
    if (!piecesProduced || parseInt(piecesProduced) < 1) { toast({ title: 'Enter pieces produced', variant: 'destructive' }); return; }
    if (selectedProduct?.type === 'piece') {
      if (!batchSources.some(s => s.batch_group_id)) { toast({ title: 'Select at least one source batch group', variant: 'destructive' }); return; }
      if (!isValidLotCode(lotCode)) { toast({ title: 'Lot code is not valid', description: 'Format: 2 letters, 6 digits (YYMMDD), then the product letters.', variant: 'destructive' }); return; }
    }
    setSaving(true);
    try {
      await finishingLogService.create({
        finished_product_id: parseInt(selectedProductId),
        pieces_produced: parseInt(piecesProduced),
        cartons: autoPack ? cartonsToPack : undefined,
        date,
        notes: notes.trim() || undefined,
        lot_code: selectedProduct?.type === 'piece' ? lotCode.replace(/\s+/g, '').toUpperCase() : undefined,
        batch_sources: batchSources.filter(s => s.batch_group_id),
      });
      toast({ title: `${piecesProduced} pieces of "${selectedProduct?.name}" produced`, description: autoPack ? `${cartonsToPack} carton(s) packed, ${pieceCount - cartonsToPack * autoPack.qty_per_box} loose` : undefined });
      setCartonsOverride(null);
      setSelectedProductId(''); setPiecesProduced('1'); setNotes(''); setLotCode(''); setLotEdited(false);
      setBatchSources([{ batch_group_id: '', kg_used: 0 }]);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await finishingLogService.delete(id);
      toast({ title: 'Log deleted and stock restored' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // Preview: packaging that will be deducted
  const packagingPreview = selectedProduct && piecesProduced
    ? [
        ...selectedProduct.materials.map(m => ({
          name: m.inventory_item?.name ?? '—',
          total: (m.qty_per_piece * pieceCount).toFixed(3),
          unit: m.inventory_item?.unit ?? '',
        })),
        // packaging of the cartons that will be packed automatically
        ...(autoPack && boxProduct ? boxProduct.materials.map(m => ({
          name: `${m.inventory_item?.name ?? '—'} (cartons)`,
          total: (m.qty_per_piece * cartonsToPack).toFixed(3),
          unit: m.inventory_item?.unit ?? '',
        })) : []),
      ]
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Factory className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Finishing & Assembly</h1>
      </div>

      {/* Form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Record Finished Production</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={selectedProductId} onValueChange={v => { setSelectedProductId(v); setCartonsOverride(null); setBatchSources([{ batch_group_id: '', kg_used: 0 }]); }}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} <span className="text-muted-foreground text-xs ml-1">({p.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{selectedProduct?.type === 'box' ? 'Cartons to pack' : 'Pieces Produced'}</Label>
              <Input type="number" min="1" value={piecesProduced} onChange={e => setPiecesProduced(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {selectedProduct?.type === 'piece' && (
            <div className="space-y-1.5">
              <Label>Lot code (printed on the box)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="w-56 font-mono uppercase" value={lotCode} placeholder="TA260806KRO"
                  onChange={e => { setLotCode(e.target.value.toUpperCase()); setLotEdited(true); }} />
                {lotEdited && lotCode !== suggestedLot && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLotEdited(false)}>Use suggestion ({suggestedLot})</Button>
                )}
              </div>
              <p className={`text-xs ${lotCode && !isValidLotCode(lotCode) ? 'text-destructive' : 'text-muted-foreground'}`}>
                {lotCode && !isValidLotCode(lotCode)
                  ? 'Not a valid code: 2 letters, 6 digits (YYMMDD), then the product letters.'
                  : chosenIds.length > 1 ? 'Several source batches: suggested with today\'s date.' : 'Suggested from the source batch date; you can change it to match the label.'}
              </p>
            </div>
          )}

          {autoPack && (
            <div className="rounded-lg border bg-accent/30 p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Cartons to pack (of {autoPack.qty_per_box})</Label>
                  <Input type="number" min="0" max={maxCartons} className="w-28" value={cartonsOverride ?? String(maxCartons)} onChange={e => setCartonsOverride(e.target.value)} />
                </div>
                <p className="pb-2 font-medium">
                  → {cartonsToPack} carton{cartonsToPack === 1 ? '' : 's'} of {autoPack.qty_per_box} + {pieceCount - cartonsToPack * autoPack.qty_per_box} loose piece{pieceCount - cartonsToPack * autoPack.qty_per_box === 1 ? '' : 's'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Packed automatically with "{autoPack.box_name}". Lower the number to keep more pieces loose.</p>
            </div>
          )}

          {selectedProduct?.type === 'box' && (
            <div className="rounded-lg border bg-accent/30 p-3 text-sm space-y-1">
              <p className="font-medium">Packing uses the loose pieces in stock:</p>
              {selectedProduct.components.map((c, i) => {
                const comp = products.find(p => p.id === Number(c.component_id));
                const need = c.qty_per_box * (parseInt(piecesProduced) || 0);
                const have = comp ? fridgeTotal(comp) : 0;
                return (
                  <p key={i} className={need > have ? 'text-destructive' : ''}>
                    {need} × {c.component?.name ?? comp?.name ?? '—'} <span className="text-muted-foreground">({have} loose in stock)</span>
                    {need > have && ' — not enough'}
                  </p>
                );
              })}
              <p className="text-xs text-muted-foreground">Each carton takes the date of the oldest pieces inside it. Packaging (carton, tape) is deducted below.</p>
            </div>
          )}

          {/* Batch sources */}
          {selectedProduct?.type !== 'box' && (
          <div className="space-y-2">
            <Label>Batch Sources (optional — which pâte batches used)</Label>
            {productRecipeIds.size > 0 && <p className="text-xs text-muted-foreground">Only batches of this product's recipes are listed.</p>}
            {batchSources.map((src, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={String(src.batch_group_id)} onValueChange={v => setBatchSources(prev => prev.map((x, j) => j === i ? { ...x, batch_group_id: v } : x))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select batch group" /></SelectTrigger>
                  <SelectContent>
                    {sourceOptions.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No batches yet for this product's recipes.</p>}
                    {sourceOptions.map(bg => (
                      <SelectItem key={bg.id} value={String(bg.id)}>
                        {bg.recipeName} — {formatDate(bg.createdAt)} · {bg.batchCount} batches{bg.targetWeight ? ` · ${Math.round(leftKg(bg) * 100) / 100} kg left` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min="0" step="0.001" className="w-28" placeholder="kg used" value={src.kg_used} onChange={e => setBatchSources(prev => prev.map((x, j) => j === i ? { ...x, kg_used: parseFloat(e.target.value) || 0 } : x))} />
                <Button size="icon" variant="ghost" onClick={() => setBatchSources(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setBatchSources(prev => [...prev, { batch_group_id: '', kg_used: 0 }])}>
              <Plus className="h-3 w-3 mr-1" />Add batch source
            </Button>
            {kgPerPiece > 0 && (
              <p className="text-xs text-muted-foreground">
                {pieceCount} pcs × {kgPerPiece} kg = <span className="font-medium text-foreground">{neededKg} kg</span> needed
                {chosenIds.length > 0 && <> · assigned <span className={Math.abs(assignedKg - neededKg) > 0.001 ? 'font-medium text-destructive' : 'font-medium text-foreground'}>{Math.round(assignedKg * 1000) / 1000} kg</span></>}
                . Split oldest batch first; edit any row to change it.
              </p>
            )}
          </div>
          )}

          {/* Packaging preview */}
          {packagingPreview.length > 0 && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Packaging that will be deducted from inventory:</p>
              {packagingPreview.map((p, i) => (
                <p key={i} className="text-sm">— {p.name}: <strong>{p.total}</strong> {p.unit}</p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full md:w-auto">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Confirm Production'}
          </Button>
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Production History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <TableSkeleton cols={5} rows={4} /> : logs.length === 0 ? (
            <EmptyState title="No finishing logs yet" description="Record your first production run above." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pieces</TableHead>
                  <TableHead>Batches Used</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.date)}</TableCell>
                    <TableCell className="font-medium">
                      {log.product?.name ?? '—'}
                      {log.lot_code && <span className="block font-mono text-xs font-normal text-muted-foreground">{log.lot_code}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.product?.type ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>{log.pieces_produced}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.batch_sources?.length
                        ? log.batch_sources.map(s => `${s.batch_group?.recipe?.name ?? `#${s.batch_group_id}`} (${s.kg_used}kg)`).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>{log.operator?.name ?? '—'}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                            <AlertDialogDescription>Stock will be restored and packaging inventory reversed.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(log.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
