import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Printer, Receipt, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { finishedProductService, FinishedProduct } from '@/services/finishedProductService';
import { customerService } from '@/services/customerService';
import { orderService } from '@/services/orderService';
import { printDocument, fmtDate } from '@/lib/printDocument';
import { useToast } from '@/hooks/use-toast';

interface Line {
  finished_product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const devisNumber = () => `DV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const factureNumber = () => `FA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

const fmtMAD = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';

const COMPANY = {
  name: 'MAMALIA SARL',
  address: 'Hay Al Majd Lot 139 N°1 - Tanger',
  tel: '0695070681',
  if_: '52442341',
  tp: '57124515',
  rc: '126869',
  ice: '003064129000011',
  cnss: '5261335',
  email: 'mamalia12023@gmail.com',
};

function buildInvoiceHtml(type: 'DEVIS' | 'FACTURE', refNum: string, date: string, secondDate: string, secondLabel: string, customerName: string, customerAddress: string, lines: Line[]) {
  const totalHT = lines.reduce((s, l) => s + l.total, 0);
  const tva = +(totalHT * 0.2).toFixed(2);
  const ttc = +(totalHT + tva).toFixed(2);

  const itemRows = lines.map((l, i) => `
    <tr>
      <td>${l.product_name}</td>
      <td>L${String(i + 1).padStart(2, '0')}</td>
      <td>${String(l.finished_product_id).padStart(3, '0')}</td>
      <td class="c">${l.quantity}</td>
      <td class="r">${fmtMAD(l.unit_price)}</td>
      <td class="r" style="color:#D4162E;font-weight:700;">${fmtMAD(l.total)}</td>
    </tr>`).join('');

  return `
    <style>
      .inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}
      .inv-title{font-size:38pt;font-weight:900;color:#D4162E;line-height:1;}
      .inv-co-name{font-size:11pt;font-weight:700;margin-top:6px;}
      .inv-co-info{font-size:7.5pt;color:#64748b;line-height:1.75;margin-top:3px;}
      .inv-ref-box{background:#f1f5f9;padding:14px 18px;min-width:190px;border-radius:4px;}
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
      .inv-tot-row span:last-child{font-weight:600;}
      .inv-ttc{background:#D4162E;color:#fff;padding:8px 14px;border-radius:4px;margin-top:4px;display:flex;width:280px;justify-content:space-between;font-size:10pt;font-weight:700;}
      .inv-thank{text-align:center;font-size:9pt;color:#64748b;margin-top:24px;}
      .inv-footer-legal{text-align:center;font-size:6.5pt;color:#94a3b8;margin-top:6px;}
    </style>

    <div class="inv-top">
      <div>
        <div class="inv-title">${type}</div>
        <div class="inv-co-name">${COMPANY.name}</div>
        <div class="inv-co-info">
          ${COMPANY.address}<br>
          Tél : ${COMPANY.tel}<br>
          IF : ${COMPANY.if_} | TP : ${COMPANY.tp}<br>
          RC : ${COMPANY.rc} | ICE : ${COMPANY.ice}<br>
          CNSS : ${COMPANY.cnss}<br>
          Email : ${COMPANY.email}
        </div>
      </div>
      <div class="inv-ref-box">
        <div class="inv-ref-lbl">Référence</div>
        <div class="inv-ref-num">${refNum}</div>
        <div class="inv-ref-field">Date d'émission</div>
        <div class="inv-ref-val">${fmtDate(date)}</div>
        <div class="inv-ref-field">${secondLabel}</div>
        <div class="inv-ref-val">${fmtDate(secondDate)}</div>
      </div>
    </div>

    <hr class="inv-sep">

    <div class="inv-parties">
      <div class="inv-party">
        <div class="inv-party-lbl">Émetteur</div>
        <div class="inv-party-name">${COMPANY.name}</div>
        <div class="inv-party-info">
          Hay Al Majd Lot 139 N°1<br>
          Tanger, Maroc<br>
          ICE : ${COMPANY.ice}
        </div>
      </div>
      <div class="inv-party">
        <div class="inv-party-lbl">Client</div>
        <div class="inv-party-name">${customerName}</div>
        <div class="inv-party-info">${customerAddress ? customerAddress.replace(/\n/g, '<br>') : '&nbsp;'}</div>
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
      ${COMPANY.name} | IF : ${COMPANY.if_} | TP : ${COMPANY.tp} | RC : ${COMPANY.rc} | ICE : ${COMPANY.ice} | CNSS : ${COMPANY.cnss}
    </div>`;
}

export default function DevisFacture() {
  const { toast } = useToast();
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared customer state
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Devis state
  const [devisNum, setDevisNum] = useState(devisNumber());
  const [devisDate, setDevisDate] = useState(today());
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [devisLines, setDevisLines] = useState<Line[]>([]);
  const [devisNotes, setDevisNotes] = useState('');
  const [savingDevis, setSavingDevis] = useState(false);

  // Facture state
  const [factureNum, setFactureNum] = useState(factureNumber());
  const [factureDate, setFactureDate] = useState(today());
  const [factureLines, setFactureLines] = useState<Line[]>([]);
  const [savingFacture, setSavingFacture] = useState(false);

  const load = async () => {
    setLoading(true);
    const [prods, custs, orders] = await Promise.all([
      finishedProductService.getAll().catch(() => []),
      customerService.getAll().catch(() => []),
      orderService.getAll().catch(() => []),
    ]);
    setProducts(prods || []);
    setCustomers(custs || []);
    // Keep only factures and devis in history
    const docs = (orders || []).filter((o: any) =>
      o.documentType === 'facture' || o.documentType === 'devis'
    );
    setHistory(docs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find(c => String(c.id) === id);
    if (c) { setCustomerName(c.name); setCustomerAddress(c.address || ''); }
  };

  const addLine = (p: FinishedProduct, setter: React.Dispatch<React.SetStateAction<Line[]>>) => {
    setter(prev => [...prev, {
      finished_product_id: p.id,
      product_name: p.name,
      unit_price: p.unit_price,
      quantity: 1,
      total: p.unit_price,
    }]);
  };

  const updateLine = (
    i: number,
    field: 'quantity' | 'unit_price',
    val: number,
    setter: React.Dispatch<React.SetStateAction<Line[]>>
  ) => {
    setter(prev => prev.map((l, j) => {
      if (j !== i) return l;
      const updated = { ...l, [field]: val };
      updated.total = +(updated.unit_price * updated.quantity).toFixed(2);
      return updated;
    }));
  };

  // Print devis + save to DB
  const handlePrintDevis = async () => {
    if (!customerName.trim()) { toast({ title: 'Client name required', variant: 'destructive' }); return; }
    if (devisLines.length === 0) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }
    setSavingDevis(true);
    try {
      const total = devisLines.reduce((s, l) => s + l.total, 0);
      await orderService.create({
        customerId: customerId || undefined,
        customerName,
        totalAmount: total,
        amountPaid: 0,
        amountReturned: 0,
        status: 'pending',
        document_type: 'devis',
        items: devisLines.map(l => ({
          product_name: l.product_name,
          finished_product_id: l.finished_product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.total,
        } as any)),
      } as any);
      const html = buildInvoiceHtml('DEVIS', devisNum, devisDate, validUntil, "Validité jusqu'au", customerName, customerAddress, devisLines);
      printDocument(`Devis ${devisNum}`, html);
      toast({ title: 'Devis saved & printed' });
      setDevisLines([]);
      setDevisNum(devisNumber());
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingDevis(false);
  };

  // Create facture (order with stock deduction) + print
  const handleCreateFacture = async () => {
    if (!customerName.trim()) { toast({ title: 'Client name required', variant: 'destructive' }); return; }
    if (factureLines.length === 0) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }
    setSavingFacture(true);
    try {
      const total = factureLines.reduce((s, l) => s + l.total, 0);
      const order = await orderService.create({
        customerId: customerId || undefined,
        customerName,
        totalAmount: total,
        amountPaid: 0,
        amountReturned: 0,
        status: 'pending',
        document_type: 'facture',
        items: factureLines.map(l => ({
          product_name: l.product_name,
          finished_product_id: l.finished_product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.total,
        } as any)),
      } as any);
      toast({ title: 'Facture created', description: 'Stock deducted. Printing…' });
      const ref = `FA N°${new Date().getFullYear()}-${String((order as any)?.id ?? factureNum).padStart(3, '0')}`;
      const html = buildInvoiceHtml('FACTURE', ref, factureDate, factureDate, "Date d'échéance", customerName, customerAddress, factureLines);
      printDocument(`Facture ${ref}`, html);
      setFactureLines([]);
      setFactureNum(factureNumber());
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSavingFacture(false);
  };

  const reprintDocument = (doc: any) => {
    const type = doc.documentType === 'devis' ? 'DEVIS' : 'FACTURE';
    const ref = type === 'FACTURE'
      ? `FA N°${new Date(doc.createdAt).getFullYear()}-${String(doc.id).padStart(3, '0')}`
      : `DV N°${new Date(doc.createdAt).getFullYear()}-${String(doc.id).padStart(3, '0')}`;
    const lines: Line[] = (doc.items || []).map((i: any) => ({
      finished_product_id: i.finishedProductId ?? 0,
      product_name: i.productName,
      unit_price: i.unitPrice ?? 0,
      quantity: i.quantity,
      total: i.total,
    }));
    const html = buildInvoiceHtml(type, ref, doc.createdAt, doc.createdAt, type === 'DEVIS' ? "Validité" : "Date d'échéance", doc.customerName, '', lines);
    printDocument(`${type} ${ref}`, html);
  };

  const devisTotal = devisLines.reduce((s, l) => s + l.total, 0);
  const factureTotal = factureLines.reduce((s, l) => s + l.total, 0);

  const factureHistory = history.filter(d => d.documentType === 'facture');
  const devisHistory = history.filter(d => d.documentType === 'devis');

  const ProductPicker = ({ setter }: { setter: React.Dispatch<React.SetStateAction<Line[]>> }) => (
    <Card>
      <CardHeader><CardTitle className="text-sm">Add Products</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && products.length === 0 && <p className="text-sm text-muted-foreground">No products defined yet.</p>}
        {products.map(p => (
          <button key={p.id} type="button" onClick={() => addLine(p, setter)}
            className="w-full flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 text-left text-sm transition-colors">
            <span className="font-medium">{p.name}</span>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{p.unit_price.toFixed(2)} DH</div>
              <div className={`text-xs font-medium ${(p.stock?.quantity ?? 0) === 0 ? 'text-destructive' : 'text-green-600'}`}>
                Stock: {p.stock?.quantity ?? 0}
              </div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );

  const CustomerCard = () => (
    <Card>
      <CardHeader><CardTitle className="text-sm">Client</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Select value={customerId} onValueChange={selectCustomer}>
          <SelectTrigger><SelectValue placeholder="Select existing customer…" /></SelectTrigger>
          <SelectContent>
            {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Client name" />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Address" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const LinesTable = ({ lines, setter, total }: { lines: Line[]; setter: React.Dispatch<React.SetStateAction<Line[]>>; total: number }) => (
    <Card>
      <CardHeader><CardTitle className="text-sm">Products</CardTitle></CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Click products on the right to add them.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-28">Unit Price</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>{l.product_name}</TableCell>
                  <TableCell>
                    <Input type="number" min="1" className="h-7 w-16" value={l.quantity}
                      onChange={e => updateLine(i, 'quantity', Number(e.target.value) || 1, setter)} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" step="0.01" className="h-7 w-24" value={l.unit_price}
                      onChange={e => updateLine(i, 'unit_price', Number(e.target.value) || 0, setter)} />
                  </TableCell>
                  <TableCell className="text-right font-medium">{l.total.toFixed(2)} DH</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => setter(p => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="font-bold text-right">Total HT</TableCell>
                <TableCell className="text-right font-bold">{total.toFixed(2)} DH</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const HistoryTable = ({ docs, emptyText }: { docs: any[]; emptyText: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm">History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">{emptyText}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(doc => {
                const year = new Date(doc.createdAt).getFullYear();
                const prefix = doc.documentType === 'facture' ? 'FA' : 'DV';
                const ref = `${prefix} N°${year}-${String(doc.id).padStart(3, '0')}`;
                const ttc = (doc.totalAmount * 1.2).toFixed(2);
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-sm">{ref}</TableCell>
                    <TableCell className="text-sm">{doc.customerName}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{ttc} DH</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.createdAt?.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reprintDocument(doc)}>
                        <Printer className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Devis & Facture</h1>
      </div>

      <Tabs defaultValue="facture">
        <TabsList>
          <TabsTrigger value="facture"><Receipt className="h-4 w-4 mr-1" />Facture</TabsTrigger>
          <TabsTrigger value="devis"><FileText className="h-4 w-4 mr-1" />Devis</TabsTrigger>
        </TabsList>

        {/* ── FACTURE TAB ── */}
        <TabsContent value="facture" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Facture Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Facture N°</Label>
                    <Input value={factureNum} onChange={e => setFactureNum(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={factureDate} onChange={e => setFactureDate(e.target.value)} />
                  </div>
                </CardContent>
              </Card>
              <CustomerCard />
              <LinesTable lines={factureLines} setter={setFactureLines} total={factureTotal} />
              <div className="flex justify-end gap-2">
                <Badge variant="outline" className="text-sm py-1 px-3">
                  Total TTC: {(factureTotal * 1.2).toFixed(2)} DH
                </Badge>
                <Button onClick={handleCreateFacture} disabled={savingFacture}>
                  <Receipt className="h-4 w-4 mr-2" />
                  {savingFacture ? 'Creating…' : 'Create & Print Facture'}
                </Button>
              </div>
            </div>
            <ProductPicker setter={setFactureLines} />
          </div>

          <HistoryTable docs={factureHistory} emptyText="No factures created yet." />
        </TabsContent>

        {/* ── DEVIS TAB ── */}
        <TabsContent value="devis" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Devis Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Devis N°</Label>
                    <Input value={devisNum} onChange={e => setDevisNum(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={devisDate} onChange={e => setDevisDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valid Until</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                  </div>
                </CardContent>
              </Card>
              <CustomerCard />
              <LinesTable lines={devisLines} setter={setDevisLines} total={devisTotal} />
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={devisNotes} onChange={e => setDevisNotes(e.target.value)} placeholder="Payment terms, validity, etc." />
              </div>
              <div className="flex justify-end gap-2">
                <Badge variant="outline" className="text-sm py-1 px-3">
                  Total TTC: {(devisTotal * 1.2).toFixed(2)} DH
                </Badge>
                <Button onClick={handlePrintDevis} disabled={savingDevis}>
                  <Printer className="h-4 w-4 mr-2" />
                  {savingDevis ? 'Saving…' : 'Save & Print Devis'}
                </Button>
              </div>
            </div>
            <ProductPicker setter={setDevisLines} />
          </div>

          <HistoryTable docs={devisHistory} emptyText="No devis created yet." />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
