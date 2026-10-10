import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, ScanLine, Search, Upload, X, Package, FlaskConical, Users, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { extractLotCodes, isValidLotCode, LotCandidate } from '@/lib/lotCode';
import { finishedProductService } from '@/services/finishedProductService';
import { lotTraceService, LotTrace } from '@/services/lotTraceService';

const fmtDay = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('-') : '—');

/** Draw an image/video frame to a canvas, scaled down and contrast-boosted for OCR. */
function toOcrCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = Math.min(1, 1800 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128)); // grayscale + contrast
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export default function ScanLot() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<LotCandidate[]>([]);
  const [ocrText, setOcrText] = useState('');
  const [code, setCode] = useState('');
  const [known, setKnown] = useState<{ prefix?: string | null; letters?: string | null }[]>([]);
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<LotTrace | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  // Known prefix + letters of your products help rank OCR candidates
  useEffect(() => {
    finishedProductService.getAll()
      .then(ps => setKnown(ps.map(p => ({ prefix: p.lot_prefix, letters: p.lot_letters }))))
      .catch(() => setKnown([]));
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => undefined); }
      });
    } catch {
      toast({ title: 'Camera not available', description: 'Allow camera access, or use "Take / choose photo" below, or type the code.', variant: 'destructive' });
    }
  };

  const recognise = async (canvas: HTMLCanvasElement) => {
    setScanning(true); setProgress(0); setNotFound(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: m => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); },
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /.:-',
        preserve_interword_spaces: '1',
      });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      setOcrText(data.text);
      const found = extractLotCodes(data.text, known);
      setCandidates(found);
      if (found.length) {
        setCode(found[0].code);
      } else {
        toast({ title: 'No lot code found', description: 'Try again closer to the code, with less glare, or type it below.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Could not read the image', description: e?.message, variant: 'destructive' });
    }
    setScanning(false);
  };

  const captureFrame = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    recognise(toOcrCanvas(v, v.videoWidth, v.videoHeight));
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => { recognise(toOcrCanvas(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
  };

  const lookup = async (value = code) => {
    const clean = value.replace(/\s+/g, '').toUpperCase();
    if (!isValidLotCode(clean)) {
      toast({ title: 'Not a valid lot code', description: '2 letters, 6 digits (YYMMDD), then the product letters — e.g. TA260806KP.', variant: 'destructive' });
      return;
    }
    stopCamera();
    setLooking(true); setResult(null); setNotFound(null);
    try {
      setResult(await lotTraceService.get(clean));
    } catch (e: any) {
      setNotFound(e?.message || 'Nothing found for this code.');
    }
    setLooking(false);
  };

  const reset = () => { setResult(null); setNotFound(null); setCandidates([]); setOcrText(''); setCode(''); };

  // ── Results screen ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ScanLine className="h-6 w-6" /> Lot result</h1>
          <Button variant="outline" size="sm" onClick={reset}><ScanLine className="h-4 w-4 mr-1" /> Scan another</Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><p className="text-xs text-muted-foreground">Lot code</p><p className="font-mono text-xl font-bold">{result.lot_code}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Production date</p><p className="text-xl font-semibold">{fmtDay(result.production_date)}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Product</p><p className="font-semibold">{result.products.join(', ') || '—'}</p></div>
          </CardContent>
        </Card>

        {!result.traceable && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">
            This lot is in stock but has no finishing record, so its source batches cannot be shown (older stock).
          </CardContent></Card>
        )}

        {result.runs.map(run => (
          <Card key={run.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Batches &amp; ingredients
                <span className="text-sm font-normal text-muted-foreground">
                  {run.pieces} pcs of {run.product} · finished {fmtDay(run.date)}{run.operator ? ` · ${run.operator}` : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {run.sources.length === 0 && <p className="text-sm text-muted-foreground">No source batch recorded for this run.</p>}
              {run.sources.map(src => (
                <div key={src.batch_group_id} className="rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-accent/20 text-sm">
                    <span className="font-semibold">{src.recipe ?? 'Batch group'} <span className="font-normal text-muted-foreground">· {fmtDay(src.date)}</span></span>
                    <span className="text-muted-foreground">{src.kg_used} kg{src.share_percent !== null ? ` (${src.share_percent}%)` : ''}</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {src.batches.map((b, i) => (
                      <div key={b.id}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Batch #{i + 1} · <span className="font-mono">{b.lot ?? '—'}</span> · {fmtDay(b.started_at)} <Badge variant="secondary" className="ml-1 capitalize">{b.status}</Badge>
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ingredient</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead>Supplier lot</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.ingredients.map((ing, k) => (
                              <TableRow key={k}>
                                <TableCell className="py-1.5">{ing.name}</TableCell>
                                <TableCell className="py-1.5 text-right">{ing.quantity ?? '—'} {ing.unit ?? ''}</TableCell>
                                <TableCell className="py-1.5 font-mono text-xs">{ing.lot ?? '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Buyers</CardTitle></CardHeader>
          <CardContent>
            {result.buyers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sale recorded from this lot yet.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {result.buyers.map(b => (
                  <div key={b.order_id} className="px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{b.customer}{b.phone ? <span className="font-normal text-muted-foreground"> · {b.phone}</span> : null}</p>
                      <p className="text-xs text-muted-foreground">Order #{b.order_id} · {fmtDay(b.date)}</p>
                    </div>
                    <p className="text-muted-foreground">{b.items.map(i => `${i.quantity} × ${i.product}`).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ── Scan screen ─────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-4 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ScanLine className="h-6 w-6" /> Scan lot code</h1>
        <p className="text-sm text-muted-foreground">Point the camera at the printed code (e.g. TA260806KP) to see its batches, ingredients and buyers.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {cameraOn ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} playsInline muted className="w-full max-h-[50vh] object-contain" />
                <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 h-16 rounded border-2 border-white/70" />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={captureFrame} disabled={scanning}><ScanLine className="h-4 w-4 mr-1" />{scanning ? `Reading… ${progress}%` : 'Read code'}</Button>
                <Button variant="outline" onClick={stopCamera}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={startCamera} disabled={scanning}><Camera className="h-4 w-4 mr-1" /> Open camera</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning}><Upload className="h-4 w-4 mr-1" /> Take / choose photo</Button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          )}
          {scanning && !cameraOn && <p className="text-sm text-muted-foreground">Reading the image… {progress}%</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Lot code</Label>
            <div className="flex gap-2">
              <Input className="font-mono uppercase" placeholder="TA260806KP" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') lookup(); }} />
              <Button onClick={() => lookup()} disabled={looking || !code}><Search className="h-4 w-4 mr-1" />{looking ? '…' : 'Look up'}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Check the code that was read, fix it if needed, then look it up.</p>
          </div>

          {candidates.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Other codes found:</span>
              {candidates.slice(1).map(c => (
                <Button key={c.code} size="sm" variant="outline" className="font-mono h-7" onClick={() => setCode(c.code)}>{c.code}</Button>
              ))}
            </div>
          )}

          {ocrText && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Text read from the image</summary>
              <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2">{ocrText}</pre>
            </details>
          )}

          {notFound && <p className="text-sm text-destructive">{notFound}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
