import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { batchQualityService, QualityBatch } from '@/services/batchQualityService';
import { phStatus } from '@/lib/batchQuality';
import { useAuth } from '@/contexts/AuthContext';
import { TableSkeleton } from '@/components/DataStates';
import { formatDate } from '@/lib/formatDate';

type Form = { ph: string; peakTemp: string; waterKg: string; notes: string };
const toNum = (v: string) => (v.trim() === '' ? null : Number(v));
const fromNum = (v: number | null | undefined) => (v == null ? '' : String(v));
const SAVE_DELAY_MS = 800;

export default function QualityBatchPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('quality.write');
  const [batch, setBatch] = useState<QualityBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form>({ ph: '', peakTemp: '', waterKg: '', notes: '' });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(form);

  useEffect(() => {
    if (!id) return;
    batchQualityService.get(id)
      .then(b => {
        setBatch(b);
        // water is prefilled from the recipe until a value is saved for this batch
        const next = {
          ph: fromNum(b.quality?.ph), peakTemp: fromNum(b.quality?.peakTemp),
          waterKg: fromNum(b.quality?.waterKg ?? b.recipe?.defaultWaterKg),
          notes: b.quality?.productionNotes ?? '',
        };
        latest.current = next;
        setForm(next);
      })
      .catch((e: any) => setError(e?.message || 'Could not load this batch'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (f: Form) => {
    if (!id) return;
    setSaveState('saving');
    try {
      await batchQualityService.saveProduction(id, {
        ph: toNum(f.ph), peakTemp: toNum(f.peakTemp), waterKg: toNum(f.waterKg), productionNotes: f.notes.trim() || null,
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  // every change saves by itself after a short pause
  const change = (patch: Partial<Form>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setForm(next);
    setSaveState('idle');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = undefined; save(next); }, SAVE_DELAY_MS);
  };

  // leaving the page with an unsaved change: save it now
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); save(latest.current); }
  }, [id]);

  if (loading) return <div className="shadow-card rounded-lg border p-4"><TableSkeleton /></div>;
  if (error || !batch) return <p className="text-sm text-destructive">{error || 'Batch not found'}</p>;

  const r = batch.recipe;
  const flag = phStatus(toNum(form.ph), r?.phMin, r?.phMax);
  const range = r && (r.phMin != null || r.phMax != null) ? `${r.phMin ?? '…'} – ${r.phMax ?? '…'}` : null;
  const q = batch.quality;

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/quality" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All batches
      </Link>

      <div>
        <h1 className="text-xl font-display font-bold">{batch.recipeName}</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{batch.lot || `#${batch.id}`}</span> · {formatDate(batch.startedAt)}
          {r?.cheeseType && <> · <span className="capitalize">{r.cheeseType}</span></>}
        </p>
      </div>

      {/* Recipe reminder (read-only) */}
      {r && (r.targetTemp != null || range || (r.steps?.length ?? 0) > 0) && (
        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recipe reminder</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {r.targetTemp != null && <span>Target temperature: <b>{r.targetTemp} °C</b></span>}
              {range && <span>pH range: <b>{range}</b></span>}
            </div>
            {(r.steps?.length ?? 0) > 0 && (
              <ol className="list-decimal pl-5 space-y-0.5 text-muted-foreground">
                {r.steps!.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ingredients (read-only, from the batch) */}
      {(batch.inputMaterials?.length ?? 0) > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ingredients</CardTitle></CardHeader>
          <CardContent className="text-sm divide-y">
            {batch.inputMaterials!.map((m, i) => (
              <div key={i} className="flex justify-between gap-2 py-1.5">
                <span>{m.materialName}{m.lot ? <span className="text-xs text-muted-foreground"> · lot {m.lot}</span> : null}</span>
                <span className="font-medium shrink-0">{m.quantity} {m.unit || 'kg'}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stage 1: production */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">1 · Production</CardTitle>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {saveState === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
              {saveState === 'saved' && <><Check className="h-3 w-3 text-green-600" /> Saved</>}
              {saveState === 'error' && <span className="text-destructive">Not saved — retry by editing</span>}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ph">Final pH</Label>
            <Input id="ph" type="number" inputMode="decimal" step="0.01" min="0" max="14" className="text-lg h-12" disabled={!canWrite}
              value={form.ph} onChange={e => change({ ph: e.target.value })} />
            {flag === 'ok' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-normal">In range ({range})</Badge>}
            {(flag === 'low' || flag === 'high') && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-normal">
                <AlertTriangle className="h-3 w-3 mr-1" /> pH {flag === 'low' ? 'below' : 'above'} target ({range})
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="temp">Peak temperature (°C) <span className="text-muted-foreground">optional</span></Label>
              <Input id="temp" type="number" inputMode="decimal" step="0.1" disabled={!canWrite}
                value={form.peakTemp} onChange={e => change({ peakTemp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="water">Water (kg)</Label>
              <Input id="water" type="number" inputMode="decimal" step="0.001" min="0" disabled={!canWrite}
                value={form.waterKg} onChange={e => change({ waterKg: e.target.value })} />
              {r?.defaultWaterKg != null && <p className="text-[11px] text-muted-foreground">Recipe default: {r.defaultWaterKg} kg</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes <span className="text-muted-foreground">optional</span></Label>
            <Textarea id="notes" rows={2} disabled={!canWrite} value={form.notes} onChange={e => change({ notes: e.target.value })} />
          </div>
          {q?.productionByName && (
            <p className="text-xs text-muted-foreground">Recorded by {q.productionByName}{q.productionAt ? ` on ${formatDate(q.productionAt)}` : ''}</p>
          )}
        </CardContent>
      </Card>

      {/* Stages 2 and 3 come next */}
      <Card className="shadow-card opacity-60"><CardHeader className="py-3"><CardTitle className="text-base">2 · Output <span className="text-xs font-normal text-muted-foreground">— coming next</span></CardTitle></CardHeader></Card>
      <Card className="shadow-card opacity-60"><CardHeader className="py-3"><CardTitle className="text-base">3 · Tasting <span className="text-xs font-normal text-muted-foreground">— coming next</span></CardTitle></CardHeader></Card>
    </div>
  );
}
