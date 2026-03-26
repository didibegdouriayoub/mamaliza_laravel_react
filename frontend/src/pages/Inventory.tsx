import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2, Edit, Package, History, Printer, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StockBadge } from '@/components/StatusBadge';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { inventoryService } from '@/services/inventoryService';
import { supplierService } from '@/services/supplierService';
import { InventoryItem, MaterialType, Supplier } from '@/models/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const emptyForm = { name: '', type: 'raw' as MaterialType, quantity: 0, unit: '', price: 0, supplier: '', supplierId: '', minStock: 0 };

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [invRaw, supData] = await Promise.all([
        inventoryService.getAll(),
        supplierService.getAll()
      ]);
      // supplierId / minStock / createdAt now come as camelCase from apiClient.
      // supplier is a nested object — flatten name & id.
      const invData = (invRaw || []).map((item: any) => ({
        ...item,
        supplier: item.supplier?.name ?? item.supplier ?? '',
        supplierId: item.supplierId ?? item.supplier?.id ?? '',
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
        minStock: Number(item.minStock) || 0,
      }));
      setItems(invData);
      setSuppliers(supData || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Reconstruct stock at a specific date using history
  const getStockAtDate = (item: InventoryItem, date: string): number | null => {
    if (!date) return null;
    if (!item.history || item.history.length === 0) {
      return item.createdAt <= date ? item.quantity : null;
    }
    // Walk backwards through history to reconstruct
    let qty = item.quantity;
    const sortedHistory = [...item.history]
      .filter(h => h.field === 'quantity')
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt));

    for (const h of sortedHistory) {
      if (h.changedAt > date) {
        qty = Number(h.oldValue);
      }
    }
    return item.createdAt <= date ? qty : null;
  };

  const filtered = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.supplier.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || i.type === typeFilter;
    if (dateFilter && i.createdAt > dateFilter) return false;
    return matchesSearch && matchesType;
  });

  const openCreate = () => { setEditingItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({ name: item.name, type: item.type, quantity: item.quantity, unit: item.unit, price: item.price, supplier: item.supplier, supplierId: item.supplierId, minStock: item.minStock });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.unit) return;
    if (editingItem) {
      // Track changes in history
      const changes: { field: string; oldValue: string; newValue: string }[] = [];
      if (editingItem.quantity !== form.quantity) changes.push({ field: 'quantity', oldValue: String(editingItem.quantity), newValue: String(form.quantity) });
      if (editingItem.price !== form.price) changes.push({ field: 'price', oldValue: String(editingItem.price), newValue: String(form.price) });
      if (editingItem.name !== form.name) changes.push({ field: 'name', oldValue: editingItem.name, newValue: form.name });
      if (editingItem.supplier !== form.supplier) changes.push({ field: 'supplier', oldValue: editingItem.supplier, newValue: form.supplier });

      const newHistory = [
        ...(editingItem.history || []),
        ...changes.map(c => ({
          id: `h${Date.now()}${Math.random()}`,
          ...c,
          changedBy: user?.name || 'System',
          changedAt: new Date().toISOString().split('T')[0],
        })),
      ];
      await inventoryService.update(editingItem.id, { ...form, history: newHistory });
      toast({ title: 'Item updated', description: `${form.name} has been updated.` });
    } else {
      await inventoryService.create(form);
      toast({ title: 'Item created', description: `${form.name} has been added.` });
    }
    setDialogOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await inventoryService.delete(id);
    toast({ title: 'Item deleted', variant: 'destructive' });
    loadData();
  };

  const handleSupplierChange = (supplierId: string) => {
    const s = suppliers.find(s => String(s.id) === String(supplierId));
    setForm(prev => ({ ...prev, supplierId, supplier: s?.name || '' }));
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage raw materials and packaging supplies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Whole Milk" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as MaterialType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw">Raw Material</SelectItem>
                        <SelectItem value="packaging">Packaging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="kg, liters, units" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Quantity</Label>
                    <Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Price (€)</Label>
                    <Input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Min Stock</Label>
                    <Input type="number" value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <Select value={form.supplierId} onValueChange={handleSupplierChange}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>{editingItem ? 'Update' : 'Create'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4 print:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="raw">Raw Materials</SelectItem>
                <SelectItem value="packaging">Packaging</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                className="pl-9 w-full sm:w-44"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                placeholder="Stock at date"
              />
            </div>
            {dateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setDateFilter('')} className="text-xs">Clear date</Button>
            )}
          </div>

          {dateFilter && (
            <div className="mb-3 px-2 py-1.5 bg-accent/50 rounded-md text-sm text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Showing estimated stock levels as of <span className="font-medium text-foreground">{dateFilter}</span>
            </div>
          )}

          {loading ? <TableSkeleton /> : filtered.length === 0 ? (
            <EmptyState title="No items found" description="Try adjusting your search or add a new item." icon="📦" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">Unit</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Price (€)</TableHead>
                    <TableHead className="hidden md:table-cell">Supplier</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item, idx) => {
                    const displayQty = dateFilter ? getStockAtDate(item, dateFilter) : item.quantity;
                    return (
                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="border-b">
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="capitalize hidden sm:table-cell">{item.type}</TableCell>
                        <TableCell className="text-right">{displayQty !== null ? displayQty.toLocaleString() : '—'}</TableCell>
                        <TableCell className="hidden sm:table-cell">{item.unit}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">€{item.price.toFixed(2)}</TableCell>
                        <TableCell className="hidden md:table-cell">{item.supplier}</TableCell>
                        <TableCell><StockBadge quantity={displayQty ?? item.quantity} minStock={item.minStock} /></TableCell>
                        <TableCell className="text-right print:hidden">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setHistoryItem(item)} title="View history">
                              <History className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={!!historyItem} onOpenChange={() => setHistoryItem(null)}>
        <DialogContent>
          {historyItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2"><History className="h-5 w-5" /> Change History — {historyItem.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(historyItem.history || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
                ) : (
                  [...(historyItem.history || [])].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map(h => (
                    <div key={h.id} className="text-sm py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{h.field}</span>
                        <span className="text-xs text-muted-foreground">{h.changedAt}</span>
                      </div>
                      <p className="text-muted-foreground">
                        <span className="line-through">{h.oldValue}</span> → <span className="text-foreground font-medium">{h.newValue}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">by {h.changedBy}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
