import { useState, useEffect, Fragment } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Search, Plus, Undo2, CreditCard, Download, Trash2, Printer, FileText, Truck, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LotPicker } from '@/components/LotPicker';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { orderService } from '@/services/orderService';
import { customerService } from '@/services/customerService';
import { expandOrderLines, splitPieces, splitLabel } from '@/lib/orderSplit';
import { finishedProductService, FinishedProduct } from '@/services/finishedProductService';
import { Order } from '@/models/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { printOrderDocument, DocKind } from '@/lib/invoicePrint';

interface OrderLine {
  finished_product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
  allocations?: Record<number, number>; // set when the seller picks lots: lot id -> quantity (quantity = their sum)
}

export default function Sales() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selected, setSelected] = useState<Order | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [tab, setTab] = useState<'facture' | 'devis' | 'owed'>('facture');
  const [newDocType, setNewDocType] = useState<'facture' | 'devis'>('facture');
  const [converting, setConverting] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Cash');
  // Return dialog: one row per line of the order (index = position in selected.items)
  type RetRow = { qty: string; refund: string; disposition: 'restock' | 'perte'; unit: 'piece' | 'carton' };
  const [retRows, setRetRows] = useState<RetRow[]>([]);
  const [retReason, setRetReason] = useState('');
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  // New order state
  const [customers, setCustomers] = useState<any[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<FinishedProduct[]>([]);
  const [newOrderCustomerId, setNewOrderCustomerId] = useState('');
  const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, custs, prods] = await Promise.all([
        orderService.getAll(),
        customerService.getAll().catch(() => []),
        finishedProductService.getAll().catch(() => []),
      ]);
      setOrders(data || []);
      setCustomers(custs || []);
      setFinishedProducts(prods || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openNew = (type: 'facture' | 'devis') => {
    setNewDocType(type);
    setNewOrderCustomerId(''); setNewOrderCustomerName(''); setOrderLines([]);
    setNewOrderOpen(true);
  };

  // A product with lots in stock opens its lot list straight away (pick how many from each lot);
  // "Back to automatic" on the line switches to oldest-first with a plain quantity.
  const addOrderLine = (product: FinishedProduct) => {
    const pickNow = (product.available_lots?.length ?? 0) > 0;
    setOrderLines(prev => [...prev, {
      finished_product_id: product.id,
      product_name: product.name,
      unit_price: product.unit_price,
      quantity: pickNow ? 0 : 1,
      total: pickNow ? 0 : product.unit_price,
      ...(pickNow ? { allocations: {} } : {}),
    }]);
  };

  const updateLine = (i: number, qty: number) => {
    setOrderLines(prev => prev.map((l, j) => j === i ? { ...l, quantity: qty, total: +(l.unit_price * qty).toFixed(2) } : l));
  };

  // switch a line between automatic (oldest first) and hand-picked lots
  const togglePicking = (i: number) => setOrderLines(prev => prev.map((l, j) => {
    if (j !== i) return l;
    if (l.allocations) { const { allocations, ...rest } = l; return rest; }
    return { ...l, allocations: {}, quantity: 0, total: 0 };
  }));

  const setAllocation = (i: number, lotId: number, qty: number) => {
    setOrderLines(prev => prev.map((l, j) => {
      if (j !== i) return l;
      const allocations = { ...(l.allocations ?? {}), [lotId]: qty };
      const quantity = Object.values(allocations).reduce((s, q) => s + q, 0);
      return { ...l, allocations, quantity, total: +(l.unit_price * quantity).toFixed(2) };
    }));
  };

  const removeLine = (i: number) => setOrderLines(prev => prev.filter((_, j) => j !== i));

  // pieces → whole cartons (carton price) + loose pieces (piece price), the way stock will be deducted
  const lineToItems = (l: OrderLine) => {
    const product = finishedProducts.find(p => p.id === l.finished_product_id);
    if (l.allocations) {
      // lots picked by hand: one line, exactly those lots (no automatic carton split)
      const lot_allocations = Object.entries(l.allocations).filter(([, q]) => q > 0).map(([id, qty]) => ({ lot_id: Number(id), qty }));
      return lot_allocations.length && product ? [{
        product_name: l.product_name, finished_product_id: l.finished_product_id, quantity: l.quantity,
        unit_price: l.unit_price, total: +(l.unit_price * l.quantity).toFixed(2), lot_allocations,
      }] : [];
    }
    return product ? expandOrderLines([{ product, quantity: l.quantity }], finishedProducts) : [];
  };
  const expandedItems = orderLines.flatMap(lineToItems);
  const orderTotal = expandedItems.reduce((s, i) => s + i.total, 0);

  const addressOf = (customerId?: string | number | null) =>
    customers.find((c: any) => String(c.id) === String(customerId ?? ''))?.address ?? '';

  const handleCreateOrder = async (print: boolean) => {
    if (!newOrderCustomerName.trim()) { toast({ title: 'Customer name required', variant: 'destructive' }); return; }
    if (orderLines.length === 0) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }
    if (orderLines.some(l => l.allocations && l.quantity <= 0)) { toast({ title: 'Pick a quantity from at least one lot', variant: 'destructive' }); return; }
    setSavingOrder(true);
    try {
      const created: any = await orderService.create({
        customerId: newOrderCustomerId || undefined,
        customerName: newOrderCustomerName,
        totalAmount: orderTotal,
        amountPaid: 0,
        amountReturned: 0,
        status: 'pending',
        document_type: newDocType,
        items: expandedItems as any[],
      } as any);
      const warnings: any[] = created?.stockWarnings ?? [];
      toast({
        title: `${newDocType === 'devis' ? 'Devis' : 'Facture'} ${created?.docNumber ?? ''} saved`,
        description: warnings.length ? warnings.map(w => `${w.name}: sold ${w.requested}, had ${w.available}`).join(' | ') : undefined,
        variant: warnings.length ? 'destructive' : undefined,
      });
      setNewOrderOpen(false);
      setTab(newDocType);
      if (print) printOrderDocument(created as Order, newDocType, addressOf(created?.customerId));
      loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingOrder(false);
  };

  const handleExportCsv = () => {
    const headers = ['Number', 'Customer', 'Total (DH)', 'Paid (DH)', 'Returned (DH)', 'Balance (DH)', 'Status', 'Date'];
    const rows = filtered.map(o => [
      o.docNumber ?? o.id, o.customerName,
      o.totalAmount.toFixed(2), o.amountPaid.toFixed(2), o.amountReturned.toFixed(2),
      Math.max(0, o.totalAmount - o.amountReturned - o.amountPaid).toFixed(2),
      o.status, o.createdAt,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = tab === 'devis' ? 'devis.csv' : 'factures.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const factures = orders.filter(o => o.documentType !== 'devis');
  const devisList = orders.filter(o => o.documentType === 'devis');
  const baseList = tab === 'devis' ? devisList : factures;
  const filtered = baseList.filter(o =>
    o.customerName.toLowerCase().includes(search.toLowerCase()) || (o.docNumber ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePayment = async () => {
    if (!selected || payAmount <= 0) return;
    try {
      await orderService.addPayment(selected.id, { amount: payAmount, method: payMethod, date: new Date().toISOString().split('T')[0] });
      toast({ title: 'Payment recorded', description: `DH${payAmount} received.` });
      setPaymentOpen(false);
      const updated = await orderService.getAll();
      setOrders(updated);
      const refreshed = updated.find(o => o.id === selected.id);
      setSelected(refreshed || null);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record payment', variant: 'destructive' });
    }
  };

  // already returned per order line
  // Everything is counted in pieces so a box and loose pieces of the same line add up.
  const ppuOf = (item: { piecesPerUnit?: number }) => Number(item.piecesPerUnit) || 1;
  const soldPiecesOf = (item: { quantity: number; piecesPerUnit?: number }) => Number(item.quantity) * ppuOf(item);
  const returnedOf = (itemId?: number) =>
    itemId ? (selected?.returns ?? []).filter(r => r.orderItemId === itemId).reduce((s, r) => s + Number(r.pieces ?? r.quantity), 0) : 0;
  const returnableOf = (item: { id?: number; quantity: number; piecesPerUnit?: number }) => Math.max(0, +(soldPiecesOf(item) - returnedOf(item.id)).toFixed(4));
  // max quantity in the chosen unit (whole boxes only)
  const maxIn = (item: { id?: number; quantity: number; piecesPerUnit?: number }, unit: 'piece' | 'carton') =>
    unit === 'carton' ? Math.floor(returnableOf(item) / ppuOf(item) + 1e-9) : returnableOf(item);
  const piecesOfRow = (item: { piecesPerUnit?: number }, row: { qty: string; unit: 'piece' | 'carton' }) =>
    (Number(row.qty) || 0) * (row.unit === 'carton' ? ppuOf(item) : 1);
  const refundFor = (item: { unitPrice: number; piecesPerUnit?: number }, pieces: number) =>
    pieces > 0 ? String(+((Number(item.unitPrice) / ppuOf(item)) * pieces).toFixed(2)) : '';

  const openReturn = () => {
    if (!selected) return;
    setRetRows(selected.items.map(it => ({ qty: '', refund: '', disposition: 'restock', unit: it.unit === 'carton' ? 'carton' : 'piece' })));
    setRetReason('');
    setReturnOpen(true);
  };

  const setRetRow = (i: number, patch: Partial<RetRow>) => setRetRows(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r));

  // typing a quantity fills the refund with unit price x quantity (still editable)
  const setRetQtyFor = (i: number, value: string) => {
    const item = selected?.items[i];
    if (!item) return;
    const unit = retRows[i]?.unit ?? 'piece';
    const q = Math.min(maxIn(item, unit), Math.max(0, Number(value) || 0));
    setRetRow(i, { qty: value === '' ? '' : String(q), refund: refundFor(item, piecesOfRow(item, { qty: String(q), unit })) });
  };

  // switching box <-> piece clears the row (the quantity means something different)
  const setRetUnitFor = (i: number, unit: 'piece' | 'carton') => {
    const item = selected?.items[i];
    if (!item) return;
    setRetRow(i, { unit, qty: '', refund: '' });
  };

  const handleReturn = async () => {
    if (!selected) return;
    const lines = selected.items.map((item, i) => ({ item, row: retRows[i] })).filter(x => Number(x.row?.qty) > 0);
    if (!lines.length) { toast({ title: 'Enter the quantity he brought back', description: 'On at least one line.', variant: 'destructive' }); return; }
    try {
      for (const { item, row } of lines) {
        await orderService.addReturn(selected.id, {
          orderItemId: item.id,
          productName: item.productName,
          finishedProductId: item.finishedProductId,
          quantity: Number(row.qty),
          unit: item.unit === 'carton' ? row.unit : undefined,
          reason: retReason,
          refundAmount: Number(row.refund) || 0,
          disposition: row.disposition,
        });
      }
      toast({ title: 'Return recorded', description: `${lines.length} line${lines.length === 1 ? '' : 's'}` });
      setReturnOpen(false);
      const updated = await orderService.getAll();
      setOrders(updated);
      const refreshed = updated.find(o => o.id === selected.id);
      setSelected(refreshed || null);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record return', variant: 'destructive' });
    }
  };

  // what the customer still owes: total minus goods returned minus what was paid (negative = we owe them a refund)
  const balance = (o: Order) => o.totalAmount - o.amountReturned - o.amountPaid;

  const canWrite = hasPermission('sales.write');
  const showMoney = hasPermission('money.read');

  const printFor = (o: Order, kind: DocKind) => printOrderDocument(o, kind, addressOf(o.customerId));

  // who owes me: unpaid factures grouped by customer
  const owedGroups = (() => {
    const map = new Map<string, { name: string; total: number; orders: Order[] }>();
    for (const o of factures) {
      if (o.status === 'cancelled' || balance(o) <= 0.009) continue;
      const key = o.customerId ? `id:${o.customerId}` : `name:${o.customerName.toLowerCase()}`;
      const g = map.get(key) ?? { name: o.customerName, total: 0, orders: [] };
      g.total += balance(o);
      g.orders.push(o);
      map.set(key, g);
    }
    return [...map.values()].sort((x, y) => y.total - x.total);
  })();
  const owedTotal = owedGroups.reduce((t, g) => t + g.total, 0);
  const money = (n: number) => Math.round(n * 100) / 100;

  const refreshAfter = async (id?: string | number) => {
    const updated = await orderService.getAll();
    setOrders(updated);
    setSelected(id !== undefined ? (updated.find((o: Order) => String(o.id) === String(id)) ?? null) : null);
  };

  // one click: the full balance, in cash
  const quickPaid = async (o: Order) => {
    try {
      await orderService.addPayment(o.id, { amount: money(balance(o)), method: 'Cash', date: new Date().toISOString().split('T')[0] });
      toast({ title: `${o.docNumber ?? 'Facture'} paid`, description: `DH${money(balance(o))} received in cash.` });
      await refreshAfter(selected ? o.id : undefined);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record payment', variant: 'destructive' });
    }
  };

  const convertDevis = async (o: Order) => {
    if (!window.confirm(`Convert ${o.docNumber} to a facture? Stock will be deducted now.`)) return;
    setConverting(true);
    try {
      const facture: any = await orderService.convert(o.id);
      const warnings: any[] = facture?.stockWarnings ?? [];
      toast({
        title: `${o.docNumber} converted to ${facture?.docNumber}`,
        description: warnings.length ? warnings.map(w => `${w.name}: sold ${w.requested}, had ${w.available}`).join(' | ') : 'Stock deducted.',
        variant: warnings.length ? 'destructive' : undefined,
      });
      setTab('facture');
      const updated = await orderService.getAll();
      setOrders(updated);
      setSelected(updated.find((x: Order) => String(x.id) === String(facture?.id)) ?? null);
    } catch (e: any) {
      toast({ title: 'Could not convert', description: e?.message, variant: 'destructive' });
    }
    setConverting(false);
  };

  const deleteDocument = async (o: Order) => {
    const what = o.documentType === 'devis' ? 'devis' : 'facture (its stock goes back)';
    if (!window.confirm(`Delete ${o.docNumber ?? 'this document'}? This removes the ${what}.`)) return;
    try {
      await orderService.delete(o.id);
      toast({ title: 'Deleted', variant: 'destructive' });
      await refreshAfter();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> Sales</h1>
          <p className="text-sm text-muted-foreground">Factures, devis, payments and returns</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <>
              <Button onClick={() => openNew('facture')}><Plus className="h-4 w-4 mr-1" />New Facture</Button>
              <Button variant="outline" onClick={() => openNew('devis')}><FileText className="h-4 w-4 mr-1" />New Devis</Button>
            </>
          )}
          <Button variant="outline" onClick={handleExportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v as typeof tab); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="facture">Factures ({factures.length})</TabsTrigger>
          <TabsTrigger value="devis">Devis ({devisList.length})</TabsTrigger>
          <TabsTrigger value="owed">Who owes me{owedTotal > 0 ? ` · DH${money(owedTotal).toLocaleString()}` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'owed' ? (
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Unpaid factures, by customer</p>
              <p className="font-semibold">Total owed: <span className="text-warning">DH{money(owedTotal).toLocaleString()}</span></p>
            </div>
            {loading ? <TableSkeleton /> : owedGroups.length === 0 ? (
              <EmptyState title="Nobody owes you anything" description="Unpaid factures will be listed here." icon="✅" />
            ) : owedGroups.map(g => (
              <div key={g.name} className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-accent/20">
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-sm text-muted-foreground">{g.orders.length} unpaid · <span className="font-semibold text-foreground">DH{money(g.total).toLocaleString()}</span></span>
                </div>
                <div className="divide-y">
                  {g.orders.map(o => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <button type="button" className="text-left" onClick={() => setSelected(o)}>
                        <span className="font-medium">{o.docNumber ?? `#${o.id}`}</span>
                        <span className="text-muted-foreground"> · {String(o.createdAt).slice(0, 10)}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-warning">DH{money(balance(o))}</span>
                        {canWrite && <Button size="sm" variant="outline" onClick={() => quickPaid(o)}><CheckCircle2 className="h-3 w-3 mr-1" />Paid in full</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={tab === 'devis' ? 'Search devis...' : 'Search factures...'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>

          {loading ? <TableSkeleton /> : filtered.length === 0 ? (
            <EmptyState title={tab === 'devis' ? 'No devis found' : 'No factures found'} description={tab === 'devis' ? 'Devis will appear here.' : 'Factures will appear here.'} icon="🛒" />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tab === 'devis' ? 'Devis' : 'Facture'}</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {tab === 'facture' && <TableHead className="text-right hidden sm:table-cell">Paid</TableHead>}
                  {tab === 'facture' && <TableHead className="text-right hidden md:table-cell">Returned</TableHead>}
                  {tab === 'facture' && <TableHead className="text-right hidden sm:table-cell">Balance</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order, idx) => (
                  <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }} className="border-b cursor-pointer hover:bg-accent/30" onClick={() => setSelected(order)}>
                    <TableCell className="font-medium">{order.docNumber ?? `#${order.id}`}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-right font-medium">DH{order.totalAmount.toLocaleString()}</TableCell>
                    {tab === 'facture' && <TableCell className="text-right text-success hidden sm:table-cell">DH{order.amountPaid.toLocaleString()}</TableCell>}
                    {tab === 'facture' && <TableCell className="text-right text-destructive hidden md:table-cell">DH{order.amountReturned.toLocaleString()}</TableCell>}
                    {tab === 'facture' && <TableCell className="text-right font-semibold hidden sm:table-cell">{balance(order) > 0 ? <span className="text-warning">DH{money(balance(order))}</span> : <span className="text-success">DH0</span>}</TableCell>}
                    <TableCell>
                      {tab === 'devis'
                        ? (order.convertedToId
                            ? <Badge className="bg-success/10 text-success">Accepted</Badge>
                            : <Badge variant="secondary">Open</Badge>)
                        : <OrderStatusBadge status={order.status} />}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{order.createdAt}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
              <span>{filtered.length} {tab === 'devis' ? 'devis' : 'factures'} · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Order detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-3">
                  {selected.docNumber ?? `Order #${selected.id}`}
                  {selected.documentType === 'devis'
                    ? (selected.convertedToId ? <Badge className="bg-success/10 text-success">Accepted</Badge> : <Badge variant="secondary">Open</Badge>)
                    : <OrderStatusBadge status={selected.status} />}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm"><span className="text-muted-foreground">Customer:</span> {selected.customerName}</p>
                <div>
                  <h4 className="font-display font-semibold text-sm mb-2">Items</h4>
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span>{item.productName} × {item.quantity}</span>
                      <span className="font-medium">DH{item.total}</span>
                    </div>
                  ))}
                </div>
                {selected.documentType === 'devis' ? (
                  <div className="space-y-1 text-sm border-t pt-2">
                    <div className="flex justify-between"><span>Total</span><span className="font-semibold">DH{selected.totalAmount}</span></div>
                    <p className="text-xs text-muted-foreground">A devis does not touch stock. Convert it to a facture when the customer accepts.</p>
                  </div>
                ) : (
                <div className="space-y-1 text-sm border-t pt-2">
                  <div className="flex justify-between"><span>Total</span><span className="font-semibold">DH{selected.totalAmount}</span></div>
                  <div className="flex justify-between text-success"><span>Paid</span><span>DH{selected.amountPaid}</span></div>
                  <div className="flex justify-between text-destructive"><span>Returned</span><span>DH{selected.amountReturned}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Balance</span><span>{balance(selected) > 0.009 ? `DH${money(balance(selected))}` : balance(selected) < -0.009 ? `Refund due DH${money(-balance(selected))}` : 'DH0 (Settled)'}</span></div>
                </div>
                )}

                {/* Payments list */}
                {selected.payments.length > 0 && (
                  <div>
                    <h4 className="font-display font-semibold text-sm mb-1">Payments</h4>
                    {selected.payments.map(p => (
                      <div key={p.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <span className="text-muted-foreground">{p.paidAt} — {p.method}</span>
                        <span className="text-success font-medium">DH{p.amount}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Returns list */}
                {selected.returns.length > 0 && (
                  <div>
                    <h4 className="font-display font-semibold text-sm mb-1">Returns</h4>
                    {selected.returns.map(r => (
                      <div key={r.id} className="text-sm py-1 border-b last:border-0">
                        <div className="flex justify-between">
                          <span>{r.productName} × {r.quantity}{r.unit === 'carton' ? ` box (${r.pieces ?? '?'} pc)` : r.unit === 'piece' ? ' pc' : ''}</span>
                          <span className="text-destructive font-medium">-DH{r.refundAmount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.reason} — {r.returnedAt}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selected.documentType === 'devis' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => printFor(selected, 'devis')}>
                      <Printer className="h-3 w-3 mr-1" /> Print Devis
                    </Button>
                    {canWrite && !selected.convertedToId && (
                      <Button size="sm" onClick={() => convertDevis(selected)} disabled={converting}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> {converting ? 'Converting…' : 'Convert to facture'}
                      </Button>
                    )}
                    {selected.convertedToId && (
                      <Button size="sm" variant="outline" onClick={() => { const f = orders.find(o => String(o.id) === String(selected.convertedToId)); if (f) { setTab('facture'); setSelected(f); } }}>
                        View the facture
                      </Button>
                    )}
                    {canWrite && !selected.convertedToId && (
                      <Button size="sm" variant="ghost" onClick={() => deleteDocument(selected)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    )}
                  </div>
                ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => printFor(selected, 'facture')}>
                    <Printer className="h-3 w-3 mr-1" /> Print Invoice
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printFor(selected, 'bl')}>
                    <Truck className="h-3 w-3 mr-1" /> Delivery note
                  </Button>
                  {canWrite && (
                    <>
                      {balance(selected) > 0.009 && selected.status !== 'cancelled' && (
                        <Button size="sm" onClick={() => quickPaid(selected)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Paid in full
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { setPayAmount(balance(selected)); setPaymentOpen(true); }}>
                        <CreditCard className="h-3 w-3 mr-1" /> Record Payment
                      </Button>
                      <Button size="sm" variant="outline" onClick={openReturn}>
                        <Undo2 className="h-3 w-3 mr-1" /> Record Return
                      </Button>
                    </>
                  )}
                </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Amount (DH)</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} /></div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handlePayment}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog: the lines of the order, nothing to pick */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Record Return{selected?.docNumber ? ` — ${selected.docNumber}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">These are the products on this facture. Enter the quantity that came back and what to do with it.</p>
            {(selected?.items ?? []).map((item, i) => {
              const can = returnableOf(item);
              const row = retRows[i] ?? { qty: '', refund: '', disposition: 'restock' as const, unit: 'piece' as const };
              const isBox = item.unit === 'carton' && ppuOf(item) > 1;
              return (
                <div key={item.id ?? i} className={`rounded-lg border p-3 space-y-2 ${can <= 0 ? 'opacity-50' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-xs text-muted-foreground">sold {item.quantity}{isBox ? ` box (${soldPiecesOf(item)} pc)` : ''}{returnedOf(item.id) > 0 ? ` · already returned ${returnedOf(item.id)} pc` : ''}</span>
                  </div>
                  {can <= 0
                    ? <p className="text-xs text-muted-foreground">Fully returned.</p>
                    : (
                      <div className={`grid gap-2 items-end ${isBox ? (showMoney ? 'grid-cols-[80px_90px_1fr_110px]' : 'grid-cols-[80px_90px_1fr]') : (showMoney ? 'grid-cols-[90px_1fr_110px]' : 'grid-cols-[90px_1fr]')}`}>
                        {isBox && (
                          <div className="space-y-1">
                            <Label className="text-xs">Unit</Label>
                            <Select value={row.unit} onValueChange={v => setRetUnitFor(i, v as 'piece' | 'carton')}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="carton">Box</SelectItem>
                                <SelectItem value="piece">Piece</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Returned (max {maxIn(item, row.unit)})</Label>
                          <Input type="number" min="0" max={maxIn(item, row.unit)} className="h-9" placeholder="0" value={row.qty} onChange={e => setRetQtyFor(i, e.target.value)} />
                          {isBox && row.unit === 'piece' && Number(row.qty) > 0 && <p className="text-[10px] text-muted-foreground">= {+(Number(row.qty) / ppuOf(item)).toFixed(2)} box of {ppuOf(item)}</p>}
                          {isBox && row.unit === 'carton' && Number(row.qty) > 0 && <p className="text-[10px] text-muted-foreground">= {piecesOfRow(item, row)} pieces</p>}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Disposition</Label>
                          <Select value={row.disposition} onValueChange={v => setRetRow(i, { disposition: v as 'restock' | 'perte' })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="restock">Restock (back to stock)</SelectItem>
                              <SelectItem value="perte">Write off (trash)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {showMoney && (
                          <div className="space-y-1">
                            <Label className="text-xs">Refund (DH)</Label>
                            <Input type="number" step="0.01" min="0" className="h-9" value={row.refund} onChange={e => setRetRow(i, { refund: e.target.value })} />
                          </div>
                        )}
                      </div>
                    )}
                </div>
              );
            })}
            <div className="space-y-1.5"><Label>Reason</Label><Textarea value={retReason} onChange={e => setRetReason(e.target.value)} rows={2} /></div>
            {showMoney && (
              <p className="text-sm text-right font-semibold">Total refund: {retRows.reduce((t, r) => t + (Number(r.refund) || 0), 0).toFixed(2)} DH</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleReturn}>Confirm Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Order dialog */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New {newDocType === 'devis' ? 'Devis' : 'Facture'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Customer */}
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={newOrderCustomerId} onValueChange={v => {
                setNewOrderCustomerId(v);
                const c = customers.find(c => String(c.id) === v);
                if (c) setNewOrderCustomerName(c.name);
              }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1" value={newOrderCustomerName} onChange={e => setNewOrderCustomerName(e.target.value)} placeholder="Or type customer name manually" />
            </div>

            {/* Product selector */}
            <div className="space-y-2">
              <Label>Add Products</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {finishedProducts.map(p => (
                  <button key={p.id} type="button" onClick={() => addOrderLine(p)}
                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 text-left text-sm transition-colors">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.unit_price.toFixed(2)} DH · <span className={`${(p.stock?.quantity ?? 0) === 0 ? 'text-destructive' : 'text-green-600'}`}>{p.stock?.quantity ?? 0} pcs</span></span>
                  </button>
                ))}
              </div>
            </div>

            {/* Order lines */}
            {orderLines.length > 0 && (
              <div className="space-y-2">
                <Label>Order Lines</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderLines.map((line, i) => (
                      <Fragment key={i}>
                      <TableRow>
                        <TableCell>
                          {line.product_name}
                          {(() => {
                            const prod = finishedProducts.find(p => p.id === line.finished_product_id);
                            const sp = prod ? splitPieces(prod, line.quantity) : null;
                            const label = sp ? splitLabel(sp) : null;
                            return !line.allocations && label ? <span className="block text-xs text-muted-foreground">{label}{sp!.opens > 0 ? ` · opens ${sp!.opens} carton${sp!.opens === 1 ? '' : 's'}` : ''}</span> : null;
                          })()}
                          <button type="button" className="block text-xs text-primary hover:underline" onClick={() => togglePicking(i)}>
                            {line.allocations ? 'Back to automatic (oldest first)' : 'Choose lots'}
                          </button>
                        </TableCell>
                        <TableCell>
                          {line.allocations
                            ? <span className="font-medium">{line.quantity}</span>
                            : <Input type="number" min="1" className="h-7 w-20" value={line.quantity} onChange={e => updateLine(i, Number(e.target.value) || 1)} />}
                        </TableCell>
                        <TableCell className="text-right font-medium">{lineToItems(line).reduce((t, i) => t + i.total, 0).toFixed(2)} DH</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                      {line.allocations && (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-accent/20">
                            <LotPicker lots={finishedProducts.find(p => p.id === line.finished_product_id)?.available_lots ?? []}
                              picks={line.allocations ?? {}} onChange={(lotId, qty) => setAllocation(i, lotId, qty)} />
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">{orderTotal.toFixed(2)} DH</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrderOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleCreateOrder(false)} disabled={savingOrder}>{savingOrder ? 'Saving...' : 'Save'}</Button>
            <Button onClick={() => handleCreateOrder(true)} disabled={savingOrder}><Printer className="h-4 w-4 mr-1" />Save &amp; print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
