import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, Plus, Trash2, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { supplierService } from '@/services/supplierService';
import { useToast } from '@/hooks/use-toast';
import type { Supplier } from '@/models/types';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await supplierService.getAll();
      setSuppliers(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to load suppliers', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingSupplier(null);
    setName('');
    setEmail('');
    setContact('');
    setDialogOpen(true);
  };

  const openEdit = (supp: Supplier) => {
    setEditingSupplier(supp);
    setName(supp.name);
    setEmail(supp.email || '');
    setContact(supp.contact || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    try {
      if (editingSupplier) {
        await supplierService.update(String(editingSupplier.id), { name, email, contact });
        toast({ title: 'Supplier updated', description: `${name} has been updated.` });
      } else {
        await supplierService.create({ name, email, contact });
        toast({ title: 'Supplier created', description: `${name} has been added.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error saving supplier', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await supplierService.delete(id);
      toast({ title: 'Supplier deleted', variant: 'destructive' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Error deleting supplier', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Suppliers
          </h1>
          <p className="text-sm text-muted-foreground">Manage raw material providers and vendors</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Supplier Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alpine Dairy Co." />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="orders@alpinedairy.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Info / Phone</Label>
                <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="John Doe (+1 234 567 890)" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingSupplier ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><TableSkeleton /></div> : suppliers.length === 0 ? (
            <div className="p-4"><EmptyState title="No suppliers found" description="Add a primary supplier to stock inventory." icon="📦" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supp, idx) => (
                    <motion.tr key={supp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="border-b">
                      <TableCell className="font-medium font-display text-base">{supp.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{supp.contact || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{supp.email || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(supp)}>
                            <Edit className="h-4 w-4 text-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {supp.name}?</AlertDialogTitle>
                                <AlertDialogDescription>It will permanently delete the supplier configuration. Inventory items linked to this supplier might lose their origin trace.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(supp.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
