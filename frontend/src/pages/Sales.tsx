import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Search, Plus, Undo2, CreditCard, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { orderService } from '@/services/orderService';
import { Order } from '@/models/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Sales() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selected, setSelected] = useState<Order | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Cash');
  const [retProductName, setRetProductName] = useState('');
  const [retQty, setRetQty] = useState(1);
  const [retReason, setRetReason] = useState('');
  const [retRefund, setRetRefund] = useState(0);
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await orderService.getAll();
      setOrders(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleExportCsv = () => {
    const headers = ['Order #', 'Customer', 'Total (€)', 'Paid (€)', 'Returned (€)', 'Balance (€)', 'Status', 'Date'];
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
      toast({ title: 'Payment recorded', description: `€${payAmount} received.` });
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
    if (!selected || !retProductName) return;
    try {
      await orderService.addReturn(selected.id, { productName: retProductName, quantity: retQty, reason: retReason, refundAmount: retRefund });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> Sales</h1>
          <p className="text-sm text-muted-foreground">Manage orders, payments, and returns</p>
        </div>
        <Button variant="outline" onClick={handleExportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
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
                    <TableCell className="text-right font-medium">€{order.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-success hidden sm:table-cell">€{order.amountPaid.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive hidden md:table-cell">€{order.amountReturned.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold hidden sm:table-cell">{balance(order) > 0 ? <span className="text-warning">€{balance(order)}</span> : <span className="text-success">€0</span>}</TableCell>
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
                      <span className="font-medium">€{item.total}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm border-t pt-2">
                  <div className="flex justify-between"><span>Total</span><span className="font-semibold">€{selected.totalAmount}</span></div>
                  <div className="flex justify-between text-success"><span>Paid</span><span>€{selected.amountPaid}</span></div>
                  <div className="flex justify-between text-destructive"><span>Returned</span><span>€{selected.amountReturned}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Balance</span><span>{balance(selected) > 0 ? `€${balance(selected)}` : '€0 (Settled)'}</span></div>
                </div>

                {/* Payments list */}
                {selected.payments.length > 0 && (
                  <div>
                    <h4 className="font-display font-semibold text-sm mb-1">Payments</h4>
                    {selected.payments.map(p => (
                      <div key={p.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                        <span className="text-muted-foreground">{p.paidAt} — {p.method}</span>
                        <span className="text-success font-medium">€{p.amount}</span>
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
                          <span className="text-destructive font-medium">-€{r.refundAmount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.reason} — {r.returnedAt}</p>
                      </div>
                    ))}
                  </div>
                )}

                {hasPermission('sales.write') && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setPayAmount(balance(selected)); setPaymentOpen(true); }}>
                      <CreditCard className="h-3 w-3 mr-1" /> Record Payment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRetProductName(selected.items[0]?.productName || ''); setRetQty(1); setRetReason(''); setRetRefund(0); setReturnOpen(true); }}>
                      <Undo2 className="h-3 w-3 mr-1" /> Record Return
                    </Button>
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
            <div className="space-y-1.5"><Label>Amount (€)</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} /></div>
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
            <div className="space-y-1.5"><Label>Product</Label><Input value={retProductName} onChange={e => setRetProductName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={retQty} onChange={e => setRetQty(Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Refund Amount (€)</Label><Input type="number" step="0.01" value={retRefund} onChange={e => setRetRefund(Number(e.target.value))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Reason</Label><Textarea value={retReason} onChange={e => setRetReason(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleReturn}>Confirm Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
