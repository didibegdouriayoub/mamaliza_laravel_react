import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Truck, Plus, Printer, Trash2, X, PackageCheck, UserPlus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, TableSkeleton } from '@/components/DataStates';
import { LotPicker } from '@/components/LotPicker';
import { finishedProductService, FinishedProduct, fridgeTotal } from '@/services/finishedProductService';
import { tourneeService, Tournee, remainingByProduct } from '@/services/tourneeService';
import { customerService } from '@/services/customerService';
import { orderService } from '@/services/orderService';
import { printTourneeSheet } from '@/lib/tourneePrint';
import { printOrderDocument } from '@/lib/invoicePrint';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';

const today = () => new Date().toLocaleDateString('sv');
const r2 = (n: number) => Math.round(n * 100) / 100;

type SettleLine = { productId: string; quantity: string; price: string };

export default function Tournees() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const showMoney = hasPermission('money.read');
  const canWrite = hasPermission('sales.write');

  const [tournees, setTournees] = useState<Tournee[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // new tournée
  const [newOpen, setNewOpen] = useState(false);
  const [worker, setWorker] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [picks, setPicks] = useState<Record<number, Record<number, number>>>({}); // product -> lot -> qty
  const [expanded, setExpanded] = useState<number | null>(null);

  // settle (one customer)
  const [settleOpen, setSettleOpen] = useState(false);
  const [custId, setCustId] = useState('');
  const [custName, setCustName] = useState('');
  const [lines, setLines] = useState<SettleLine[]>([{ productId: '', quantity: '', price: '' }]);
  const [paid, setPaid] = useState(false);

  // close
  const [closeOpen, setCloseOpen] = useState(false);
  const [returns, setReturns] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      const [t, p] = await Promise.all([tourneeService.getAll(), finishedProductService.getAll()]);
      setTournees(t || []);
      setProducts(p || []);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e?.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    customerService.getAll().then((c: any) => setCustomers(Array.isArray(c) ? c : c?.data ?? [])).catch(() => setCustomers([]));
  }, []);

  const current = tournees.find(t => t.id === openId) ?? null;
  const workers = useMemo(() => [...new Set(tournees.map(t => t.worker_name))], [tournees]);

  // ── new tournée ──
  const loadable = products.filter(p => (p.available_lots?.length ?? 0) > 0);
  const loadedCount = Object.values(picks).reduce((s, lots) => s + Object.values(lots).reduce((a, q) => a + q, 0), 0);

  const openNew = () => { setWorker(''); setDate(today()); setNotes(''); setPicks({}); setExpanded(null); setNewOpen(true); };

  const saveNew = async (print: boolean) => {
    if (!worker.trim()) { toast({ title: 'Worker name required', variant: 'destructive' }); return; }
    const items = Object.values(picks).flatMap(lots => Object.entries(lots).filter(([, q]) => q > 0).map(([id, qty]) => ({ lot_id: Number(id), qty })));
    if (!items.length) { toast({ title: 'Choose what he takes', description: 'Tap a product and enter how many from each lot.', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const t = await tourneeService.create({ worker_name: worker.trim(), date, notes: notes.trim() || undefined, items });
      toast({ title: `Tournée loaded — ${loadedCount} pieces for ${t.worker_name}` });
      setNewOpen(false);
      await load();
      setOpenId(t.id);
      if (print) printTourneeSheet(t);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  // ── settle ──
  const left = current ? remainingByProduct(current) : [];
  const leftOf = (productId: string) => left.find(l => String(l.finished_product_id) === productId)?.remaining ?? 0;
  const priceOf = (productId: string) => products.find(p => String(p.id) === productId)?.unit_price ?? 0;

  const openSettle = () => {
    setCustId(''); setCustName(''); setPaid(false); setLines([{ productId: '', quantity: '', price: '' }]); setSettleOpen(true);
  };

  const setLine = (i: number, patch: Partial<SettleLine>) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));

  const settle = async (print: boolean) => {
    if (!current) return;
    if (!custName.trim()) { toast({ title: 'Customer name required', variant: 'destructive' }); return; }
    const valid = lines.filter(l => l.productId && Number(l.quantity) > 0);
    if (!valid.length) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }
    const over = valid.find(l => Number(l.quantity) > leftOf(l.productId) + 1e-9);
    if (over) { toast({ title: 'More than he has left', description: `${products.find(p => String(p.id) === over.productId)?.name}: ${leftOf(over.productId)} left`, variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const order: any = await tourneeService.settle(current.id, {
        customer_id: custId || undefined,
        customer_name: custName.trim(),
        paid_in_full: showMoney ? paid : undefined,
        items: valid.map(l => ({
          finished_product_id: Number(l.productId),
          quantity: Number(l.quantity),
          unit_price: showMoney && l.price !== '' ? Number(l.price) : undefined,
        })),
      });
      toast({ title: `Facture ${order?.doc_number ?? ''} recorded for ${custName.trim()}` });
      setSettleOpen(false);
      await load();
      if (print) await printInvoice(order.id, custId);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const printInvoice = async (orderId: number, customerId?: string | number | null) => {
    try {
      const o: any = await orderService.getById(orderId);
      const address = customers.find((c: any) => String(c.id) === String(customerId ?? o.customerId ?? ''))?.address ?? '';
      printOrderDocument(o, 'facture', address);
    } catch (e: any) {
      toast({ title: 'Could not print', description: e.message, variant: 'destructive' });
    }
  };

  // ── close / cancel ──
  const openClose = () => {
    if (!current) return;
    setReturns(Object.fromEntries(current.items.filter(i => i.qty_remaining > 0).map(i => [i.id, String(i.qty_remaining)])));
    setCloseOpen(true);
  };

  const close = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await tourneeService.close(current.id, Object.entries(returns).map(([id, q]) => ({ item_id: Number(id), qty: Math.max(0, Number(q) || 0) })));
      toast({ title: 'Tournée closed', description: 'What came back is in the fridge again.' });
      setCloseOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const cancel = async () => {
    if (!current || !window.confirm('Cancel this load? Everything goes back to the fridge.')) return;
    setBusy(true);
    try {
      await tourneeService.cancel(current.id);
      toast({ title: 'Load cancelled', description: 'The stock is back in the fridge.' });
      setOpenId(null);
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const summary = (t: Tournee) => {
    const loaded = t.items.reduce((s, i) => s + i.qty_loaded, 0);
    const delivered = t.items.reduce((s, i) => s + i.qty_delivered, 0);
    const remaining = t.items.reduce((s, i) => s + i.qty_remaining, 0);
    const lost = t.items.reduce((s, i) => s + i.qty_lost, 0);
    return { loaded, delivered, remaining, lost };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Tournées</h1>
        <div className="flex-1" />
        {canWrite && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />New tournée</Button>}
      </div>
      <p className="text-sm text-muted-foreground">
        Load what the worker takes in the morning. In the evening, add each customer he gave products to, then close the tournée: what is left comes back to the fridge.
      </p>

      {loading ? <TableSkeleton cols={5} rows={3} /> : tournees.length === 0 ? (
        <EmptyState title="No tournée yet" description="Create one when the worker takes products to sell." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournees.map(t => {
            const s = summary(t);
            return (
              <Card key={t.id} role="button" className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenId(t.id)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{t.worker_name}</p>
                    <Badge variant={t.status === 'open' ? 'default' : 'secondary'}>{t.status === 'open' ? 'On the road' : 'Closed'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)} · #{t.id}</p>
                  <div className="flex gap-4 text-sm">
                    <span>Loaded <b>{s.loaded}</b></span>
                    <span>Given <b>{s.delivered}</b></span>
                    {t.status === 'open'
                      ? <span className="text-amber-600">Left <b>{s.remaining}</b></span>
                      : s.lost > 0 ? <span className="text-destructive">Missing <b>{s.lost}</b></span> : <span className="text-green-600">All accounted</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.orders.length} facture{t.orders.length === 1 ? '' : 's'}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Tournée detail ── */}
      <Dialog open={!!current} onOpenChange={o => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          {current && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {current.worker_name} · {formatDate(current.date)}
                  <Badge variant={current.status === 'open' ? 'default' : 'secondary'}>{current.status === 'open' ? 'On the road' : 'Closed'}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => printTourneeSheet(current)}><Printer className="h-4 w-4 mr-1" />Print load sheet</Button>
                {canWrite && current.status === 'open' && <Button size="sm" onClick={openSettle}><UserPlus className="h-4 w-4 mr-1" />Add a customer</Button>}
                {canWrite && current.status === 'open' && <Button size="sm" variant="outline" onClick={openClose}><Lock className="h-4 w-4 mr-1" />Close tournée</Button>}
                {canWrite && current.status === 'open' && current.orders.length === 0 && (
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={cancel}><X className="h-4 w-4 mr-1" />Cancel load</Button>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">Loaded</TableHead>
                    <TableHead className="text-right">Given</TableHead>
                    <TableHead className="text-right">{current.status === 'open' ? 'Left' : 'Back'}</TableHead>
                    {current.status === 'closed' && <TableHead className="text-right">Missing</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.items.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.product_name}</TableCell>
                      <TableCell className="text-xs">{i.lot_code || '—'}{i.lot_date ? ` · ${formatDate(i.lot_date)}` : ''}</TableCell>
                      <TableCell className="text-right">{i.qty_loaded}</TableCell>
                      <TableCell className="text-right">{i.qty_delivered}</TableCell>
                      <TableCell className="text-right font-medium">{current.status === 'open' ? i.qty_remaining : i.qty_returned}</TableCell>
                      {current.status === 'closed' && <TableCell className={`text-right ${i.qty_lost > 0 ? 'text-destructive font-semibold' : ''}`}>{i.qty_lost || '—'}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Customers served ({current.orders.length})</p>
                {current.orders.length === 0
                  ? <p className="text-sm text-muted-foreground">None yet.</p>
                  : current.orders.map(o => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{o.customer_name}</span>
                        <span className="text-muted-foreground"> · {o.doc_number} · {o.items.map(i => `${i.quantity} × ${i.product_name}`).join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {showMoney && o.total_amount !== undefined && <span className="font-medium">{Number(o.total_amount).toFixed(2)} DH</span>}
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Print facture" onClick={() => printInvoice(o.id, o.customer_id)}><Printer className="h-3.5 w-3.5" /></Button>
                        {canWrite && current.status === 'open' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete this facture (goods go back to his load)" onClick={async () => {
                            if (!window.confirm(`Delete facture ${o.doc_number}? The products go back to the worker's load.`)) return;
                            try { await orderService.delete(o.id); await load(); } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
                          }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── New tournée (load) ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New tournée — what he takes</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Worker</Label>
              <Input list="tournee-workers" value={worker} onChange={e => setWorker(e.target.value)} placeholder="Name" />
              <datalist id="tournee-workers">{workers.map(w => <option key={w} value={w} />)}</datalist>
            </div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Note (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Route, vehicle…" /></div>

          <div className="space-y-2">
            <Label>Products — tap one, then choose how many from each lot</Label>
            {loadable.length === 0 && <p className="text-sm text-muted-foreground">No product in stock.</p>}
            <div className="space-y-2">
              {loadable.map(p => {
                const picked = Object.values(picks[p.id] ?? {}).reduce((s, q) => s + q, 0);
                const isOpen = expanded === p.id;
                return (
                  <div key={p.id} className={`rounded-lg border ${picked > 0 ? 'ring-1 ring-primary' : ''}`}>
                    <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setExpanded(isOpen ? null : p.id)}>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">{fridgeTotal(p)} in stock{picked > 0 && <b className="text-primary"> · taking {picked}</b>}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t bg-accent/20 px-3 py-2">
                        <LotPicker lots={p.available_lots ?? []} picks={picks[p.id] ?? {}}
                          onChange={(lotId, qty) => setPicks(prev => ({ ...prev, [p.id]: { ...prev[p.id], [lotId]: qty } }))} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="items-center">
            <span className="text-sm text-muted-foreground mr-auto">{loadedCount} pieces</span>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button variant="outline" disabled={busy} onClick={() => saveNew(false)}>Save</Button>
            <Button disabled={busy} onClick={() => saveNew(true)}><Printer className="h-4 w-4 mr-1" />Save &amp; print sheet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Settle one customer ── */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add a customer — what he gave</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={custId} onValueChange={v => { setCustId(v); setCustName(customers.find(c => String(c.id) === v)?.name ?? ''); }}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={custName} onChange={e => { setCustName(e.target.value); setCustId(''); }} placeholder="Or type the customer name" />
          </div>

          <div className="space-y-2">
            <Label>Products</Label>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_90px_32px] gap-2 items-center">
                <Select value={l.productId} onValueChange={v => setLine(i, { productId: v, price: showMoney ? String(priceOf(v)) : '' })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>
                    {left.filter(x => x.remaining > 0).map(x => <SelectItem key={x.finished_product_id} value={String(x.finished_product_id)}>{x.name} — {x.remaining} left</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min="0" className="h-9" placeholder="Qty" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} />
                {showMoney
                  ? <Input type="number" min="0" step="0.01" className="h-9" placeholder="Price" value={l.price} onChange={e => setLine(i, { price: e.target.value })} />
                  : <span />}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setLines(prev => [...prev, { productId: '', quantity: '', price: '' }])}><Plus className="h-3.5 w-3.5 mr-1" />Add a product</Button>
          </div>

          {showMoney && (
            <>
              <p className="text-sm text-right font-semibold">
                Total {r2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0)).toFixed(2)} DH
              </p>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={paid} onCheckedChange={v => setPaid(v === true)} /> Paid in full</label>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)}>Cancel</Button>
            <Button variant="outline" disabled={busy} onClick={() => settle(false)}>Save</Button>
            {showMoney && <Button disabled={busy} onClick={() => settle(true)}><Printer className="h-4 w-4 mr-1" />Save &amp; print</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Close ── */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Close the tournée — what comes back</DialogTitle></DialogHeader>
          {current && (
            <div className="space-y-2">
              {current.items.filter(i => i.qty_remaining > 0).length === 0
                ? <p className="text-sm text-muted-foreground flex items-center gap-2"><PackageCheck className="h-4 w-4 text-green-600" />Everything was given out. Nothing to bring back.</p>
                : <>
                  <p className="text-sm text-muted-foreground">Enter what he really brings back. If it is less than expected, the difference is recorded as missing.</p>
                  {current.items.filter(i => i.qty_remaining > 0).map(i => {
                    const back = Math.min(i.qty_remaining, Math.max(0, Number(returns[i.id]) || 0));
                    const missing = i.qty_remaining - back;
                    return (
                      <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{i.product_name} <span className="text-muted-foreground text-xs">· {i.lot_code || '—'} · should be {i.qty_remaining}</span></span>
                        <div className="flex items-center gap-2">
                          {missing > 0 && <span className="text-xs text-destructive">missing {missing}</span>}
                          <Input type="number" min="0" max={i.qty_remaining} className="h-8 w-20" value={returns[i.id] ?? ''} onChange={e => setReturns(prev => ({ ...prev, [i.id]: e.target.value }))} />
                        </div>
                      </div>
                    );
                  })}
                </>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Back</Button>
            <Button disabled={busy} onClick={close}>Close tournée</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
