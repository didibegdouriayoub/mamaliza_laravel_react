import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { batchQualityService, QualityBatch } from '@/services/batchQualityService';
import { phStatus, productionDone, tastingCriteria, tastingScore, suggestedVerdict, finalVerdict, tastingDone, Verdict } from '@/lib/batchQuality';
import { useAuth } from '@/contexts/AuthContext';
import { TableSkeleton } from '@/components/DataStates';
import { formatDate } from '@/lib/formatDate';

type Form = { ph: string; peakTemp: string; waterKg: string; notes: string };
const toNum = (v: string) => (v.trim() === '' ? null : Number(v));
const fromNum = (v: number | null | undefined) => (v == null ? '' : String(v));
const SAVE_DELAY_MS = 800;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Autosave for one stage: every change saves by itself after a short pause, and on leaving the page. */
function useAutosave<T>(initial: T, save: (v: T) => Promise<unknown>, resetKey: unknown) {
  const [value, setValue] = useState<T>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(value);
  const saveRef = useRef(save);
  saveRef.current = save;

  const run = async (v: T) => {
    setState('saving');
    try { await saveRef.current(v); setState('saved'); } catch { setState('error'); }
  };
  const reset = (v: T) => { latest.current = v; setValue(v); setState('idle'); };
  const change = (patch: Partial<T>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setValue(next);
    setState('idle');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = undefined; run(next); }, SAVE_DELAY_MS);
  };
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); saveRef.current(latest.current).catch(() => {}); }
  }, [resetKey]);

  return { value, state, change, reset };
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      {state === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
      {state === 'saved' && <><Check className="h-3 w-3 text-green-600" /> Saved</>}
      {state === 'error' && <span className="text-destructive">Not saved — retry by editing</span>}
    </span>
  );
}

const VERDICTS: { key: Verdict; label: string; cls: string }[] = [
  { key: 'approved', label: 'Approved', cls: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'review', label: 'Review', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'rejected', label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
];
const num = (v: number | null | undefined, d = 2) => (v == null ? '—' : String(Math.round(v * 10 ** d) / 10 ** d));

type OutputForm = { outputKg: string; notes: string };
type TastingForm = { scores: Record<string, number | null>; verdict: Verdict | null; notes: string };

export default function QualityBatchPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('quality.write');
  const [batch, setBatch] = useState<QualityBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const production = useAutosave<Form>({ ph: '', peakTemp: '', waterKg: '', notes: '' }, f =>
    batchQualityService.saveProduction(id!, {
      ph: toNum(f.ph), peakTemp: toNum(f.peakTemp), waterKg: toNum(f.waterKg), productionNotes: f.notes.trim() || null,
    }), id);
  const output = useAutosave<OutputForm>({ outputKg: '', notes: '' }, f =>
    batchQualityService.saveOutput(id!, { outputKg: toNum(f.outputKg), outputNotes: f.notes.trim() || null }), id);
  const tasting = useAutosave<TastingForm>({ scores: {}, verdict: null, notes: '' }, f =>
    batchQualityService.saveTasting(id!, { scores: f.scores, verdict: f.verdict, notes: f.notes.trim() || null }), id);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    batchQualityService.get(id)
      .then(b => {
        setBatch(b);
        const q = b.quality;
        // water is prefilled from the recipe until a value is saved for this batch
        production.reset({
          ph: fromNum(q?.ph), peakTemp: fromNum(q?.peakTemp),
          waterKg: fromNum(q?.waterKg ?? b.recipe?.defaultWaterKg), notes: q?.productionNotes ?? '',
        });
        // output weight shows the calculated default until the user types a value
        output.reset({ outputKg: fromNum(q?.outputKg ?? b.output?.outputKg), notes: q?.outputNotes ?? '' });
        tasting.reset({ scores: q?.tastingScores ?? {}, verdict: q?.tastingVerdict ?? null, notes: q?.tastingNotes ?? '' });
      })
      .catch((e: any) => setError(e?.message || 'Could not load this batch'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="shadow-card rounded-lg border p-4"><TableSkeleton /></div>;
  if (error || !batch) return <p className="text-sm text-destructive">{error || 'Batch not found'}</p>;

  const r = batch.recipe;
  const form = production.value;
  const change = production.change;
  const flag = phStatus(toNum(form.ph), r?.phMin, r?.phMax);
  const range = r && (r.phMin != null || r.phMax != null) ? `${r.phMin ?? '…'} – ${r.phMax ?? '…'}` : null;
  const q = batch.quality;

  // Output: server numbers, recomputed here when the output weight or water is edited (steam, fat %, protein % depend on them)
  const o = batch.output;
  const outKg = toNum(output.value.outputKg);
  const waterKg = toNum(form.waterKg) ?? 0;
  const steamKg = o?.available && outKg != null ? outKg - (o.ingredientsKg + waterKg) : null;
  const fatPct = o?.available && outKg ? ((o.fatKg ?? 0) / outKg) * 100 : null;
  const proteinPct = o?.available && outKg ? ((o.proteinKg ?? 0) / outKg) * 100 : null;

  // Tasting
  const criteria = tastingCriteria(r?.cheeseType);
  const score = tastingScore(tasting.value.scores, r?.cheeseType);
  const suggested = suggestedVerdict(score, flag);
  const verdict = finalVerdict(tasting.value.verdict, suggested);
  const setScore = (key: string, v: number) => tasting.change({ scores: { ...tasting.value.scores, [key]: v } });

  const steps = [
    { label: 'Production', done: productionDone({ ph: toNum(form.ph) }) },
    { label: 'Output', done: !!o?.available },
    { label: 'Tasting', done: tastingDone({ tastingScores: tasting.value.scores }, r?.cheeseType) },
  ];
  const verdictInfo = VERDICTS.find(v => v.key === verdict);

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
            <SaveStatus state={production.state} />
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

      {/* Stage 2: output (calculated once the batch group is Done) */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">2 · Output</CardTitle>
            {o?.available && <SaveStatus state={output.state} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!o?.available ? (
            <p className="text-sm text-muted-foreground">
              {o?.reason || 'Available once the batch group is Done.'} Fat, protein and steam are calculated from the real dough weight.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Group dough {num(o.groupDoughKg)} kg ({num(o.usedKg)} used in Finishing + {num(o.leftoverKg)} leftover).
                {q?.outputKg == null ? ' Output weight is the calculated default.' : ''}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="outkg">Output weight (kg)</Label>
                <Input id="outkg" type="number" inputMode="decimal" step="0.001" min="0" className="h-12 text-lg" disabled={!canWrite}
                  value={output.value.outputKg} onChange={e => output.change({ outputKg: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2"><p className="text-[11px] text-muted-foreground">Steam water</p><p className="font-semibold">{num(steamKg, 3)} kg</p></div>
                <div className="rounded-md border p-2"><p className="text-[11px] text-muted-foreground">Fat</p><p className="font-semibold">{num(fatPct)} %</p></div>
                <div className="rounded-md border p-2"><p className="text-[11px] text-muted-foreground">Protein</p><p className="font-semibold">{num(proteinPct)} %</p></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Steam water = output − (ingredients {num(o.ingredientsKg, 3)} kg + water {num(waterKg, 3)} kg).
                {steamKg != null && steamKg < 0 && <span className="text-amber-700"> Negative: check the output weight, water or ingredient amounts.</span>}
              </p>
              {o.missingComposition.length > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-normal whitespace-normal h-auto">
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" /> Fat / protein missing in Inventory for: {o.missingComposition.join(', ')} — percentages are too low until filled
                </Badge>
              )}
              {o.rework.length > 0 && (
                <div className="text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Rework (leftover dough added to this mix)</p>
                  {o.rework.map((w, i) => (
                    <div key={i} className="flex justify-between py-0.5"><span>{w.name}</span><span>{num(w.kg, 3)} kg</span></div>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="outnotes">Notes <span className="text-muted-foreground">optional</span></Label>
                <Textarea id="outnotes" rows={2} disabled={!canWrite} value={output.value.notes} onChange={e => output.change({ notes: e.target.value })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stage 3: tasting */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">3 · Tasting</CardTitle>
            <SaveStatus state={tasting.state} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteria.map(c => (
            <div key={c.key} className="space-y-1.5">
              <Label>{c.label}{c.weight > 1 && <span className="text-xs text-muted-foreground"> · counts ×{c.weight}</span>}</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <Button key={n} type="button" size="sm" disabled={!canWrite} aria-label={`${c.label} ${n}`}
                    variant={tasting.value.scores[c.key] === n ? 'default' : 'outline'} className="h-10 w-10 p-0"
                    onClick={() => setScore(c.key, n)}>{n}</Button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">1 = poor, 5 = excellent.</p>
          <div className="space-y-1.5">
            <Label>Verdict</Label>
            <div className="flex flex-wrap items-center gap-2">
              {VERDICTS.map(v => (
                <Button key={v.key} type="button" size="sm" disabled={!canWrite}
                  variant={verdict === v.key ? 'default' : 'outline'}
                  onClick={() => tasting.change({ verdict: tasting.value.verdict === v.key ? null : v.key })}>{v.label}</Button>
              ))}
            </div>
            {score != null && (
              <p className="text-xs text-muted-foreground">
                Score {score} / 5 · suggested <b>{suggested}</b>
                {(flag === 'low' || flag === 'high') && suggested === 'review' && ' (pH out of range)'}
                {tasting.value.verdict && tasting.value.verdict !== suggested ? ' · overridden — tap the choice again to follow the suggestion' : ''}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tnotes">Notes <span className="text-muted-foreground">optional</span></Label>
            <Textarea id="tnotes" rows={2} disabled={!canWrite} value={tasting.value.notes} onChange={e => tasting.change({ notes: e.target.value })} />
          </div>
          {q?.tastingByName && <p className="text-xs text-muted-foreground">Tasted by {q.tastingByName}{q.tastingAt ? ` on ${formatDate(q.tastingAt)}` : ''}</p>}
        </CardContent>
      </Card>

      {/* Complete summary */}
      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {steps.map(st => (
              <Badge key={st.label} variant="outline" className={`font-normal ${st.done ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {st.done ? '✓' : '○'} {st.label}
              </Badge>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Final pH</dt><dd className="text-right">{form.ph || '—'}{flag === 'low' || flag === 'high' ? ' ⚠' : ''}</dd>
            <dt className="text-muted-foreground">Output</dt><dd className="text-right">{o?.available ? `${num(outKg)} kg` : '—'}</dd>
            <dt className="text-muted-foreground">Steam water</dt><dd className="text-right">{steamKg != null ? `${num(steamKg, 3)} kg` : '—'}</dd>
            <dt className="text-muted-foreground">Fat / protein</dt><dd className="text-right">{fatPct != null ? `${num(fatPct)} % / ${num(proteinPct)} %` : '—'}</dd>
            <dt className="text-muted-foreground">Tasting score</dt><dd className="text-right">{score != null ? `${score} / 5` : '—'}</dd>
            <dt className="text-muted-foreground">Verdict</dt>
            <dd className="text-right">
              {verdictInfo ? <Badge variant="outline" className={`font-normal ${verdictInfo.cls}`}>{verdictInfo.label}</Badge> : '—'}
            </dd>
          </dl>
          {steps.every(st => st.done) && <p className="text-xs text-green-700">All three stages are complete.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
