import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Plus, Trash2, Edit, PlusCircle, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { packagingCartonService } from '@/services/packagingCartonService';
import { inventoryService } from '@/services/inventoryService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { PackagingCarton, InventoryItem } from '@/models/types';

interface MaterialRow {
  materialId: string | number;
  amountPerCarton: number | string;
}

const emptyForm = () => ({
  name: '',
  productName: '',
  piecesPerCarton: 1 as number | string,
  materials: [] as MaterialRow[],
});

export default function PackagingCartons() {
  const [cartons, setCartons] = useState<PackagingCarton[]>([]);
  const [allMaterials, setAllMaterials] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PackagingCarton | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasPermission('inventory.write');

  const load = async () => {
    setLoading(true);
    try {
      const [cartonsData, allItems] = await Promise.all([
        packagingCartonService.getAll(),
        inventoryService.getAll(),
      ]);
      setCartons(cartonsData || []);
      setAllMaterials((allItems || []).filter((i: InventoryItem) => i.type === 'packaging'));
    } catch {
      toast({ title: 'Failed to load carton definitions', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (c: PackagingCarton) => {
    setEditing(c);
    setForm({
      name: c.name,
      productName: c.productName,
      piecesPerCarton: c.piecesPerCarton,
      materials: (c.cartonMaterials || []).map(cm => ({
        materialId: cm.materialId,
        amountPerCarton: cm.amountPerCarton,
      })),
    });
    setDialogOpen(true);
  };

  const addMaterialRow = () => {
    if (allMaterials.length === 0) return;
    setForm(f => ({
      ...f,
      materials: [...f.materials, { materialId: allMaterials[0].id, amountPerCarton: 1 }],
    }));
  };

  const removeMaterialRow = (idx: number) => {
    setForm(f => ({ ...f, materials: f.materials.filter((_, i) => i !== idx) }));
  };

  const updateMaterialRow = (idx: number, field: keyof MaterialRow, value: string | number) => {
    setForm(f => {
      const rows = [...f.materials];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...f, materials: rows };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.productName.trim()) {
      toast({ title: 'Name and Product Name are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        productName: form.productName,
        piecesPerCarton: Number(form.piecesPerCarton),
        materials: form.materials.map(r => ({
          materialId: r.materialId,
          amountPerCarton: Number(r.amountPerCarton),
        })),
      };
      if (editing) {
        await packagingCartonService.update(editing.id, payload);
        toast({ title: 'Carton updated' });
      } else {
        await packagingCartonService.create(payload);
        toast({ title: 'Carton created' });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: e.message || 'Save failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string | number) => {
    try {
      await packagingCartonService.delete(id);
      toast({ title: 'Carton deleted' });
      load();
    } catch (e: any) {
      toast({ title: e.message || 'Delete failed', variant: 'destructive' });
    }
  };

  const getMaterialName = (id: string | number) =>
    allMaterials.find(m => String(m.id) === String(id))?.name ?? `#${id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Carton Definitions</h1>
            <p className="text-sm text-muted-foreground">Define what packaging materials each carton type needs</p>
          </div>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Carton
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : cartons.length === 0 ? (
            <EmptyState message="No carton definitions yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Pcs/Carton</TableHead>
                  <TableHead>Materials Required</TableHead>
                  {canWrite && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartons.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.productName}</TableCell>
                    <TableCell className="text-right">{c.piecesPerCarton}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.cartonMaterials || []).length === 0 ? (
                          <span className="text-muted-foreground text-xs">none</span>
                        ) : (
                          (c.cartonMaterials || []).map(cm => (
                            <span key={cm.id}
                              className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs">
                              {cm.material?.name ?? getMaterialName(cm.materialId)} × {cm.amountPerCarton}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
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
                                <AlertDialogTitle>Delete carton?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete <strong>{c.name}</strong>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(c.id)}>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Carton' : 'Add Carton'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Carton Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Product Name *</Label>
                <Input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Pieces per Carton *</Label>
              <Input type="number" min={1} value={form.piecesPerCarton}
                onChange={e => setForm(f => ({ ...f, piecesPerCarton: e.target.value as any }))} />
            </div>

            {/* Dynamic material rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materials Required</Label>
                <Button type="button" size="sm" variant="outline" onClick={addMaterialRow}>
                  <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add Row
                </Button>
              </div>
              {form.materials.length === 0 && (
                <p className="text-xs text-muted-foreground">No materials added yet.</p>
              )}
              {form.materials.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={String(row.materialId)}
                      onValueChange={v => updateMaterialRow(idx, 'materialId', v)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {allMaterials.map(m => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.name} ({m.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Qty"
                    className="w-24"
                    value={row.amountPerCarton}
                    onChange={e => updateMaterialRow(idx, 'amountPerCarton', e.target.value)}
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeMaterialRow(idx)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
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
