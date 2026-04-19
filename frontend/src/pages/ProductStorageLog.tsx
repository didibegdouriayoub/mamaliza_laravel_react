import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Warehouse, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { productStorageLogService, type ProductStorageLog as PSL } from '@/services/productStorageLogService';
import { storageLocationService, type StorageLocation } from '@/services/storageLocationService';
import { inventoryService } from '@/services/inventoryService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem } from '@/models/types';

type LogStatus = 'In Storage' | 'In Use' | 'Out';

const statusBadge: Record<LogStatus, string> = {
  'In Storage': 'bg-green-100 text-green-800',
  'In Use':     'bg-amber-100 text-amber-800',
  'Out':        'bg-gray-100 text-gray-600',
};

const emptyForm = () => ({
  productId: '' as string | number,
  batchId: '',
  locationId: '' as string | number,
  quantity: '',
  entryDate: new Date().toISOString().slice(0, 10),
  status: 'In Storage' as LogStatus,
});

export default function ProductStorageLog() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<PSL[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PSL | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission('storage.write');

  const load = async () => {
    setLoading(true);
    try {
      const [l, loc, inv] = await Promise.all([
        productStorageLogService.getAll(),
        storageLocationService.getAll(),
        inventoryService.getAll(),
      ]);
      setLogs(l);
      setLocations(loc);
      setProducts((inv || []).filter((i: InventoryItem) => i.type === 'product'));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (l: PSL) => {
    setEditing(l);
    setForm({
      productId: l.productId,
      batchId: l.batchId ? String(l.batchId) : '',
      locationId: l.locationId,
      quantity: String(l.quantity),
      entryDate: l.entryDate,
      status: l.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.productId || !form.locationId || !form.quantity) return;
    setSaving(true);
    try {
      const payload = {
        productId: Number(form.productId),
        batchId: form.batchId ? Number(form.batchId) : null,
        locationId: Number(form.locationId),
        quantity: Number(form.quantity),
        entryDate: form.entryDate,
        status: form.status,
      };
      if (editing) {
        await productStorageLogService.update(editing.id, payload);
        toast({ title: 'Entry updated' });
      } else {
        await productStorageLogService.create(payload);
        toast({ title: 'Entry added' });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await productStorageLogService.delete(id);
      toast({ title: 'Entry removed', variant: 'destructive' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
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
            <Warehouse className="h-6 w-6" /> Product Storage Log
          </h1>
          <p className="text-sm text-muted-foreground">Track current stock at each storage location</p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Entry</Button>
        )}
      </div>

      {loading ? <TableSkeleton /> : logs.length === 0 ? (
        <EmptyState title="No entries" description="Add the first storage entry." icon="📦" />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="hidden sm:table-cell">Entry Date</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="text-right pr-4">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, idx) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="border-b last:border-0"
                >
                  <TableCell className="pl-4 font-medium">{log.productName ?? `#${log.productId}`}</TableCell>
                  <TableCell className="text-sm">{log.location?.name ?? `#${log.locationId}`}</TableCell>
                  <TableCell className="text-sm">{log.quantity}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{log.entryDate}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[log.status]}`}>
                      {log.status}
                    </span>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(log)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this entry?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(log.id)}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'Edit Entry' : 'Add Storage Entry'}</DialogTitle>
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
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={String(form.locationId)} onValueChange={v => setForm(f => ({ ...f, locationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select location…" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min={0} step="0.001" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Entry Date</Label>
                <Input type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as LogStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Storage">In Storage</SelectItem>
                  <SelectItem value="In Use">In Use</SelectItem>
                  <SelectItem value="Out">Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Batch ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="number" value={form.batchId} onChange={e => setForm(f => ({ ...f, batchId: e.target.value }))} placeholder="Leave blank if not applicable" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.productId || !form.locationId || !form.quantity}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
