import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Box, Plus, Trash2, Edit, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { packagingMaterialService } from '@/services/packagingMaterialService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, PackagingMaterialType, PackagingStockUnit } from '@/models/types';

const TYPES: PackagingMaterialType[] = ['Box', 'Case', 'Vacbag', 'Label', 'Ticket', 'Wrap', 'Wax'];
const UNITS: PackagingStockUnit[] = ['pcs', 'kg', 'rolls'];

const emptyForm = () => ({
  name: '', code: '', type: 'Box' as PackagingMaterialType,
  stockQty: 0, stockUnit: 'pcs' as PackagingStockUnit,
  lowStockAlert: '' as string | number,
  accountCode: '' as string | number,
  dimLength: '' as string | number,
  dimWidth: '' as string | number,
  dimHeight: '' as string | number,
  notes: '',
});

export default function PackagingMaterials() {
  const [materials, setMaterials] = useState<PackagingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PackagingMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission('inventory.write');

  const load = async (type?: string) => {
    setLoading(true);
    try {
      const data = await packagingMaterialService.getAll(type && type !== 'all' ? type : undefined);
      setMaterials(data || []);
    } catch {
      toast({ title: 'Failed to load packaging materials', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(typeFilter); }, [typeFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (m: PackagingMaterial) => {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code,
      type: m.type,
      stockQty: m.stockQty,
      stockUnit: m.stockUnit,
      lowStockAlert: m.lowStockAlert ?? '',
      accountCode: m.accountCode ?? '',
      dimLength: m.dimLength ?? '',
      dimWidth: m.dimWidth ?? '',
      dimHeight: m.dimHeight ?? '',
      notes: m.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Name and Code are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<PackagingMaterial> = {
        name: form.name,
        code: form.code,
        type: form.type,
        stockQty: Number(form.stockQty),
        stockUnit: form.stockUnit,
        lowStockAlert: form.lowStockAlert !== '' ? Number(form.lowStockAlert) : null,
        accountCode: form.accountCode !== '' ? Number(form.accountCode) : null,
        dimLength: form.dimLength !== '' ? Number(form.dimLength) : null,
        dimWidth: form.dimWidth !== '' ? Number(form.dimWidth) : null,
        dimHeight: form.dimHeight !== '' ? Number(form.dimHeight) : null,
        notes: form.notes || null,
      };
      if (editing) {
        await packagingMaterialService.update(editing.id, payload);
        toast({ title: 'Material updated' });
      } else {
        await packagingMaterialService.create(payload);
        toast({ title: 'Material created' });
      }
      setDialogOpen(false);
      load(typeFilter);
    } catch (e: any) {
      toast({ title: e.message || 'Save failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string | number) => {
    try {
      await packagingMaterialService.delete(id);
      toast({ title: 'Material deleted' });
      load(typeFilter);
    } catch (e: any) {
      toast({ title: e.message || 'Delete failed', variant: 'destructive' });
    }
  };

  const isLow = (m: PackagingMaterial) =>
    m.lowStockAlert != null && m.stockQty <= m.lowStockAlert;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Box className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Packaging Materials</h1>
            <p className="text-sm text-muted-foreground">Stock levels for all packaging items</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canWrite && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Material
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : materials.length === 0 ? (
            <EmptyState message="No packaging materials found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Stock Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Low Alert</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map(m => (
                  <TableRow key={m.id} className={isLow(m) ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                    <TableCell className="font-medium">
                      {m.name}
                      {isLow(m) && (
                        <span className="ml-2 text-xs text-red-600 font-semibold">LOW</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.code}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                        {m.type}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${isLow(m) ? 'text-red-600' : ''}`}>
                      {Number(m.stockQty).toLocaleString()}
                    </TableCell>
                    <TableCell>{m.stockUnit}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {m.lowStockAlert != null ? Number(m.lowStockAlert).toLocaleString() : '—'}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete material?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete <strong>{m.name}</strong>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(m.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Material' : 'Add Material'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Code *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as PackagingMaterialType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Stock Unit *</Label>
                <Select value={form.stockUnit} onValueChange={v => setForm(f => ({ ...f, stockUnit: v as PackagingStockUnit }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Stock Qty *</Label>
                <Input type="number" min={0} value={form.stockQty}
                  onChange={e => setForm(f => ({ ...f, stockQty: e.target.value as any }))} />
              </div>
              <div className="space-y-1">
                <Label>Low Stock Alert</Label>
                <Input type="number" min={0} placeholder="optional"
                  value={form.lowStockAlert}
                  onChange={e => setForm(f => ({ ...f, lowStockAlert: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Account Code</Label>
              <Input type="number" placeholder="optional" value={form.accountCode}
                onChange={e => setForm(f => ({ ...f, accountCode: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Dimensions (L × W × H, cm)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" min={0} placeholder="Length"
                  value={form.dimLength}
                  onChange={e => setForm(f => ({ ...f, dimLength: e.target.value }))} />
                <Input type="number" min={0} placeholder="Width"
                  value={form.dimWidth}
                  onChange={e => setForm(f => ({ ...f, dimWidth: e.target.value }))} />
                <Input type="number" min={0} placeholder="Height"
                  value={form.dimHeight}
                  onChange={e => setForm(f => ({ ...f, dimHeight: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
