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

  const orderTotal = orderLines.reduce((s, l) => s + l.total, 0);

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
        items: orderLines.map(l => ({
          product_name: l.product_name,
          finished_product_id: l.finished_product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.total,
        } as any)),
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
    const itemRows = (o.items || []).map((item, i) => `
      <tr class="${i % 2 === 1 ? 'alt' : ''}">
        <td>${item.productName}</td>
        <td class="c">${item.quantity}</td>
        <td class="r">${fmtEur(item.unitPrice ?? 0)}</td>
        <td class="r"><strong>${fmtEur(item.total)}</strong></td>
      </tr>`).join('');

    const bal = balance(o);
    const html = `
      <div class="doc-header">
        <div class="brand">
          <div class="brand-icon">F</div>
          <div>
            <div class="brand-name">Fromagerie Mamaliza</div>
            <div class="brand-sub">Production fromagère artisanale</div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">FACTURE</div>
          <div>N° <strong>${o.id}</strong></div>
          <div>Date : ${fmtDate(o.createdAt)}</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div class="section-title">Client</div>
        <div style="font-size:10pt;font-weight:700;">${o.customerName}</div>
      </div>

      <div class="section-title">Détail de la commande</div>
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th class="c">Qté</th>
            <th class="r">Prix unitaire</th>
            <th class="r">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="total">
            <td colspan="3">TOTAL</td>
            <td class="r">${fmtEur(o.totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="cards" style="margin-top:16px;">
        <div class="card">
          <div class="card-label">Total</div>
          <div class="card-value">${fmtEur(o.totalAmount)}</div>
        </div>
        <div class="card">
          <div class="card-label">Payé</div>
          <div class="card-value green">${fmtEur(o.amountPaid)}</div>
        </div>
        <div class="card">
          <div class="card-label">Solde restant</div>
          <div class="card-value ${bal > 0 ? 'orange' : 'green'}">${fmtEur(Math.max(0, bal))}</div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-label">Cachet et signature du client</div>
          <div class="sig-line"></div>
          <div class="sig-name">${o.customerName}</div>
        </div>
        <div class="sig-box">
          <div class="sig-label">Émis par — Fromagerie Mamaliza</div>
          <div class="sig-line"></div>
          <div class="sig-name">Signature</div>
        </div>
      </div>

      <div class="doc-footer">
        <span>Fromagerie Mamaliza</span>
        <span>Facture N°${o.id} — ${fmtDate(o.createdAt)}</span>
      </div>`;
    printDocument(`Facture #${o.id}`, html);
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
                      <Button size="sm" variant="outline" onClick={() => { setRetProductName(''); setRetFinishedProductId(null); setRetQty(1); setRetReason(''); setRetRefund(0); setRetDisposition('restock'); setReturnOpen(true); }}>
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
                if (v === '__manual__') { setRetFinishedProductId(null); }
                else {
                  const p = finishedProducts.find(fp => String(fp.id) === v);
                  setRetFinishedProductId(Number(v));
                  if (p) setRetProductName(p.name);
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
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={retQty} onChange={e => setRetQty(Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Refund Amount (DH)</Label><Input type="number" step="0.01" value={retRefund} onChange={e => setRetRefund(Number(e.target.value))} /></div>
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
                        <TableCell>{line.product_name}</TableCell>
                        <TableCell>
                          <Input type="number" min="1" className="h-7 w-20" value={line.quantity} onChange={e => updateLine(i, Number(e.target.value) || 1)} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{line.total.toFixed(2)} DH</TableCell>
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
