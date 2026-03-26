import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UsersRound, Plus, Trash2, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { customerService } from '@/services/customerService';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/models/types';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAll();
      setCustomers(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to load customers', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingCustomer(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setDialogOpen(true);
  };

  const openEdit = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setEmail(cust.email || '');
    setPhone(cust.phone || '');
    setAddress(cust.address || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    try {
      if (editingCustomer) {
        await customerService.update(String(editingCustomer.id), { name, email, phone, address });
        toast({ title: 'Customer updated', description: `${name} has been updated.` });
      } else {
        await customerService.create({ name, email, phone, address });
        toast({ title: 'Customer created', description: `${name} has been added.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error saving customer', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      await customerService.delete(id);
      toast({ title: 'Customer deleted', variant: 'destructive' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Error deleting customer', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <UsersRound className="h-6 w-6" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground">Manage your B2B clients and individual customers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Customer Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cheese Lovers Shop" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@cheeselovers.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Dairy Lane, City" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingCustomer ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? <div className="p-4"><TableSkeleton /></div> : customers.length === 0 ? (
            <div className="p-4"><EmptyState title="No customers found" description="Add a customer to initiate your first order." icon="🤝" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target Client</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((cust, idx) => (
                    <motion.tr key={cust.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="border-b">
                      <TableCell className="font-medium font-display text-base">{cust.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {cust.email && <div>{cust.email}</div>}
                          {cust.phone && <div className="text-muted-foreground">{cust.phone}</div>}
                          {!cust.email && !cust.phone && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{cust.address || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(cust)}>
                            <Edit className="h-4 w-4 text-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {cust.name}?</AlertDialogTitle>
                                <AlertDialogDescription>It will permanently delete the customer configuration inside the system. Ensure all outstanding orders are cleared.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(cust.id)}>Delete</AlertDialogAction>
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
