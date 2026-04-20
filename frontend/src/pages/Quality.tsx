import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Star, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { qualityService } from '@/services/qualityService';
import { batchService } from '@/services/batchService';
import { QualityControl, Batch } from '@/models/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/DataStates';
import { formatDate } from '@/lib/formatDate';

function StarRating({ score, max = 5, interactive, onChange }: { score: number; max?: number; interactive?: boolean; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-5 w-5 ${i < Math.round(score) ? 'fill-warning text-warning' : 'text-muted'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          onClick={() => interactive && onChange?.(i + 1)}
        />
      ))}
    </div>
  );
}

export default function Quality() {
  const [controls, setControls] = useState<QualityControl[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [taste, setTaste] = useState(3);
  const [texture, setTexture] = useState(3);
  const [smell, setSmell] = useState(3);
  const [notes, setNotes] = useState('');
  const [approved, setApproved] = useState(true);
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [qcData, batchData] = await Promise.all([
        qualityService.getAll(),
        batchService.getAll().catch(() => []),
      ]);
      setControls(qcData || []);
      setBatches(batchData || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const overallScore = Number(((taste + texture + smell) / 3).toFixed(1));

  const handleCreate = async () => {
    if (!batchId) return;
    try {
      await qualityService.create({
        batchId, taste, texture, smell, overallScore, approved,
        evaluatedBy: user.id, evaluator: user.name, notes,
      });
      toast({ title: approved ? 'Batch approved' : 'Batch rejected' });
      setFormOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to save evaluation', variant: 'destructive' });
    }
  };

  // Batches without existing QC
  const availableBatches = batches.filter(b => !controls.some(qc => String(qc.batchId) === String(b.id)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Quality Control</h1>
          <p className="text-sm text-muted-foreground">Evaluate and approve production batches</p>
        </div>
        {hasPermission('quality.write') && (
          <Button onClick={() => { setFormOpen(true); setBatchId(''); setTaste(3); setTexture(3); setSmell(3); setNotes(''); setApproved(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Evaluation
          </Button>
        )}
      </div>

      {loading && <div className="shadow-card rounded-lg border p-4"><TableSkeleton /></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(!loading ? controls : []).map((qc, idx) => {
          const batch = batches.find(b => String(b.id) === String(qc.batchId));
          return (
            <motion.div key={qc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-display">{batch?.recipeName || 'Unknown'}</CardTitle>
                    <Badge className={qc.approved ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                      {qc.approved ? 'Approved' : 'Rejected'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center"><p className="text-xs text-muted-foreground mb-1">Taste</p><StarRating score={qc.taste} /></div>
                    <div className="text-center"><p className="text-xs text-muted-foreground mb-1">Texture</p><StarRating score={qc.texture} /></div>
                    <div className="text-center"><p className="text-xs text-muted-foreground mb-1">Smell</p><StarRating score={qc.smell} /></div>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Overall: <span className="font-semibold text-foreground">⭐ {qc.overallScore}/5</span></span>
                    <span className="text-xs text-muted-foreground">{formatDate(qc.evaluatedAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">{qc.notes}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">New Quality Evaluation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {availableBatches.map(b => <SelectItem key={b.id} value={b.id}>{b.recipeName}{b.lot ? ` — ${b.lot}` : ''} ({formatDate(b.startedAt)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 text-center">
                <Label>Taste</Label>
                <StarRating score={taste} interactive onChange={setTaste} />
              </div>
              <div className="space-y-1.5 text-center">
                <Label>Texture</Label>
                <StarRating score={texture} interactive onChange={setTexture} />
              </div>
              <div className="space-y-1.5 text-center">
                <Label>Smell</Label>
                <StarRating score={smell} interactive onChange={setSmell} />
              </div>
            </div>
            <p className="text-sm text-center">Overall: <span className="font-bold">⭐ {overallScore}/5</span></p>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-4">
              <Button variant={approved ? 'default' : 'outline'} className={approved ? 'bg-success hover:bg-success/90' : ''} onClick={() => setApproved(true)}>Approve</Button>
              <Button variant={!approved ? 'default' : 'outline'} className={!approved ? 'bg-destructive hover:bg-destructive/90' : ''} onClick={() => setApproved(false)}>Reject</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Submit Evaluation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
