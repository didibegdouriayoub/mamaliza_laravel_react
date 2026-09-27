import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { finishedProductService, FinishedProduct } from '@/services/finishedProductService';
import { customerService } from '@/services/customerService';
import { printDocument, fmtDate, fmtEur } from '@/lib/printDocument';
import { useToast } from '@/hooks/use-toast';

interface DevisLine {
  finished_product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const devisNumber = () => `DV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

export default function Devis() {
  const { toast } = useToast();
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Devis form
  const [devisNum, setDevisNum] = useState(devisNumber());
  const [devisDate, setDevisDate] = useState(today());
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [lines, setLines] = useState<DevisLine[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Promise.all([finishedProductService.getAll(), customerService.getAll().catch(() => [])])
      .then(([prods, custs]) => {
        setProducts(prods || []);
        setCustomers(custs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addLine = (p: FinishedProduct) => {
    setLines(prev => [...prev, {
      finished_product_id: p.id,
      product_name: p.name,
      unit_price: p.unit_price,
      quantity: 1,
      total: p.unit_price,
    }]);
  };

  const updateLine = (i: number, field: 'quantity' | 'unit_price', val: number) => {
    setLines(prev => prev.map((l, j) => {
      if (j !== i) return l;
      const updated = { ...l, [field]: val };
      updated.total = +(updated.unit_price * updated.quantity).toFixed(2);
      return updated;
    }));
  };

  const total = lines.reduce((s, l) => s + l.total, 0);

  const handlePrint = () => {
    if (!customerName.trim()) { toast({ title: 'Client name required', variant: 'destructive' }); return; }
    if (lines.length === 0) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }

    const fmtMAD = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
    const totalHT = lines.reduce((s, l) => s + l.total, 0);
    const tva = +(totalHT * 0.2).toFixed(2);
    const ttc = +(totalHT + tva).toFixed(2);

    const itemRows = lines.map((l, i) => `
      <tr>
        <td>${l.product_name}</td>
        <td>L${String(i + 1).padStart(2, '0')}</td>
        <td>${l.finished_product_id ? String(l.finished_product_id).padStart(3, '0') : '—'}</td>
        <td class="c">${l.quantity}</td>
        <td class="r">${fmtMAD(l.unit_price)}</td>
        <td class="r" style="color:#D4162E;font-weight:700;">${fmtMAD(l.total)}</td>
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
          <div class="inv-title">DEVIS</div>
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
          <div class="inv-ref-num">${devisNum}</div>
          <div class="inv-ref-field">Date d'émission</div>
          <div class="inv-ref-val">${fmtDate(devisDate)}</div>
          <div class="inv-ref-field">Validité jusqu'au</div>
          <div class="inv-ref-val">${fmtDate(validUntil)}</div>
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

      ${notes ? `<div style="margin-top:14px;font-size:8pt;color:#64748b;"><strong>Notes :</strong> ${notes}</div>` : ''}

      <div class="inv-thank">Merci pour votre confiance</div>
      <hr class="inv-sep-red">
      <div class="inv-footer-legal">
        MAMALIA SARL | IF : 52442341 | TP : 57124515 | RC : 126869 | ICE : 003064129000011 | CNSS : 5261335
      </div>`;

    printDocument(`Devis ${devisNum}`, html);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Devis</h1>
        </div>
        <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print / PDF</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header info */}
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

          {/* Client */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Client</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Select existing customer</Label>
                <Select value={customerId} onValueChange={v => {
                  setCustomerId(v);
                  const c = customers.find(c => String(c.id) === v);
                  if (c) { setCustomerName(c.name); setCustomerAddress(c.address || ''); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Pick a customer…" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Products</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {lines.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Unit Price</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.product_name}</TableCell>
                        <TableCell>
                          <Input type="number" min="1" className="h-7 w-20" value={l.quantity} onChange={e => updateLine(i, 'quantity', Number(e.target.value) || 1)} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" className="h-7 w-24" value={l.unit_price} onChange={e => updateLine(i, 'unit_price', Number(e.target.value) || 0)} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtEur(l.total)}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLines(p => p.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold text-right">Total</TableCell>
                      <TableCell className="text-right font-bold">{fmtEur(total)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, validity, etc." />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: product picker */}
        <div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Add Products</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {products.map(p => (
                <button key={p.id} type="button" onClick={() => addLine(p)}
                  className="w-full flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 text-left text-sm transition-colors">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground text-xs">{fmtEur(p.unit_price)}</span>
                </button>
              ))}
              {products.length === 0 && <p className="text-sm text-muted-foreground">No products defined yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
