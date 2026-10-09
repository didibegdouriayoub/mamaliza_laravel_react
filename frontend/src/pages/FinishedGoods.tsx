import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Warehouse, Package, Box, Plus, Minus, ShoppingCart, Camera, Trash2, X, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, TableSkeleton } from '@/components/DataStates';
import {
  finishedProductService, FinishedProduct, FinishedStockDetail, productImageSrc, fridgeTotal, sellableTotal,
} from '@/services/finishedProductService';
import { orderService } from '@/services/orderService';
import { customerService } from '@/services/customerService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';
import { expandOrderLines, splitPieces, splitLabel } from '@/lib/orderSplit';

const LOW_STOCK = 10;

const MOVEMENT_LABEL: Record<string, string> = {
  production: 'Produced',
  production_removed: 'Production deleted',
  order: 'Order',
  return: 'Return',
  adjustment: 'Adjustment',
  order_sealed: 'Order (sealed cartons)',
  open_box: 'Carton opened',
  unpack: 'Pieces from opened carton',
  pack_used: 'Used for packing',
  pack_restored: 'Packing deleted',
};

/** Headline number and sub line shown on a card / in the panel. */
function stockSummary(p: FinishedProduct) {
  const loose = fridgeTotal(p);
  if (p.type === 'box') {
    const first = p.components?.[0];
    return {
      total: loose,
      unit: loose === 1 ? 'carton' : 'cartons',
      sub: first ? `carton of ${first.qty_per_box} × ${first.component?.name ?? 'pieces'}` : 'carton',
    };
  }
  if (p.carton && p.carton.sealed > 0) {
    return {
      total: loose + p.carton.sealed * p.carton.qty_per_box,
      unit: 'pieces',
      sub: `${p.carton.sealed} carton${p.carton.sealed === 1 ? '' : 's'} of ${p.carton.qty_per_box} + ${loose} loose`,
    };
  }
  const lots = p.available_lots?.length ?? 0;
  return { total: loose, unit: 'pieces', sub: `${lots} lot${lots === 1 ? '' : 's'} in fridge` };
}

/** Cartons an order of `qty` pieces would have to open (0 when loose pieces are enough). */
const cartonsToOpen = (p: FinishedProduct, qty: number) => splitPieces(p, qty).opens;

const daysOld = (date: string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));

function ProductImage({ product, className = '' }: { product: FinishedProduct; className?: string }) {
  const src = productImageSrc(product);
  const Icon = product.type === 'box' ? Box : Package;
  return (
    <div className={`bg-muted flex items-center justify-center overflow-hidden ${className}`}>
      {src ? <img src={src} alt={product.name} className="h-full w-full object-cover" /> : <Icon className="h-10 w-10 text-muted-foreground/50" />}
    </div>
  );
}

export default function FinishedGoods() {
  const { hasPermission, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const canWrite = hasPermission('finished_goods.write'); // photos
  const canOrder = hasPermission('sales.write'); // orders are created through /orders

  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Order mode: tapping a card adds it to the cart instead of opening the panel
  const [orderMode, setOrderMode] = useState(false);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [orderOpen, setOrderOpen] = useState(false);
  const [custId, setCustId] = useState('');
  const [custName, setCustName] = useState('');
  const [paidInFull, setPaidInFull] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Product panel
  const [panelId, setPanelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FinishedStockDetail | null>(null);
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [lotId, setLotId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setProducts((await finishedProductService.getAll()) || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Failed to load products', description: e?.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    customerService.getAll().then((c: any) => setCustomers(Array.isArray(c) ? c : c?.data ?? [])).catch(() => setCustomers([]));
  }, []);

  const panelProduct = products.find(p => p.id === panelId) ?? null;

  const openPanel = async (p: FinishedProduct) => {
    setPanelId(p.id); setDetail(null); setQty('1'); setReason(''); setLotId(null);
    try { setDetail(await finishedProductService.getStock(p.id)); }
    catch (e: any) { toast({ title: 'Failed to load stock', description: e?.message, variant: 'destructive' }); }
  };

  const adjust = async (direction: 'add' | 'remove') => {
    if (!panelProduct) return;
    const n = parseFloat(qty);
    if (!n || n <= 0) { toast({ title: 'Enter a quantity', variant: 'destructive' }); return; }
    if (reason.trim().length < 3) { toast({ title: 'A reason is required', description: 'e.g. waste, recount, damaged', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const d = await finishedProductService.adjust(panelProduct.id, { direction, quantity: n, reason: reason.trim(), lot_id: direction === 'remove' ? lotId : null });
      setDetail(d); setQty('1'); setReason(''); setLotId(null);
      toast({ title: direction === 'add' ? `Added ${n}` : `Removed ${n}` });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const openOneCarton = async () => {
    if (!panelProduct) return;
    setBusy(true);
    try {
      await finishedProductService.openBox(panelProduct.id, 1);
      setDetail(await finishedProductService.getStock(panelProduct.id));
      toast({ title: 'Carton opened', description: 'Its pieces are now loose in stock.' });
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !panelProduct) return;
    setBusy(true);
    try { await finishedProductService.uploadImage(panelProduct.id, file); await load(); }
    catch (err: any) { toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }); }
    setBusy(false);
  };

  const removeImage = async () => {
    if (!panelProduct) return;
    setBusy(true);
    try { await finishedProductService.deleteImage(panelProduct.id); await load(); }
    catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setBusy(false);
  };

  // ── Cart ──
  const changeCart = (p: FinishedProduct, delta: number) => {
    const max = sellableTotal(p);
    setCart(prev => {
      const next = Math.max(0, Math.min(max, (prev[p.id] ?? 0) + delta));
      if (delta > 0 && (prev[p.id] ?? 0) >= max) toast({ title: `Only ${max} of "${p.name}" available`, variant: 'destructive' });
      const { [p.id]: _, ...rest } = prev;
      return next > 0 ? { ...rest, [p.id]: next } : rest;
    });
  };

  const cartLines = useMemo(
    () => products.filter(p => cart[p.id] > 0).map(p => {
      const quantity = cart[p.id];
      const items = expandOrderLines([{ product: p, quantity }], products); // cartons at carton price + loose at piece price
      return { product: p, quantity, split: splitPieces(p, quantity), items, total: +items.reduce((s, i) => s + i.total, 0).toFixed(2) };
    }),
    [products, cart],
  );
  const cartTotal = cartLines.reduce((s, l) => s + l.total, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.quantity, 0);

  const exitOrderMode = () => { setOrderMode(false); setCart({}); };

  const createOrder = async () => {
    if (!custName.trim()) { toast({ title: 'Customer name required', variant: 'destructive' }); return; }
    setSavingOrder(true);
    try {
      const res: any = await orderService.create({
        customerId: custId || undefined,
        customerName: custName.trim(),
        totalAmount: cartTotal,
        amountPaid: paidInFull ? cartTotal : 0,
        amountReturned: 0,
        status: paidInFull ? 'paid' : 'pending',
        items: cartLines.flatMap(l => l.items) as any[],
      } as any);
      const opened: any[] = res?.cartonsOpened ?? [];
      toast({
        title: 'Order recorded',
        description: `${cartCount} pieces · ${cartTotal.toFixed(2)} DH` +
          (opened.length ? ` · opened ${opened.map(o => `${o.cartons} carton(s) of ${o.name}`).join(', ')}` : ''),
      });
      setOrderOpen(false); setCart({}); setCustId(''); setCustName(''); setPaidInFull(false);
      setOrderMode(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingOrder(false);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const totalValue = products.reduce((s, p) => s + fridgeTotal(p) * p.unit_price, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`p-6 space-y-4 ${orderMode ? 'pb-28' : ''}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Warehouse className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Finished Goods</h1>
        <div className="relative ml-auto w-56 max-w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search products" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canOrder && (orderMode
          ? <Button variant="outline" onClick={exitOrderMode}><X className="h-4 w-4 mr-1" />Cancel order</Button>
          : <Button onClick={() => setOrderMode(true)}><ShoppingCart className="h-4 w-4 mr-1" />Record order</Button>)}
      </div>

      {orderMode && <p className="text-sm text-muted-foreground">Order mode — tap a product to add it, use + / − to change the quantity.</p>}

      {loading ? <TableSkeleton cols={4} rows={3} /> : filtered.length === 0 ? (
        <EmptyState title="No products" description="Create products first in the Products page." />
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map(p => {
            const summary = stockSummary(p);
            const total = summary.total;
            const inCart = cart[p.id] ?? 0;
            const disabled = orderMode && sellableTotal(p) <= 0;
            const opens = cartonsToOpen(p, inCart);
            return (
              <Card
                key={p.id}
                role="button"
                onClick={() => !disabled && (orderMode ? changeCart(p, 1) : openPanel(p))}
                className={`overflow-hidden transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'} ${inCart ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="relative">
                  <ProductImage product={p} className="aspect-square w-full" />
                  {total <= 0 && <Badge variant="destructive" className="absolute top-2 left-2">Out</Badge>}
                  {total > 0 && total < LOW_STOCK && <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-500">Low</Badge>}
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="font-medium leading-tight truncate" title={p.name}>{p.name}</p>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-bold ${total <= 0 ? 'text-destructive' : total < LOW_STOCK ? 'text-amber-600' : 'text-green-600'}`}>{total} <span className="text-xs font-normal text-muted-foreground">{summary.unit}</span></span>
                    <span className="text-xs text-muted-foreground">{p.unit_price.toFixed(2)} DH</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{summary.sub}</p>
                  {inCart > 0 && splitLabel(splitPieces(p, inCart)) && <p className="text-xs font-medium text-primary">{splitLabel(splitPieces(p, inCart))}</p>}
                  {opens > 0 && <p className="text-xs font-medium text-amber-600">Will open {opens} carton{opens === 1 ? '' : 's'}</p>}
                  {orderMode && inCart > 0 && (
                    <div className="flex items-center justify-between pt-1" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeCart(p, -1)}><Minus className="h-4 w-4" /></Button>
                      <span className="font-semibold">{inCart}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeCart(p, 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {products.length > 0 && !orderMode && (
        <div className="text-right text-sm text-muted-foreground pr-1">
          Total stock value: <strong className="text-foreground text-base">{totalValue.toFixed(2)} DH</strong>
        </div>
      )}

      {/* Cart bar */}
      {orderMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background p-4 flex items-center gap-4 shadow-lg">
          <div className="flex-1">
            <p className="font-semibold">{cartCount} piece{cartCount === 1 ? '' : 's'} · {cartLines.length} product{cartLines.length === 1 ? '' : 's'}</p>
            <p className="text-sm text-muted-foreground">Total {cartTotal.toFixed(2)} DH</p>
          </div>
          <Button variant="ghost" disabled={cartCount === 0} onClick={() => setCart({})}>Clear</Button>
          <Button disabled={cartCount === 0} onClick={() => setOrderOpen(true)}>Continue</Button>
        </div>
      )}

      {/* Confirm order */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border divide-y text-sm">
              {cartLines.flatMap(l => l.items).map((it, i) => (
                <div key={i} className="flex justify-between px-3 py-2">
                  <span>{it.quantity} × {it.product_name}</span><span className="font-medium">{it.total.toFixed(2)} DH</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 font-semibold"><span>Total</span><span>{cartTotal.toFixed(2)} DH</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={custId} onValueChange={v => { setCustId(v); setCustName(customers.find(c => String(c.id) === v)?.name ?? ''); }}>
                <SelectTrigger><SelectValue placeholder="Select customer (optional)" /></SelectTrigger>
                <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Customer name" value={custName} onChange={e => { setCustName(e.target.value); setCustId(''); }} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={paidInFull} onCheckedChange={v => setPaidInFull(v === true)} /> Paid in full
            </label>
            {cartLines.some(l => cartonsToOpen(l.product, l.quantity) > 0) && (
              <p className="text-sm font-medium text-amber-600">
                {cartLines.filter(l => cartonsToOpen(l.product, l.quantity) > 0).map(l => `${cartonsToOpen(l.product, l.quantity)} carton(s) of ${l.product.name} will be opened`).join(' · ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Stock is taken from the oldest lots first.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>Back</Button>
            <Button onClick={createOrder} disabled={savingOrder}>{savingOrder ? 'Saving…' : 'Confirm order'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product panel */}
      <Sheet open={panelId !== null} onOpenChange={o => !o && setPanelId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {panelProduct && (
            <div className="space-y-5">
              <SheetHeader><SheetTitle>{panelProduct.name}</SheetTitle></SheetHeader>

              <div className="relative">
                <ProductImage product={panelProduct} className="aspect-video w-full rounded-lg" />
                {canWrite && (
                  <div className="absolute bottom-2 right-2 flex gap-2">
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickImage} />
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4 mr-1" />Photo</Button>
                    {panelProduct.image_url && <Button size="icon" variant="secondary" className="h-8 w-8" disabled={busy} onClick={removeImage}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                )}
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">In the fridge</span>
                <span className="text-3xl font-bold">{stockSummary(panelProduct).total} <span className="text-sm font-normal text-muted-foreground">{stockSummary(panelProduct).unit}</span></span>
              </div>
              <p className="-mt-3 text-sm text-muted-foreground">{stockSummary(panelProduct).sub}</p>

              {panelProduct.type === 'box' && canWrite && fridgeTotal(panelProduct) > 0 && (
                <Button variant="outline" size="sm" disabled={busy} onClick={openOneCarton}>Open 1 carton (becomes loose pieces)</Button>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2">Stock by batch date (oldest first)</h3>
                {!detail ? <p className="text-sm text-muted-foreground">Loading…</p> : detail.lots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing in stock.</p>
                ) : (
                  <div className="rounded-lg border divide-y">
                    {detail.lots.map(l => (
                      <label key={l.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${isAdmin ? 'cursor-pointer' : ''} ${lotId === l.id ? 'bg-accent' : ''}`}>
                        {isAdmin && <input type="radio" name="lot" checked={lotId === l.id} onChange={() => setLotId(lotId === l.id ? null : l.id)} onClick={() => lotId === l.id && setLotId(null)} />}
                        <span className="flex-1">
                          {l.is_opening ? 'Opening stock' : formatDate(l.lot_date)}
                          <span className="text-xs text-muted-foreground ml-2">{daysOld(l.lot_date)}d old</span>
                        </span>
                        <span className="font-semibold">{l.qty_remaining}</span>
                        <span className="text-xs text-muted-foreground">of {l.qty_produced}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="space-y-2 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Adjust stock <span className="text-xs font-normal text-muted-foreground">(admin)</span></h3>
                  <div className="flex gap-2">
                    <Input type="number" min="0" step="1" placeholder="Quantity" value={qty} onChange={e => setQty(e.target.value)} />
                    <Input placeholder="Reason (required)" value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" variant="outline" disabled={busy} onClick={() => adjust('add')}><Plus className="h-4 w-4 mr-1" />Add</Button>
                    <Button className="flex-1" variant="outline" disabled={busy} onClick={() => adjust('remove')}>
                      <Minus className="h-4 w-4 mr-1" />Remove{lotId ? ' (selected batch)' : ' (oldest first)'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">New production is recorded on the Finishing page; use Add for corrections.</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2">History</h3>
                {!detail || detail.movements.length === 0 ? <p className="text-sm text-muted-foreground">No movements yet.</p> : (
                  <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                    {detail.movements.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className={`w-12 font-semibold ${m.quantity >= 0 ? 'text-green-600' : 'text-destructive'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                        <span className="flex-1 min-w-0">
                          {MOVEMENT_LABEL[m.type] ?? m.type}
                          {m.reason && <span className="text-muted-foreground"> · {m.reason}</span>}
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(m.created_at)}{m.user?.name ? ` · ${m.user.name}` : ''}{m.lot ? ` · batch ${formatDate(m.lot.lot_date)}` : ''}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
