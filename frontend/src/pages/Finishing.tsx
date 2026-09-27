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
import { finishedProductService, FinishedProduct } from '@/services/finishedProductService';
import { finishingLogService, FinishingLog, FinishingLogBatchSource } from '@/services/finishingLogService';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';

interface BatchGroupOption {
  id: number;
  recipeName: string;
  outputQuantity: number;
  createdAt: string;
}

export default function Finishing() {
  const { toast } = useToast();
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [logs, setLogs] = useState<FinishingLog[]>([]);
  const [batchGroups, setBatchGroups] = useState<BatchGroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [piecesProduced, setPiecesProduced] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [batchSources, setBatchSources] = useState<FinishingLogBatchSource[]>([{ batch_group_id: '', kg_used: 0 }]);
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => String(p.id) === selectedProductId);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, logData, bgData] = await Promise.all([
        finishedProductService.getAll(),
        finishingLogService.getAll(),
        apiClient.get<any[]>('/batch-groups').catch(() => []),
      ]);
      setProducts(prods || []);
      setLogs(logData || []);
      setBatchGroups((bgData || []).map((bg: any) => ({
        id: bg.id,
        recipeName: bg.recipeName ?? bg.recipe?.name ?? '—',
        outputQuantity: bg.outputQuantity ?? 0,
        createdAt: bg.createdAt,
      })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!selectedProductId) { toast({ title: 'Select a product', variant: 'destructive' }); return; }
    if (!piecesProduced || parseInt(piecesProduced) < 1) { toast({ title: 'Enter pieces produced', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await finishingLogService.create({
        finished_product_id: parseInt(selectedProductId),
        pieces_produced: parseInt(piecesProduced),
        date,
        notes: notes.trim() || undefined,
        batch_sources: batchSources.filter(s => s.batch_group_id && s.kg_used > 0),
      });
      toast({ title: `${piecesProduced} pieces of "${selectedProduct?.name}" produced` });
      setSelectedProductId(''); setPiecesProduced(''); setNotes('');
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
    ? selectedProduct.materials.map(m => ({
        name: m.inventory_item?.name ?? '—',
        total: (m.qty_per_piece * (parseInt(piecesProduced) || 0)).toFixed(3),
        unit: m.inventory_item?.unit ?? '',
      }))
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
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
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
              <Label>Pieces Produced</Label>
              <Input type="number" min="1" value={piecesProduced} onChange={e => setPiecesProduced(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Batch sources */}
          <div className="space-y-2">
            <Label>Batch Sources (optional — which pâte batches used)</Label>
            {batchSources.map((src, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={String(src.batch_group_id)} onValueChange={v => setBatchSources(prev => prev.map((x, j) => j === i ? { ...x, batch_group_id: v } : x))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select batch group" /></SelectTrigger>
                  <SelectContent>
                    {batchGroups.map(bg => (
                      <SelectItem key={bg.id} value={String(bg.id)}>
                        {bg.recipeName} — {formatDate(bg.createdAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min="0" step="0.001" className="w-28" placeholder="kg used" value={src.kg_used || ''} onChange={e => setBatchSources(prev => prev.map((x, j) => j === i ? { ...x, kg_used: parseFloat(e.target.value) || 0 } : x))} />
                <Button size="icon" variant="ghost" onClick={() => setBatchSources(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setBatchSources(prev => [...prev, { batch_group_id: '', kg_used: 0 }])}>
              <Plus className="h-3 w-3 mr-1" />Add batch source
            </Button>
          </div>

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
                    <TableCell className="font-medium">{log.product?.name ?? '—'}</TableCell>
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
