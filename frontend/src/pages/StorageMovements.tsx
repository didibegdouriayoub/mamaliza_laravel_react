import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { storageMovementService, type StorageMovement, type MovementReason } from '@/services/storageMovementService';
import { storageLocationService, type StorageLocation } from '@/services/storageLocationService';
import { inventoryService } from '@/services/inventoryService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';
import type { InventoryItem } from '@/models/types';

const REASONS: MovementReason[] = ['Packaging', 'Production', 'QC', 'Return'];

const reasonBadge: Record<MovementReason, string> = {
  Packaging:  'bg-blue-100 text-blue-800',
  Production: 'bg-green-100 text-green-800',
  QC:         'bg-purple-100 text-purple-800',
  Return:     'bg-amber-100 text-amber-800',
};

const emptyForm = (operatorId: number) => ({
  productId: '' as string | number,
  fromLocationId: 'none',
  toLocationId: 'none',
  quantity: '',
  reason: 'Production' as MovementReason,
  operatorId,
});

export default function StorageMovements() {
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();
  const [movements, setMovements] = useState<StorageMovement[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(Number(user?.id ?? 1)));
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission('storage.write');

  const load = async () => {
    setLoading(true);
    try {
      const [m, loc, inv] = await Promise.all([
        storageMovementService.getAll(),
        storageLocationService.getAll(),
        inventoryService.getAll(),
      ]);
      setMovements(m);
      setLocations(loc);
      setProducts((inv || []).filter((i: InventoryItem) => i.type === 'product'));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm(Number(user?.id ?? 1)));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.quantity) return;
    setSaving(true);
    try {
      await storageMovementService.create({
        productId: Number(form.productId),
        fromLocationId: form.fromLocationId === 'none' ? null : Number(form.fromLocationId),
        toLocationId: form.toLocationId === 'none' ? null : Number(form.toLocationId),
        quantity: Number(form.quantity),
        reason: form.reason,
        operatorId: form.operatorId,
      });
      toast({ title: 'Movement recorded' });
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!hasPermission('storage.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don't have permission to view storage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" /> Storage Movements
          </h1>
          <p className="text-sm text-muted-foreground">Log every product move between storage locations</p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Record Movement</Button>
        )}
      </div>

      {loading ? <TableSkeleton /> : movements.length === 0 ? (
        <EmptyState title="No movements" description="Record the first storage movement." icon="🔄" />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="hidden sm:table-cell">Operator</TableHead>
                <TableHead className="hidden md:table-cell text-right pr-4">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((mv, idx) => (
                <motion.tr
                  key={mv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b last:border-0"
                >
                  <TableCell className="pl-4 font-medium">{mv.productName ?? `#${mv.productId}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{mv.fromLocation?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{mv.toLocation?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{mv.quantity}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${reasonBadge[mv.reason]}`}>
                      {mv.reason}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{mv.operatorName ?? `#${mv.operatorId}`}</TableCell>
                  <TableCell className="hidden md:table-cell text-right pr-4 text-sm text-muted-foreground">
                    {formatDate(mv.createdAt)}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Record Movement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={String(form.productId)} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From Location</Label>
                <Select value={form.fromLocationId} onValueChange={v => setForm(f => ({ ...f, fromLocationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To Location</Label>
                <Select value={form.toLocationId} onValueChange={v => setForm(f => ({ ...f, toLocationId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min={0.001} step="0.001" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v as MovementReason }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.productId || !form.quantity}>
              {saving ? 'Saving…' : 'Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
