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

    const itemRows = lines.map((l, i) => `
      <tr class="${i % 2 === 1 ? 'alt' : ''}">
        <td>${l.product_name}</td>
        <td class="c">${l.quantity}</td>
        <td class="r">${fmtEur(l.unit_price)}</td>
        <td class="r"><strong>${fmtEur(l.total)}</strong></td>
      </tr>`).join('');

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
          <div class="doc-title">DEVIS</div>
          <div>N° <strong>${devisNum}</strong></div>
          <div>Date : ${fmtDate(devisDate)}</div>
          <div>Valable jusqu'au : ${fmtDate(validUntil)}</div>
        </div>
      </div>

      <div style="display:flex;gap:32px;margin-bottom:20px;">
        <div style="flex:1;">
          <div class="section-title">Client</div>
          <div style="font-size:10pt;font-weight:700;">${customerName}</div>
          ${customerAddress ? `<div style="font-size:8.5pt;color:#64748b;margin-top:4px;">${customerAddress.replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>

      <div class="section-title">Désignation des produits</div>
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
            <td colspan="3">TOTAL HT</td>
            <td class="r">${fmtEur(total)}</td>
          </tr>
        </tbody>
      </table>

      ${notes ? `<div style="margin-top:16px;font-size:8.5pt;color:#64748b;"><strong>Notes :</strong> ${notes}</div>` : ''}

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-label">Bon pour accord — Cachet et signature du client</div>
          <div class="sig-line"></div>
          <div class="sig-name">${customerName}</div>
        </div>
        <div class="sig-box">
          <div class="sig-label">Émis par — Fromagerie Mamaliza</div>
          <div class="sig-line"></div>
          <div class="sig-name">Signature</div>
        </div>
      </div>

      <div class="doc-footer">
        <span>Fromagerie Mamaliza</span>
        <span>Devis généré le ${fmtDate(today())}</span>
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
