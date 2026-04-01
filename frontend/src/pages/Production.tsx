import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { productionLogService } from '@/services/productionLogService';
import { batchService } from '@/services/batchService';
import { Batch } from '@/models/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/DataStates';

export default function Production() {
  const [logs, setLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [producedPieces, setProducedPieces] = useState(0);
  const [notes, setNotes] = useState('');
  const [leftovers, setLeftovers] = useState<{ materialName: string; quantity: number; unit: string }[]>([{ materialName: '', quantity: 0, unit: '' }]);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [logData, batchData] = await Promise.all([
        productionLogService.getAll(),
        batchService.getAll()
      ]);
      setLogs(logData || []);
      setBatches(batchData || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const completedBatches = batches.filter(b => b.status === 'completed' || b.status === 'in_production');

  const addLeftover = () => setLeftovers(prev => [...prev, { materialName: '', quantity: 0, unit: '' }]);

  const handleSave = async () => {
    const batch = batches.find(b => String(b.id) === String(batchId));
    if (!batch) return;
    try {
      await productionLogService.create({
        batch_id: batchId,
        recipe_name: batch.recipeName,
        operator_id: user?.id,
        operator_name: user?.name,
        produced_pieces: producedPieces,
        unit: batch.outputUnit,
        leftovers: leftovers.filter(l => l.materialName.trim()),
        notes: notes,
        logged_at: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'Production log saved' });
      setFormOpen(false);
      setBatchId(''); setProducedPieces(0); setNotes('');
      setLeftovers([{ materialName: '', quantity: 0, unit: '' }]);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save production log', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Production Log</h1>
          <p className="text-sm text-muted-foreground">Track produced pieces and leftovers per batch</p>
        </div>
        <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log Production</Button>
      </div>

      {loading ? (
        <Card className="shadow-card"><CardContent className="p-4"><TableSkeleton /></CardContent></Card>
      ) : logs.length === 0 ? (
        <Card className="shadow-card"><CardContent className="p-8 text-center text-muted-foreground">No production logs yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {logs.map((log, idx) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-display">{log.recipe_name || log.recipeName}</CardTitle>
                    <Badge variant="secondary">{log.logged_at || log.loggedAt}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Operator</span>
                    <span className="font-medium">{log.operator_name || log.operatorName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Produced</span>
                    <span className="font-semibold text-primary">{log.produced_pieces || log.producedPieces} {log.unit}</span>
                  </div>
                  {(log.leftovers && log.leftovers.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Leftovers (can be reused)</p>
                      {log.leftovers.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm py-0.5">
                          <span>{l.item}</span>
                          <span className="text-muted-foreground">{l.amount} {l.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {log.notes && <p className="text-sm text-muted-foreground italic border-t pt-2">{log.notes}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Log Production</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {completedBatches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.recipeName} ({b.startedAt})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produced Pieces</Label>
              <Input type="number" value={producedPieces} onChange={e => setProducedPieces(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Leftovers / Extra Ingredients</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addLeftover}><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {leftovers.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_60px_32px] gap-2 items-end">
                  <Input placeholder="Material name" value={l.materialName} onChange={e => setLeftovers(prev => prev.map((x, i) => i === idx ? { ...x, materialName: e.target.value } : x))} />
                  <Input type="number" placeholder="Qty" value={l.quantity || ''} onChange={e => setLeftovers(prev => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <Input placeholder="Unit" value={l.unit} onChange={e => setLeftovers(prev => prev.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setLeftovers(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
