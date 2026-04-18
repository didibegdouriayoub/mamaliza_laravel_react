import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2, Edit, Package, History, Printer, CalendarDays, Download, Clock } from 'lucide-react';
import { printDocument, fmtDate, fmtEur } from '@/lib/printDocument';
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
import { formatDate } from '@/lib/formatDate';

const emptyForm = {
  name: '',
  type: 'raw' as MaterialType,
  quantity: 0,
  unit: 'kg',
  price: 0,
  supplier: '',
  supplierId: '',
  minStock: 0,
  leadTimeDays: 0,
  lot: '',
  code: '',
  createdAt: new Date().toISOString().split('T')[0]
};

export default function Inventory() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allHistoryOpen, setAllHistoryOpen] = useState(false);
  const [allHistoryRecords, setAllHistoryRecords] = useState<any[]>([]);
  const [allHistoryLoading, setAllHistoryLoading] = useState(false);
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
      const invData = (invRaw || []).map((item: any) => {
        const qty = Number(item.quantity) || 0;
        const minStock = Number(item.minStock) || 0;
        const status: 'ok' | 'low' | 'out' = qty <= 0 ? 'out' : (minStock > 0 && qty <= minStock ? 'low' : 'ok');
        return {
          ...item,
          supplier: item.supplier?.name ?? item.supplier ?? '',
          supplierId: String(item.supplierId ?? item.supplier?.id ?? ''),
          price: Number(item.price) || 0,
          quantity: qty,
          minStock,
          status,
          lot: item.lot || '',
          code: item.code || '',
          leadTimeDays: Number(item.leadTimeDays ?? item.lead_time_days) || 0,
          createdAt: item.createdAt?.split('T')[0] || item.created_at?.split('T')[0] || '',
          history: [],
        };
      });
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
    
    // Status Logic (Manual check to match StockBadge logic)
    const isLow = i.quantity > 0 && i.minStock > 0 && i.quantity <= i.minStock;
    const isOut = i.quantity <= 0;
    const status = isOut ? 'out' : (isLow ? 'low' : 'ok');
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    if (dateFilter && i.createdAt > dateFilter) return false;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleNameSelect = (name: string) => {
    const existing = items.find(i => i.name === name);
    if (existing) {
      setForm(p => ({
        ...p,
        name,
        type: existing.type,
        unit: existing.unit,
        price: existing.price,
        supplierId: String(existing.supplierId ?? ''),
        supplier: existing.supplier,
        minStock: existing.minStock
      }));
    } else {
      setForm(p => ({ ...p, name }));
    }
  };

  const openCreate = () => { setEditingItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      supplier: item.supplier,
      supplierId: String(item.supplierId ?? ''),
      minStock: item.minStock,
      lot: item.lot || '',
      code: item.code || '',
      leadTimeDays: item.leadTimeDays ?? 0,
      createdAt: item.createdAt || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.unit) return;
    const saveForm = form.code ? form : {
      ...form,
      code: `INV-${form.name.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
    try {
      if (editingItem) {
        await inventoryService.update(editingItem.id, saveForm);
        toast({ title: 'Item updated', description: `${form.name} has been updated.` });
      } else {
        await inventoryService.create(saveForm);
        toast({ title: 'Item created', description: `${form.name} has been added.` });
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message || 'An error occurred.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await inventoryService.delete(id);
      toast({ title: 'Item deleted', variant: 'destructive' });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Cannot delete item',
        description: err.message || 'This item is used in one or more recipes.',
        variant: 'destructive',
      });
    }
  };

  const mapHistoryRecord = (h: any) => ({
    id: String(h.id),
    field: h.field,
    oldValue: String(h.oldValue ?? h.old_value ?? ''),
    newValue: String(h.newValue ?? h.new_value ?? ''),
    changedBy: h.changedBy ?? h.changed_by ?? 'System',
    changedAt: h.changedAt ?? h.changed_at ?? '',
  });

  const openItemHistory = async (item: InventoryItem) => {
    setHistoryItem({ ...item, history: [] });
    setHistoryLoading(true);
    try {
      const full = await inventoryService.getById(item.id);
      const history = (full?.history || []).map(mapHistoryRecord);
      setHistoryItem({ ...item, history });
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openAllHistory = async () => {
    setAllHistoryOpen(true);
    setAllHistoryLoading(true);
    try {
      const data = await inventoryService.getAllHistory();
      setAllHistoryRecords((data || []).map((h: any) => ({
        ...mapHistoryRecord(h),
        itemName: h.itemName ?? h.item_name ?? '',
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setAllHistoryLoading(false);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const s = suppliers.find(s => String(s.id) === String(supplierId));
    setForm(prev => ({ ...prev, supplierId, supplier: s?.name || '' }));
  };

  const handlePrint = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const typeLabel = (t: string) => ({ raw: 'Raw', packaging: 'Packaging', leftover: 'Leftover', product: 'Product' }[t] ?? t);
    const stockBadge = (s: string) => {
      if (s === 'ok')  return '<span class="badge badge-ok">OK</span>';
      if (s === 'low') return '<span class="badge badge-low">LOW</span>';
      return '<span class="badge badge-out">OUT</span>';
    };

    const totalValue = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const byType = items.reduce((m, i) => { m[i.type] = (m[i.type] || 0) + 1; return m; }, {} as Record<string, number>);
    const lowCount = items.filter(i => i.status === 'low' || i.status === 'out').length;

    const rows = filtered.map((i, idx) => {
      const sub = [i.code && `[${i.code}]`, i.lot && `Lot: ${i.lot}`].filter(Boolean).join(' ');
      return `<tr class="${idx % 2 === 1 ? 'alt' : ''}">
        <td>
          <div style="font-weight:600">${i.name}</div>
          ${sub ? `<div style="font-size:7.5pt;color:#64748b;margin-top:1px">${sub}</div>` : ''}
        </td>
        <td>${typeLabel(i.type)}</td>
        <td class="r">${i.quantity.toLocaleString('fr-FR')}</td>
        <td>${i.unit}</td>
        <td class="r">${fmtEur(i.price)}</td>
        <td class="r">${fmtEur(i.quantity * i.price)}</td>
        <td>${i.supplier || '—'}</td>
        <td>${fmtDate(i.createdAt)}</td>
        <td>${stockBadge(i.status)}</td>
      </tr>`;
    }).join('');

    const html = `
      <div class="doc-header">
        <div class="brand">
          <div class="brand-icon">FM</div>
          <div>
            <div class="brand-name">Fromagerie Mamaliza</div>
            <div class="brand-sub">Inventory Management System</div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">Inventory Report</div>
          <div>Generated on ${dateStr} at ${timeStr}</div>
          <div>By ${user?.name ?? '—'} · ${user?.role ?? ''}</div>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="card-label">Total Items</div>
          <div class="card-value">${items.length}</div>
          <div class="card-desc">${Object.entries(byType).map(([k,v]) => `${v} ${typeLabel(k)}`).join(' · ')}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Stock Value</div>
          <div class="card-value green">${fmtEur(totalValue)}</div>
          <div class="card-desc">at current unit prices</div>
        </div>
        <div class="card">
          <div class="card-label">Stock Alerts</div>
          <div class="card-value ${lowCount > 0 ? 'red' : 'green'}">${lowCount}</div>
          <div class="card-desc">${lowCount > 0 ? 'items low or out of stock' : 'all items at safe levels'}</div>
        </div>
      </div>

      <div class="section-title">Stock Lines · ${filtered.length} item${filtered.length !== 1 ? 's' : ''}</div>
      <table>
        <thead>
          <tr>
            <th>Name / Code / Lot</th>
            <th>Type</th>
            <th class="r">Qty</th>
            <th>Unit</th>
            <th class="r">Unit Price</th>
            <th class="r">Value</th>
            <th>Supplier</th>
            <th>Added</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="total">
            <td colspan="5">Total Stock Value</td>
            <td class="r">${fmtEur(totalValue)}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>

      <div class="doc-footer">
        <span>Fromagerie Mamaliza — Confidential</span>
        <span>Inventory Report · ${dateStr}</span>
      </div>`;

    printDocument('Inventory Report — Fromagerie Mamaliza', html);
  };

  const handleExportCsv = () => {
    const headers = ['Name', 'Type', 'Lot', 'Code', 'Quantity', 'Unit', 'Price (€)', 'Supplier', 'Min Stock', 'Status', 'Added'];
    const rows = filtered.map(i => [
      i.name, i.type, i.lot || '', i.code || '',
      i.quantity, i.unit, i.price.toFixed(2), i.supplier,
      i.minStock, i.status, i.createdAt,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'inventory.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Inventory</h1>
          <p className="text-sm text-muted-foreground print:hidden">Manage raw materials and packaging supplies</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button variant="outline" onClick={handleExportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" onClick={openAllHistory}><Clock className="h-4 w-4 mr-1" /> History</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {hasPermission('inventory.write') && (
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input 
                    value={form.name} 
                    list="inventory-names"
                    onChange={e => handleNameSelect(e.target.value)} 
                    placeholder="e.g. Whole Milk" 
                  />
                  <datalist id="inventory-names">
                    {Array.from(new Set(items.map(i => i.name))).map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as MaterialType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw">Raw Material</SelectItem>
                        <SelectItem value="packaging">Packaging</SelectItem>
                        <SelectItem value="leftover">Leftover</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="kg, liters, units" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Lot / Batch Number</Label>
                    <Input value={form.lot} onChange={e => setForm(p => ({ ...p, lot: e.target.value }))} placeholder="e.g. LOT-2024-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code (Internal)</Label>
                    <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Auto-generated" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
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
                  <div className="space-y-1.5">
                    <Label>Lead Time (days)</Label>
                    <Input type="number" min={0} value={form.leadTimeDays} onChange={e => setForm(p => ({ ...p, leadTimeDays: Number(e.target.value) }))} placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Entry Date (Created At)</Label>
                    <div className="relative">
                      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="date" className="pl-9" value={form.createdAt} onChange={e => setForm(p => ({ ...p, createdAt: e.target.value }))} />
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
          <div className="print:hidden space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search inventory..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="raw">Raw Materials</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                  <SelectItem value="leftover">Leftover</SelectItem>
                  <SelectItem value="product">Products</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ok">In Stock (OK)</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
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
                    <TableHead className="hidden lg:table-cell">Lot</TableHead>
                    <TableHead className="hidden lg:table-cell">Code</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden sm:table-cell">Unit</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Price (€)</TableHead>
                    <TableHead className="hidden md:table-cell">Supplier</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((item, idx) => {
                    const displayQty = dateFilter ? getStockAtDate(item, dateFilter) : item.quantity;
                    return (
                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} className="border-b">
                        <TableCell className="font-medium">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-muted-foreground lg:hidden">
                            {item.code && `[${item.code}] `}{item.lot && `Lot: ${item.lot}`}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize hidden sm:table-cell">{item.type}</TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs">{item.lot || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs">{item.code || '—'}</TableCell>
                        <TableCell className="text-right">{displayQty !== null ? displayQty.toLocaleString() : '—'}</TableCell>
                        <TableCell className="hidden sm:table-cell">{item.unit}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">€{item.price.toFixed(2)}</TableCell>
                        <TableCell className="hidden md:table-cell">{item.supplier}</TableCell>
                        <TableCell><StockBadge quantity={displayQty ?? item.quantity} minStock={item.minStock} /></TableCell>
                        <TableCell className="text-right print:hidden">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openItemHistory(item)} title="View history">
                              <History className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {hasPermission('inventory.write') && (
                              <>
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
                              </>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground print:hidden">
              <span>{filtered.length} items · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All History Dialog */}
      <Dialog open={allHistoryOpen} onOpenChange={setAllHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Clock className="h-5 w-5" /> All Inventory Changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {allHistoryLoading ? (
              <p className="text-sm text-muted-foreground">Loading history…</p>
            ) : allHistoryRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
            ) : allHistoryRecords.map(h => (
              <div key={h.id} className="text-sm py-2 border-b last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.itemName} — <span className="capitalize">{h.field}</span></span>
                  <span className="text-xs text-muted-foreground">{formatDate(h.changedAt)}</span>
                </div>
                <p className="text-muted-foreground">
                  <span className="line-through">{h.oldValue}</span> → <span className="text-foreground font-medium">{h.newValue}</span>
                </p>
                <p className="text-xs text-muted-foreground">by {h.changedBy}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyItem} onOpenChange={() => setHistoryItem(null)}>
        <DialogContent>
          {historyItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2"><History className="h-5 w-5" /> Change History — {historyItem.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {historyLoading ? (
                  <p className="text-sm text-muted-foreground">Loading history…</p>
                ) : (historyItem.history || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
                ) : (
                  [...(historyItem.history || [])].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map(h => (
                    <div key={h.id} className="text-sm py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{h.field}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(h.changedAt)}</span>
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
