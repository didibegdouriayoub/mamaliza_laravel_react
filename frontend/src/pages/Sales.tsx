import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Search, Plus, Undo2, CreditCard, Download, Trash2, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { printDocument, fmtDate, fmtEur } from '@/lib/printDocument';

interface OrderLine {
  finished_product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
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
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Cash');
  const [retProductName, setRetProductName] = useState('');
  const [retFinishedProductId, setRetFinishedProductId] = useState<number | null>(null);
  const [retQty, setRetQty] = useState(1);
  const [retUnitPrice, setRetUnitPrice] = useState(0);
  const [retReason, setRetReason] = useState('');
  const [retRefund, setRetRefund] = useState(0);
  const [retDisposition, setRetDisposition] = useState<'restock' | 'perte'>('restock');
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

  const openNewOrder = () => {
    setNewOrderCustomerId(''); setNewOrderCustomerName(''); setOrderLines([]);
    setNewOrderOpen(true);
  };

  const addOrderLine = (product: FinishedProduct) => {
    setOrderLines(prev => [...prev, {
      finished_product_id: product.id,
      product_name: product.name,
      unit_price: product.unit_price,
      quantity: 1,
      total: product.unit_price,
    }]);
  };

  const updateLine = (i: number, qty: number) => {
    setOrderLines(prev => prev.map((l, j) => j === i ? { ...l, quantity: qty, total: +(l.unit_price * qty).toFixed(2) } : l));
  };

  const removeLine = (i: number) => setOrderLines(prev => prev.filter((_, j) => j !== i));

  // pieces → whole cartons (carton price) + loose pieces (piece price), the way stock will be deducted
  const lineToItems = (l: OrderLine) => {
    const product = finishedProducts.find(p => p.id === l.finished_product_id);
    return product ? expandOrderLines([{ product, quantity: l.quantity }], finishedProducts) : [];
  };
  const expandedItems = orderLines.flatMap(lineToItems);
  const orderTotal = expandedItems.reduce((s, i) => s + i.total, 0);

  const handleCreateOrder = async () => {
    if (!newOrderCustomerName.trim()) { toast({ title: 'Customer name required', variant: 'destructive' }); return; }
    if (orderLines.length === 0) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }
    setSavingOrder(true);
    try {
      await orderService.create({
        customerId: newOrderCustomerId || undefined,
        customerName: newOrderCustomerName,
        totalAmount: orderTotal,
        amountPaid: 0,
        amountReturned: 0,
        status: 'pending',
        items: expandedItems as any[],
      } as any);
      toast({ title: 'Order created' });
      setNewOrderOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingOrder(false);
  };

  const handleExportCsv = () => {
    const headers = ['Order #', 'Customer', 'Total (DH)', 'Paid (DH)', 'Returned (DH)', 'Balance (DH)', 'Status', 'Date'];
    const rows = filtered.map(o => [
      o.id, o.customerName,
      o.totalAmount.toFixed(2), o.amountPaid.toFixed(2), o.amountReturned.toFixed(2),
      Math.max(0, o.totalAmount - o.amountPaid + o.amountReturned).toFixed(2),
      o.status, o.createdAt,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = orders.filter(o => o.customerName.toLowerCase().includes(search.toLowerCase()));
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

  const handleReturn = async () => {
    if (!selected || (!retProductName && !retFinishedProductId)) return;
    try {
      await orderService.addReturn(selected.id, {
        productName: retProductName,
        finishedProductId: retFinishedProductId,
        quantity: retQty,
        reason: retReason,
        refundAmount: retRefund,
        disposition: retDisposition,
      });
      toast({ title: 'Return recorded' });
      setReturnOpen(false);
      const updated = await orderService.getAll();
      setOrders(updated);
      const refreshed = updated.find(o => o.id === selected.id);
      setSelected(refreshed || null);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to record return', variant: 'destructive' });
    }
  };

  const balance = (o: Order) => o.totalAmount - o.amountPaid + o.amountReturned;

  const printInvoice = (o: Order) => {
    const fmtMAD = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
    const year = new Date(o.createdAt || new Date()).getFullYear();
    const refNum = `FA N°${year}-${String(o.id).padStart(3, '0')}`;
    const totalHT = o.totalAmount;
    const tva = +(totalHT * 0.2).toFixed(2);
    const ttc = +(totalHT + tva).toFixed(2);

    const itemRows = (o.items || []).map((item, i) => `
      <tr>
        <td>${item.productName}</td>
        <td>L${String(i + 1).padStart(2, '0')}</td>
        <td>${item.finished_product_id ? String(item.finished_product_id).padStart(3, '0') : '—'}</td>
        <td class="c">${item.quantity}</td>
        <td class="r">${fmtMAD(item.unitPrice ?? 0)}</td>
        <td class="r" style="color:#D4162E;font-weight:700;">${fmtMAD(item.total)}</td>
      </tr>`).join('');

    const html = `
      <style>
        .inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
        .inv-title{font-size:38pt;font-weight:900;color:#D4162E;line-height:1;}
        .inv-co-name{font-size:11pt;font-weight:700;margin-top:6px;}
        .inv-co-info{font-size:7.5pt;color:#64748b;line-height:1.75;margin-top:3px;}
        .inv-ref-box{background:#f1f5f9;padding:14px 18px;min-width:190px;border-radius:4px;text-align:left;}
        .inv-ref-lbl{font-size:6.5pt;text-transform:uppercase;letter-spacing:.09em;color:#64748b;}
        .inv-ref-num{font-size:12pt;font-weight:800;color:#D4162E;margin:2px 0 10px;}
        .inv-ref-field{font-size:6.5pt;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-top:7px;}
        .inv-ref-val{font-size:9pt;font-weight:600;color:#1a1a1a;}
        .inv-sep{border:none;border-top:1.5px solid #e2e8f0;margin:10px 0;}
        .inv-sep-red{border:none;border-top:2px solid #D4162E;margin:12px 0;}
        .inv-parties{display:flex;gap:10px;margin:14px 0;}
        .inv-party{flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:11px 14px;border-radius:4px;}
        .inv-party-lbl{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#D4162E;margin-bottom:5px;}
        .inv-party-name{font-size:10pt;font-weight:700;}
        .inv-party-info{font-size:7.5pt;color:#64748b;margin-top:3px;line-height:1.65;}
        table.inv-tbl{width:100%;border-collapse:collapse;font-size:8pt;margin-top:14px;}
        table.inv-tbl thead tr{background:#D4162E;}
        table.inv-tbl th{color:#fff;padding:8px 10px;font-size:7pt;font-weight:700;text-align:left;letter-spacing:.04em;}
        table.inv-tbl th.r{text-align:right;}
        table.inv-tbl th.c{text-align:center;}
        table.inv-tbl td{padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#1a1a1a;}
        table.inv-tbl td.r{text-align:right;}
        table.inv-tbl td.c{text-align:center;}
        table.inv-tbl tbody tr:last-child td{border-bottom:none;}
        .inv-totals{margin-top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
        .inv-tot-row{display:flex;width:280px;justify-content:space-between;font-size:9pt;}
        .inv-tot-row span:first-child{color:#64748b;}
        .inv-tot-row span:last-child{font-weight:600;text-align:right;}
        .inv-ttc{background:#D4162E;color:#fff;padding:8px 14px;border-radius:4px;margin-top:4px;display:flex;width:280px;justify-content:space-between;font-size:10pt;font-weight:700;}
        .inv-thank{text-align:center;font-size:9pt;color:#64748b;margin-top:24px;}
        .inv-footer-legal{text-align:center;font-size:6.5pt;color:#94a3b8;margin-top:6px;}
      </style>

      <div class="inv-top">
        <div>
          <div class="inv-title">FACTURE</div>
          <div class="inv-co-name">MAMALIA SARL</div>
          <div class="inv-co-info">
            Hay Al Majd Lot 139 N°1 - Tanger<br>
            Tél : 0695070681<br>
            IF : 52442341 | TP : 57124515<br>
            RC : 126869 | ICE : 003064129000011<br>
            CNSS : 5261335<br>
            Email : mamalia12023@gmail.com
          </div>
        </div>
        <div class="inv-ref-box">
          <div class="inv-ref-lbl">Référence</div>
          <div class="inv-ref-num">${refNum}</div>
          <div class="inv-ref-field">Date d'émission</div>
          <div class="inv-ref-val">${fmtDate(o.createdAt)}</div>
          <div class="inv-ref-field">Date d'échéance</div>
          <div class="inv-ref-val">${fmtDate(o.createdAt)}</div>
        </div>
      </div>

      <hr class="inv-sep">

      <div class="inv-parties">
        <div class="inv-party">
          <div class="inv-party-lbl">Émetteur</div>
          <div class="inv-party-name">MAMALIA SARL</div>
          <div class="inv-party-info">
            Hay Al Majd Lot 139 N°1<br>
            Tanger, Maroc<br>
            ICE : 003064129000011
          </div>
        </div>
        <div class="inv-party">
          <div class="inv-party-lbl">Client</div>
          <div class="inv-party-name">${o.customerName}</div>
          <div class="inv-party-info">&nbsp;</div>
        </div>
      </div>

      <table class="inv-tbl">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Lot</th>
            <th>Réf. Produit</th>
            <th class="c">Qté</th>
            <th class="r">P.U. HT (MAD)</th>
            <th class="r">Total HT (MAD)</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="inv-totals">
        <div class="inv-tot-row"><span>Total HT</span><span>${fmtMAD(totalHT)}</span></div>
        <div class="inv-tot-row"><span>TVA (20%)</span><span>${fmtMAD(tva)}</span></div>
        <div class="inv-ttc"><span>Total TTC</span><span>${fmtMAD(ttc)}</span></div>
      </div>

      <div class="inv-thank">Merci pour votre confiance</div>
      <hr class="inv-sep-red">
      <div class="inv-footer-legal">
        MAMALIA SARL | IF : 52442341 | TP : 57124515 | RC : 126869 | ICE : 003064129000011 | CNSS : 5261335
      </div>`;

    printDocument(`Facture ${refNum}`, html);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> Sales</h1>
          <p className="text-sm text-muted-foreground">Manage orders, payments, and returns</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('sales.write') && <Button onClick={openNewOrder}><Plus className="h-4 w-4 mr-1" />New Order</Button>}
          <Button variant="outline" onClick={handleExportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search orders..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>

          {loading ? <TableSkeleton /> : filtered.length === 0 ? (
            <EmptyState title="No orders found" description="Orders will appear here." icon="🛒" />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Paid</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Returned</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((order, idx) => (
                  <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }} className="border-b cursor-pointer hover:bg-accent/30" onClick={() => setSelected(order)}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-right font-medium">DH{order.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success hidden sm:table-cell">DH{order.amountPaid.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive hidden md:table-cell">DH{order.amountReturned.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold hidden sm:table-cell">{balance(order) > 0 ? <span className="text-warning">DH{balance(order)}</span> : <span className="text-success">DH0</span>}</TableCell>
                    <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{order.createdAt}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
              <span>{filtered.length} orders · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-3">
                  Order #{selected.id} <OrderStatusBadge status={selected.status} />
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
                <div className="space-y-1 text-sm border-t pt-2">
                  <div className="flex justify-between"><span>Total</span><span className="font-semibold">DH{selected.totalAmount}</span></div>
                  <div className="flex justify-between text-success"><span>Paid</span><span>DH{selected.amountPaid}</span></div>
                  <div className="flex justify-between text-destructive"><span>Returned</span><span>DH{selected.amountReturned}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Balance</span><span>{balance(selected) > 0 ? `DH${balance(selected)}` : 'DH0 (Settled)'}</span></div>
                </div>

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
                          <span>{r.productName} × {r.quantity}</span>
                          <span className="text-destructive font-medium">-DH{r.refundAmount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.reason} — {r.returnedAt}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => printInvoice(selected)}>
                    <Printer className="h-3 w-3 mr-1" /> Print Invoice
                  </Button>
                  {hasPermission('sales.write') && (
                    <>
                      <Button size="sm" onClick={() => { setPayAmount(balance(selected)); setPaymentOpen(true); }}>
                        <CreditCard className="h-3 w-3 mr-1" /> Record Payment
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setRetProductName(''); setRetFinishedProductId(null); setRetQty(1); setRetUnitPrice(0); setRetReason(''); setRetRefund(0); setRetDisposition('restock'); setReturnOpen(true); }}>
                        <Undo2 className="h-3 w-3 mr-1" /> Record Return
                      </Button>
                    </>
                  )}
                </div>
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

      {/* Return dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Record Return</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={retFinishedProductId ? String(retFinishedProductId) : '__manual__'} onValueChange={v => {
                if (v === '__manual__') { setRetFinishedProductId(null); setRetUnitPrice(0); setRetRefund(0); }
                else {
                  const fp = finishedProducts.find(fp => String(fp.id) === v);
                  // prefer the unit price stored on the order item for this product
                  const orderItem = selected?.items?.find(i => i.finishedProductId === Number(v));
                  const price = orderItem?.unitPrice ?? fp?.unit_price ?? 0;
                  setRetFinishedProductId(Number(v));
                  if (fp) setRetProductName(fp.name);
                  setRetUnitPrice(price);
                  setRetRefund(+(price * retQty).toFixed(2));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select product or type manually" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Manual entry</SelectItem>
                  {finishedProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!retFinishedProductId && <Input className="mt-1" value={retProductName} onChange={e => setRetProductName(e.target.value)} placeholder="Product name" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={retQty} onChange={e => {
                  const q = Number(e.target.value) || 1;
                  setRetQty(q);
                  if (retUnitPrice > 0) setRetRefund(+(retUnitPrice * q).toFixed(2));
                }} />
              </div>
              <div className="space-y-1.5">
                <Label>Refund Amount (DH){retUnitPrice > 0 && <span className="ml-1 text-xs text-muted-foreground">auto: {retUnitPrice.toFixed(2)} × {retQty}</span>}</Label>
                <Input type="number" step="0.01" value={retRefund} onChange={e => setRetRefund(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Disposition</Label>
              <Select value={retDisposition} onValueChange={v => setRetDisposition(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restock (back to stock)</SelectItem>
                  <SelectItem value="perte">Write off (trash)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Reason</Label><Textarea value={retReason} onChange={e => setRetReason(e.target.value)} rows={2} /></div>
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
          <DialogHeader><DialogTitle className="font-display">New Order</DialogTitle></DialogHeader>
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
                      <TableRow key={i}>
                        <TableCell>
                          {line.product_name}
                          {(() => {
                            const prod = finishedProducts.find(p => p.id === line.finished_product_id);
                            const sp = prod ? splitPieces(prod, line.quantity) : null;
                            const label = sp ? splitLabel(sp) : null;
                            return label ? <span className="block text-xs text-muted-foreground">{label}{sp!.opens > 0 ? ` · opens ${sp!.opens} carton${sp!.opens === 1 ? '' : 's'}` : ''}</span> : null;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="1" className="h-7 w-20" value={line.quantity} onChange={e => updateLine(i, Number(e.target.value) || 1)} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{lineToItems(line).reduce((t, i) => t + i.total, 0).toFixed(2)} DH</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
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
            <Button onClick={handleCreateOrder} disabled={savingOrder}>{savingOrder ? 'Creating...' : 'Create Order'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
